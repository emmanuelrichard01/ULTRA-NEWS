"""
LLM provider abstraction.

Written for the open-source case, which the previous design ignored. Gemini was
hardcoded at two call sites, so the project assumed one API key owned by one
operator. That is wrong for a project people self-host:

  - A self-hoster may have an OpenAI key, or Ollama on their own machine, or no
    key at all, and none of those were reachable without editing source.
  - A public demo burns the maintainer's personal quota on every visitor.
  - Model ids rot. `gemini-2.5-flash` was hardcoded here and now returns 404 to
    new API keys — a dead constant took the whole feature down.

Three principles:

  1. **Keyless is a first-class mode, not a failure.** With no provider
     configured the product still answers questions and still writes briefs,
     using the retrieved sources directly. Nothing about Ultra News requires
     paid inference to be useful, and the docs say so.
  2. **The provider is configuration.** LLM_PROVIDER selects an adapter;
     adapters are small and self-contained. Adding one is a class, not a
     refactor.
  3. **Failure degrades, never dead-ends.** Every call site can fall back to
     source-derived output, because retrieval has already succeeded by the time
     a model is consulted.
"""
import logging
from dataclasses import dataclass
from typing import Optional, Protocol

from django.conf import settings

logger = logging.getLogger(__name__)


class LLMUnavailable(Exception):
    """No provider is configured, or every configured model failed."""


@dataclass
class LLMResponse:
    text: str
    model: str


class LLMProvider(Protocol):
    """Anything that can turn a prompt into text."""

    name: str

    def generate(self, prompt: str, *, max_tokens: int) -> LLMResponse: ...


class GeminiProvider:
    """Google Gemini via google-genai."""

    name = "gemini"

    def __init__(self, api_key: str, model: str, fallbacks: Optional[list[str]] = None):
        self.api_key = api_key
        self.models = [model, *(fallbacks or [])]

    def generate(self, prompt: str, *, max_tokens: int) -> LLMResponse:
        from google import genai

        from core.observability import llm_calls

        client = genai.Client(api_key=self.api_key)
        last_error: Optional[Exception] = None

        # Hosted models return transient 503 UNAVAILABLE under load. Without a
        # fallback chain, someone else's capacity spike becomes our outage.
        for attempt, model in enumerate(self.models):
            try:
                response = client.models.generate_content(
                    model=model,
                    contents=prompt,
                    config={"max_output_tokens": max_tokens},
                )
                text = (response.text or "").strip()
                if text:
                    # `fallback` distinguishes "the primary model was down and we
                    # recovered" from a clean success — a rising fallback rate is
                    # an early warning that the primary is degrading.
                    llm_calls.labels(
                        "generate", "success" if attempt == 0 else "fallback"
                    ).inc()
                    return LLMResponse(text=text, model=model)
                last_error = LLMUnavailable(f"{model} returned an empty response")
            except Exception as e:  # noqa: BLE001 - provider SDKs raise broadly
                last_error = e
                logger.warning("Model %s unavailable: %s", model, str(e)[:160])

        llm_calls.labels("generate", "failure").inc()
        raise LLMUnavailable(str(last_error) if last_error else "no model responded")


class OpenAICompatibleProvider:
    """
    Any OpenAI-compatible chat-completions endpoint.

    Covers Groq, Cerebras, OpenRouter, OpenAI itself, Ollama (`/v1`), vLLM,
    LM Studio and most self-hosted servers — which is the point. A self-hoster
    running a local model should not need a cloud account to use this product.

    Like the Gemini adapter, this walks a chain of models rather than betting on
    one. The chain matters more here, not less: on a free tier the per-model
    *daily* quota is the binding limit, so the useful fallback is from a strong
    model with a small allowance to a weaker one with a large allowance. The
    product keeps answering after the good model's budget is gone.
    """

    name = "openai"

    def __init__(
        self,
        api_key: str,
        model: str,
        base_url: str,
        fallbacks: Optional[list[str]] = None,
    ):
        self.api_key = api_key
        self.models = [model, *(fallbacks or [])]
        self.base_url = base_url.rstrip("/")

    def generate(self, prompt: str, *, max_tokens: int) -> LLMResponse:
        import httpx

        from core.observability import llm_calls

        headers = {"Content-Type": "application/json"}
        if self.api_key:
            # Local servers usually need no key; sending an empty bearer breaks some.
            headers["Authorization"] = f"Bearer {self.api_key}"

        last_error: Optional[str] = None

        for attempt, model in enumerate(self.models):
            try:
                response = httpx.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json={
                        "model": model,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": max_tokens,
                    },
                    timeout=60.0,
                )
                if response.status_code >= 400:
                    # Read the status before raising. `raise_for_status()` inside a
                    # broad except loses it, and 429-vs-404 is the difference
                    # between "quota gone, try the next model" and "your config is
                    # wrong" — the operator needs to be able to tell them apart.
                    quota = " (daily quota exhausted)" if response.status_code == 429 else ""
                    last_error = f"HTTP {response.status_code} from {model}{quota}"
                    logger.warning("Model %s unavailable: %s", model, last_error)
                    continue

                text = (response.json()["choices"][0]["message"]["content"] or "").strip()
                if text:
                    llm_calls.labels(
                        "generate", "success" if attempt == 0 else "fallback"
                    ).inc()
                    return LLMResponse(text=text, model=model)
                last_error = f"{model} returned an empty response"
            except Exception as e:  # noqa: BLE001 - transport and shape errors both
                last_error = f"{type(e).__name__}: {str(e)[:160]}"
                logger.warning("Model %s unavailable: %s", model, last_error)

        # Never surfaced to clients: provider errors embed request URLs, headers
        # and key fragments. Call sites catch this and fall back to extraction.
        llm_calls.labels("generate", "failure").inc()
        raise LLMUnavailable(last_error or "no model responded")


