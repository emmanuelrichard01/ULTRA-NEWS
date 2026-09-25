"""
LLM provider abstraction.

Written for the open-source case, which the previous design ignored. Gemini was
hardcoded at two call sites, so the project assumed one API key owned by one
operator. That is wrong for a project people self-host:

  - A self-hoster may have an OpenAI key, or Ollama on their own machine, or no
    key at all, and none of those were reachable without editing source.
  - A public demo burns the maintainer's personal quota on every visitor.
  - Model ids rot. `gemini-2.5-flash` was hardcoded here and now returns 404 to
    new API keys — a dead constant took the whole feature down. It happened
    again on 2026-08-16, when Groq retired both Llama models the default preset
    pointed at, and Cerebras and OpenRouter's free tier dropped theirs too.

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

Two capabilities every adapter offers:

  generate()  one complete response. Used for briefs, where the output is JSON
              and is only useful whole. `json_mode` asks the server to constrain
              output to a JSON object where it can.
  stream()    tokens as they are produced. Used for Ask, where the first words
              arriving in under a second is the difference between an answer
              and a spinner. The fallback chain applies up to the FIRST token —
              once text has reached the reader, switching model mid-answer would
              splice two different answers together.

Both take an optional `system` message. Instructions and untrusted data belong
in different roles: a reader's question and a publisher's excerpt are both text
someone else wrote, and the model is told so in a channel they cannot write to.
"""
import contextlib
import json
import logging
from dataclasses import dataclass, field
from typing import Iterator, Optional, Protocol

from django.conf import settings

logger = logging.getLogger(__name__)


class LLMUnavailable(Exception):
    """No provider is configured, or every configured model failed."""


@dataclass
class LLMResponse:
    text: str
    model: str


class LLMStream:
    """
    An opened token stream.

    `model` is known before the first token is consumed — the fallback chain has
    already settled on a model by the time an LLMStream exists — so a caller can
    announce which model is answering before it starts relaying text.
    """

    def __init__(self, model: str, chunks: Iterator[str]):
        self.model = model
        self._chunks = chunks

    def __iter__(self) -> Iterator[str]:
        return self._chunks


class LLMProvider(Protocol):
    """Anything that can turn a prompt into text."""

    name: str

    def generate(
        self, prompt: str, *, max_tokens: int,
        system: Optional[str] = None, json_mode: bool = False,
    ) -> LLMResponse: ...

    def stream(
        self, prompt: str, *, max_tokens: int, system: Optional[str] = None,
    ) -> LLMStream: ...


# ==========================================================================
# Model profiles
# ==========================================================================

@dataclass(frozen=True)
class ModelProfile:
    """
    Per-model request adjustments.

    The replacements Groq recommended for its retired Llama models are
    `openai/gpt-oss-*`, which are REASONING models: they think before they
    answer, and the thinking is billed against the same completion cap as the
    answer. Sent the old 450-token cap unchanged, a hard question could spend
    all 450 on reasoning and return an empty message — which the fallback chain
    would then treat as a failure, walk to the next model, and repeat.

    So a reasoning model gets two things: effort pinned low (a wire-room answer
    is summarisation over supplied context, not a maths problem), and headroom
    added to the cap so the visible answer keeps the budget the call site asked
    for.
    """

    reasoning: bool = False
    headroom: int = 0
    extra: dict = field(default_factory=dict)


def _profile(flavor: str, model: str) -> ModelProfile:
    m = model.lower()
    if "gpt-oss" in m:
        if flavor == "groq":
            # `include_reasoning: false` keeps the reasoning out of the payload
            # entirely; `reasoning_format` is rejected for gpt-oss on Groq.
            extra = {"reasoning_effort": "low", "include_reasoning": False}
        elif flavor == "openrouter":
            extra = {"reasoning": {"effort": "low", "exclude": True}}
        else:
            extra = {"reasoning_effort": "low"}
        return ModelProfile(reasoning=True, headroom=768, extra=extra)
    if "qwen3" in m or "qwen-3" in m or "reasoning" in m or "nemotron" in m:
        # Hybrid thinkers. No portable switch to turn thinking off, so budget
        # for it instead of fighting it.
        return ModelProfile(reasoning=True, headroom=768)
    return ModelProfile()


def _messages(prompt: str, system: Optional[str]) -> list[dict]:
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    return messages


# ==========================================================================
# Adapters
# ==========================================================================

