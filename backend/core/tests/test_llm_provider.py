"""
Provider resolution and the model fallback chain.

Configuration is where this feature breaks in practice, and it breaks quietly:
a wrong model id is a 404 per call, not a startup error, so the product looks
like it "just doesn't do AI" while every log line says the key is fine. These
tests pin the resolution rules so that failure mode cannot come back.
"""
from unittest.mock import MagicMock, patch

import pytest
from django.test import override_settings

from core.services.llm import (
    GeminiProvider,
    LLMUnavailable,
    OpenAICompatibleProvider,
    get_provider,
)


def _response(status: int, text: str = ""):
    r = MagicMock()
    r.status_code = status
    r.json.return_value = {"choices": [{"message": {"content": text}}]}
    return r


# ==========================================================================
# Resolution
# ==========================================================================

@override_settings(LLM_PROVIDER="groq", LLM_API_KEY="k", LLM_MODEL="", LLM_FALLBACK_MODELS=[])
def test_groq_preset_supplies_url_and_models():
    """
    The regression guard.

    LLM_MODEL and LLM_FALLBACK_MODELS used to default to Gemini model ids in
    settings regardless of provider, so LLM_PROVIDER=groq sent
    `gemini-3.5-flash` to Groq and every request 404'd. Provider defaults must
    come from the provider.
    """
    provider = get_provider()

    assert isinstance(provider, OpenAICompatibleProvider)
    assert provider.base_url == "https://api.groq.com/openai/v1"
    assert all("gemini" not in m for m in provider.models), provider.models
    # Strong model first, largest daily allowance last.
    assert provider.models[0] == "llama-3.3-70b-versatile"
    assert provider.models[-1] == "llama-3.1-8b-instant"


@override_settings(LLM_PROVIDER="groq", LLM_API_KEY="", LLM_MODEL="", LLM_FALLBACK_MODELS=[])
def test_hosted_provider_without_a_key_runs_keyless():
    """Keyless is a supported mode, so this returns None rather than raising."""
    assert get_provider() is None


@override_settings(LLM_PROVIDER="none", LLM_API_KEY="k", LLM_MODEL="", LLM_FALLBACK_MODELS=[])
def test_none_disables_inference_even_with_a_key_present():
    assert get_provider() is None


@override_settings(
    LLM_PROVIDER="groq", LLM_API_KEY="k",
    LLM_MODEL="custom-model", LLM_FALLBACK_MODELS=["other-model"],
)
def test_explicit_configuration_overrides_the_preset():
    provider = get_provider()
    assert provider.models == ["custom-model", "other-model"]
    assert provider.base_url == "https://api.groq.com/openai/v1"  # url still from preset


@override_settings(LLM_PROVIDER="gemini", LLM_API_KEY="k", LLM_MODEL="", LLM_FALLBACK_MODELS=[])
def test_gemini_still_resolves_with_its_own_defaults():
    provider = get_provider()
    assert isinstance(provider, GeminiProvider)
    assert all("gemini" in m for m in provider.models), provider.models


@override_settings(LLM_PROVIDER="ollama", LLM_API_KEY="", LLM_MODEL="llama3", LLM_BASE_URL="")
def test_unpreset_provider_without_a_base_url_is_keyless_not_broken():
    """A server we have no preset for cannot be guessed at — degrade, don't invent."""
    assert get_provider() is None


@override_settings(
    LLM_PROVIDER="ollama", LLM_API_KEY="",
    LLM_MODEL="llama3", LLM_BASE_URL="http://localhost:11434/v1",
    LLM_FALLBACK_MODELS=[],
)
def test_local_server_needs_no_api_key():
    provider = get_provider()
    assert isinstance(provider, OpenAICompatibleProvider)
    assert provider.api_key == ""


@override_settings(LLM_PROVIDER="wat", LLM_API_KEY="k", LLM_MODEL="", LLM_FALLBACK_MODELS=[])
def test_unknown_provider_degrades_rather_than_raising():
    assert get_provider() is None


# ==========================================================================
# The fallback chain
# ==========================================================================

def test_quota_exhaustion_falls_through_to_the_next_model():
    """
    429 on a free tier means *this model's* daily allowance is gone, not that
    inference is unavailable — the next model in the chain has its own budget.
    This is the difference between the feature degrading and the feature dying.
    """
    provider = OpenAICompatibleProvider(
        api_key="k", model="big", base_url="https://x/v1", fallbacks=["small"],
    )

    with patch("httpx.post", side_effect=[_response(429), _response(200, "answered")]) as post:
        result = provider.generate("q", max_tokens=100)

    assert result.text == "answered"
    assert result.model == "small"
    assert [c.kwargs["json"]["model"] for c in post.call_args_list] == ["big", "small"]


def test_every_model_failing_raises_unavailable():
    provider = OpenAICompatibleProvider(
        api_key="k", model="big", base_url="https://x/v1", fallbacks=["small"],
    )

    with patch("httpx.post", return_value=_response(429)), pytest.raises(LLMUnavailable):
        provider.generate("q", max_tokens=100)


def test_an_empty_response_is_a_failure_not_an_answer():
    """A 200 carrying no content must not be published as a synthesised brief."""
    provider = OpenAICompatibleProvider(
        api_key="k", model="big", base_url="https://x/v1", fallbacks=["small"],
    )

    with patch("httpx.post", side_effect=[_response(200, "   "), _response(200, "real")]):
        assert provider.generate("q", max_tokens=100).text == "real"


def test_transport_errors_also_fall_through():
    """A dropped connection to one model should not end the attempt."""
    provider = OpenAICompatibleProvider(
        api_key="k", model="big", base_url="https://x/v1", fallbacks=["small"],
    )

    with patch("httpx.post", side_effect=[OSError("connection reset"), _response(200, "ok")]):
        assert provider.generate("q", max_tokens=100).text == "ok"


def test_base_url_trailing_slash_does_not_double_up():
    provider = OpenAICompatibleProvider(api_key="k", model="m", base_url="https://x/v1/")

    with patch("httpx.post", return_value=_response(200, "ok")) as post:
        provider.generate("q", max_tokens=10)

    assert post.call_args.args[0] == "https://x/v1/chat/completions"