@dataclass(frozen=True)
class _Preset:
    """A known endpoint, so a working config is two environment variables."""

    base_url: str
    model: str
    fallbacks: tuple[str, ...] = ()


# Free-tier allowances noted as of August 2026 — they move, so treat them as the
# reason for the ordering rather than a promise. In each chain the first model is
# the most capable and the last is the one with the largest daily allowance, so
# quota exhaustion degrades quality instead of removing the feature.
_PRESETS: dict[str, _Preset] = {
    "groq": _Preset(
        base_url="https://api.groq.com/openai/v1",
        model="llama-3.3-70b-versatile",   # ~1,000 req/day
        fallbacks=("llama-3.1-8b-instant",),  # ~14,400 req/day
    ),
    "cerebras": _Preset(
        base_url="https://api.cerebras.ai/v1",
        model="llama-3.3-70b",
        fallbacks=("llama3.1-8b",),
    ),
    "openrouter": _Preset(
        base_url="https://openrouter.ai/api/v1",
        model="meta-llama/llama-3.3-70b-instruct:free",
    ),
    "openai": _Preset(base_url="https://api.openai.com/v1", model="gpt-4o-mini"),
}


def get_provider() -> Optional[LLMProvider]:
    """
    Build the configured provider, or None when running keyless.

    None is a supported, documented state — callers fall back to source-derived
    output rather than erroring.
    """
    provider = (getattr(settings, "LLM_PROVIDER", "") or "groq").lower()
    api_key = getattr(settings, "LLM_API_KEY", "")
    model = getattr(settings, "LLM_MODEL", "")
    fallbacks = list(getattr(settings, "LLM_FALLBACK_MODELS", []) or [])

    if provider == "none":
        return None

    if provider == "gemini":
        if not api_key:
            return None
        return GeminiProvider(
            api_key=api_key,
            model=model or "gemini-3.6-flash",
            fallbacks=fallbacks or ["gemini-3.5-flash", "gemini-2.0-flash"],
        )

    if provider in _PRESETS:
        preset = _PRESETS[provider]
        if not api_key:
            # A hosted endpoint without a key is not a degraded provider, it is
            # no provider — say so once at startup rather than failing per call.
            logger.info("LLM_PROVIDER=%s has no LLM_API_KEY; running keyless.", provider)
            return None
        return OpenAICompatibleProvider(
            api_key=api_key,
            model=model or preset.model,
            base_url=getattr(settings, "LLM_BASE_URL", "") or preset.base_url,
            fallbacks=fallbacks or list(preset.fallbacks),
        )

    if provider in ("openai-compatible", "ollama"):
        base_url = getattr(settings, "LLM_BASE_URL", "")
        if not base_url:
            logger.error("LLM_PROVIDER=%s requires LLM_BASE_URL; running keyless.", provider)
            return None
        if not model:
            logger.error("LLM_PROVIDER=%s requires LLM_MODEL; running keyless.", provider)
            return None
        # Local servers legitimately have no API key, so only URL and model are required.
        return OpenAICompatibleProvider(
            api_key=api_key, model=model, base_url=base_url, fallbacks=fallbacks
        )

    logger.error(
        "Unknown LLM_PROVIDER %r (known: %s, gemini, ollama, none); running keyless.",
        provider,
        ", ".join(sorted(_PRESETS)),
    )
    return None


def is_configured() -> bool:
    return get_provider() is not None