class GeminiProvider:
    """Google Gemini via google-genai."""

    name = "gemini"

    def __init__(self, api_key: str, model: str, fallbacks: Optional[list[str]] = None):
        self.api_key = api_key
        self.models = [model, *(fallbacks or [])]

    def _config(self, max_tokens: int, system: Optional[str], json_mode: bool) -> dict:
        config: dict = {"max_output_tokens": max_tokens}
        if system:
            config["system_instruction"] = system
        if json_mode:
            config["response_mime_type"] = "application/json"
        return config

    def generate(
        self, prompt: str, *, max_tokens: int,
        system: Optional[str] = None, json_mode: bool = False,
    ) -> LLMResponse:
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
                    config=self._config(max_tokens, system, json_mode),
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

    def stream(
        self, prompt: str, *, max_tokens: int, system: Optional[str] = None,
    ) -> LLMStream:
        from google import genai

        from core.observability import llm_calls

        client = genai.Client(api_key=self.api_key)
        last_error: Optional[Exception] = None

        for attempt, model in enumerate(self.models):
            try:
                chunks = client.models.generate_content_stream(
                    model=model,
                    contents=prompt,
                    config=self._config(max_tokens, system, False),
                )
                texts = (c.text for c in chunks if getattr(c, "text", None))
                first = next(texts, None)
                if not first:
                    last_error = LLMUnavailable(f"{model} returned an empty stream")
                    continue
                llm_calls.labels("stream", "success" if attempt == 0 else "fallback").inc()
                return LLMStream(model, _prepend(first, texts))
            except Exception as e:  # noqa: BLE001
                last_error = e
                logger.warning("Model %s unavailable: %s", model, str(e)[:160])

        llm_calls.labels("stream", "failure").inc()
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
        flavor: str = "generic",
    ):
        self.api_key = api_key
        self.models = [model, *(fallbacks or [])]
        self.base_url = base_url.rstrip("/")
        # Which vendor's dialect of the API this is. Only consulted for the
        # handful of parameters vendors spell differently (reasoning controls).
        self.flavor = flavor

    def _headers(self) -> dict:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            # Local servers usually need no key; sending an empty bearer breaks some.
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _body(
        self, model: str, prompt: str, max_tokens: int,
        system: Optional[str], json_mode: bool, stream: bool,
    ) -> dict:
        profile = _profile(self.flavor, model)
        body = {
            "model": model,
            "messages": _messages(prompt, system),
            "max_tokens": max_tokens + profile.headroom,
            **profile.extra,
        }
        if json_mode:
            body["response_format"] = {"type": "json_object"}
        if stream:
            body["stream"] = True
        return body

    @staticmethod
    def _describe_status(status: int, model: str) -> str:
        # 429-vs-404 is the difference between "quota gone, try the next model"
        # and "your config is wrong" — the operator needs to be able to tell.
        hint = {
            429: " (quota exhausted)",
            404: " (unknown or retired model id)",
        }.get(status, "")
        return f"HTTP {status} from {model}{hint}"

    def generate(
        self, prompt: str, *, max_tokens: int,
        system: Optional[str] = None, json_mode: bool = False,
    ) -> LLMResponse:
        import httpx

        from core.observability import llm_calls

        last_error: Optional[str] = None

        for attempt, model in enumerate(self.models):
            use_json = json_mode
            # At most two tries per model: the second only if the server
            # rejected JSON mode itself, which older local servers do. Losing
            # the constraint is recoverable — the parser tolerates fenced and
            # prefixed JSON — whereas skipping a working model is not.
            for _ in range(2):
                try:
                    response = httpx.post(
                        f"{self.base_url}/chat/completions",
                        headers=self._headers(),
                        json=self._body(model, prompt, max_tokens, system, use_json, False),
                        timeout=60.0,
                    )
                except Exception as e:  # noqa: BLE001 - transport errors
                    last_error = f"{type(e).__name__}: {str(e)[:160]}"
                    logger.warning("Model %s unavailable: %s", model, last_error)
                    break

                if response.status_code == 400 and use_json:
                    use_json = False
                    continue
                if response.status_code >= 400:
                    last_error = self._describe_status(response.status_code, model)
                    logger.warning("Model %s unavailable: %s", model, last_error)
                    break

                try:
                    choice = response.json()["choices"][0]
                    text = (choice["message"].get("content") or "").strip()
                except Exception as e:  # noqa: BLE001 - shape errors
                    last_error = f"{type(e).__name__}: malformed response from {model}"
                    logger.warning("Model %s unavailable: %s", model, last_error)
                    break

                if text:
                    llm_calls.labels(
                        "generate", "success" if attempt == 0 else "fallback"
                    ).inc()
                    return LLMResponse(text=text, model=model)

                # A reasoning model that spent its whole budget thinking returns
                # an empty message with finish_reason=length. Worth naming,
                # because it looks exactly like a broken key otherwise.
                reason = choice.get("finish_reason")
                last_error = (
                    f"{model} exhausted its token budget before answering"
                    if reason == "length" else f"{model} returned an empty response"
                )
                logger.warning("Model %s unavailable: %s", model, last_error)
                break

        # Never surfaced to clients: provider errors embed request URLs, headers
        # and key fragments. Call sites catch this and fall back to extraction.
        llm_calls.labels("generate", "failure").inc()
        raise LLMUnavailable(last_error or "no model responded")

    def stream(
        self, prompt: str, *, max_tokens: int, system: Optional[str] = None,
    ) -> LLMStream:
        import httpx

        from core.observability import llm_calls

        last_error: Optional[str] = None

        for attempt, model in enumerate(self.models):
            ctx = None
            try:
                ctx = httpx.stream(
                    "POST",
                    f"{self.base_url}/chat/completions",
                    headers=self._headers(),
                    json=self._body(model, prompt, max_tokens, system, False, True),
                    # Connect fast, but allow a slow first token: a reasoning
                    # model can think for several seconds before it speaks.
                    timeout=httpx.Timeout(60.0, connect=10.0),
                )
                response = ctx.__enter__()
                if response.status_code >= 400:
                    last_error = self._describe_status(response.status_code, model)
                    logger.warning("Model %s unavailable: %s", model, last_error)
                    ctx.__exit__(None, None, None)
                    continue

                deltas = _sse_deltas(response.iter_lines())
                # Pull the first token BEFORE committing to this model. A stream
                # that opens and then says nothing is a failure we can still
                # recover from; one that has started talking is not.
                first = next(deltas, None)
                if not first:
                    last_error = f"{model} returned an empty stream"
                    logger.warning("Model %s unavailable: %s", model, last_error)
                    ctx.__exit__(None, None, None)
                    continue

                llm_calls.labels("stream", "success" if attempt == 0 else "fallback").inc()
                return LLMStream(model, _closing(_prepend(first, deltas), ctx))
            except Exception as e:  # noqa: BLE001 - transport and shape errors
                last_error = f"{type(e).__name__}: {str(e)[:160]}"
                logger.warning("Model %s unavailable: %s", model, last_error)
                if ctx is not None:
                    with contextlib.suppress(Exception):
                        ctx.__exit__(None, None, None)

        llm_calls.labels("stream", "failure").inc()
        raise LLMUnavailable(last_error or "no model responded")


def _sse_deltas(lines: Iterator[str]) -> Iterator[str]:
    """
    Content deltas from an OpenAI-style SSE stream.

    Reasoning deltas (`delta.reasoning`, `delta.reasoning_content`) are dropped
    on purpose: the reader asked for an answer, not a transcript of the model
    deciding what to say.
    """
    for line in lines:
        if not line or not line.startswith("data:"):
            continue
        payload = line[5:].strip()
        if payload == "[DONE]":
            return
        try:
            event = json.loads(payload)
        except ValueError:
            continue
        if event.get("error"):
            # Mid-stream provider error. Surface as an exception so the caller's
            # degraded path runs, rather than silently truncating the answer.
            raise LLMUnavailable("provider error mid-stream")
        for choice in event.get("choices") or []:
            text = (choice.get("delta") or {}).get("content")
            if text:
                yield text


def _prepend(first: str, rest: Iterator[str]) -> Iterator[str]:
    yield first
    yield from rest


def _closing(chunks: Iterator[str], ctx) -> Iterator[str]:
    """Release the HTTP connection however the consumer stops reading."""
    try:
        yield from chunks
    finally:
        with contextlib.suppress(Exception):
            ctx.__exit__(None, None, None)


# ==========================================================================
# Presets
# ==========================================================================

@dataclass(frozen=True)
class _Preset:
    """A known endpoint, so a working config is two environment variables."""

    base_url: str
    model: str
    fallbacks: tuple[str, ...] = ()


# Catalogues as of September 2026 — they move, and this table is where they
# move to. In each chain the first model is the most capable and the last is the
# one with the largest allowance, so quota exhaustion degrades quality instead
# of removing the feature.
#
# Groq retired llama-3.3-70b-versatile and llama-3.1-8b-instant on 2026-08-16
# and named gpt-oss-120b / gpt-oss-20b as their replacements. Cerebras dropped
# both of its Llama ids in the same window, and OpenRouter no longer offers a
# free Llama. Pinning a dated id is still right — "latest" aliases change
# behaviour under you — but when one dies, this is the only line to change.
_PRESETS: dict[str, _Preset] = {
    "groq": _Preset(
        base_url="https://api.groq.com/openai/v1",
        model="openai/gpt-oss-120b",
        fallbacks=("openai/gpt-oss-20b",),
    ),
    "cerebras": _Preset(
        base_url="https://api.cerebras.ai/v1",
        model="gpt-oss-120b",
        fallbacks=("qwen-3.8-27b",),
    ),
    "openrouter": _Preset(
        base_url="https://openrouter.ai/api/v1",
        model="google/gemma-4-31b-it:free",
        # `openrouter/free` routes to whichever free model has capacity — a
        # last resort that keeps answering when both named models are busy.
        fallbacks=("qwen/qwen3.8-27b:free", "openrouter/free"),
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
            flavor=provider,
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
