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
    assert provider.models[0] == "openai/gpt-oss-120b"
    assert provider.models[-1] == "openai/gpt-oss-20b"


@pytest.mark.parametrize("name", ["groq", "cerebras", "openrouter"])
def test_no_preset_points_at_a_retired_llama_model(name):
    """
    Groq retired llama-3.3-70b-versatile and llama-3.1-8b-instant on
    2026-08-16; Cerebras and OpenRouter's free tier dropped theirs in the same
    window. Every call 404'd while the logs said the key was fine. Pin that the
    presets moved.
    """
    from core.services.llm import _PRESETS

    preset = _PRESETS[name]
    for model in (preset.model, *preset.fallbacks):
        assert "llama-3" not in model and "llama3" not in model, (name, model)


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


# ==========================================================================
# Reasoning models, roles and JSON mode
# ==========================================================================

def test_reasoning_model_gets_low_effort_and_headroom_on_groq():
    """
    gpt-oss thinks before it answers, and the thinking is billed against the
    same cap. Sent the old cap unchanged, a hard question could spend it all on
    reasoning and come back empty.
    """
    provider = OpenAICompatibleProvider(
        api_key="k", model="openai/gpt-oss-120b", base_url="https://x/v1", flavor="groq",
    )
    with patch("httpx.post", return_value=_response(200, "ok")) as post:
        provider.generate("q", max_tokens=400)

    body = post.call_args.kwargs["json"]
    assert body["reasoning_effort"] == "low"
    assert body["include_reasoning"] is False
    assert body["max_tokens"] > 400


def test_plain_model_gets_no_reasoning_parameters():
    """Unknown parameters are a 400 on strict servers; only send them where they apply."""
    provider = OpenAICompatibleProvider(api_key="k", model="llama3", base_url="https://x/v1")
    with patch("httpx.post", return_value=_response(200, "ok")) as post:
        provider.generate("q", max_tokens=100)

    body = post.call_args.kwargs["json"]
    assert "reasoning_effort" not in body
    assert body["max_tokens"] == 100


def test_system_message_is_sent_in_its_own_role():
    """Instructions and untrusted text must not share a role."""
    provider = OpenAICompatibleProvider(api_key="k", model="m", base_url="https://x/v1")
    with patch("httpx.post", return_value=_response(200, "ok")) as post:
        provider.generate("reader text", max_tokens=10, system="rules")

    messages = post.call_args.kwargs["json"]["messages"]
    assert messages == [
        {"role": "system", "content": "rules"},
        {"role": "user", "content": "reader text"},
    ]


def test_json_mode_is_dropped_for_a_server_that_rejects_it():
    """
    Older local servers 400 on `response_format`. Losing the constraint is
    recoverable — the brief parser tolerates fenced JSON — skipping a working
    model is not.
    """
    provider = OpenAICompatibleProvider(api_key="", model="m", base_url="http://x/v1")
    with patch("httpx.post", side_effect=[_response(400), _response(200, '{"a": 1}')]) as post:
        result = provider.generate("q", max_tokens=10, json_mode=True)

    assert result.text == '{"a": 1}'
    first, second = (c.kwargs["json"] for c in post.call_args_list)
    assert first["response_format"] == {"type": "json_object"}
    assert "response_format" not in second


# ==========================================================================
# Streaming
# ==========================================================================

class _StreamCtx:
    """Stands in for `httpx.stream(...)`: a context manager yielding a response."""

    def __init__(self, status: int, lines: list[str] | None = None):
        self.response = MagicMock()
        self.response.status_code = status
        self.response.iter_lines.return_value = iter(lines or [])
        self.closed = False

    def __enter__(self):
        return self.response

    def __exit__(self, *exc):
        self.closed = True


def _sse(content=None, reasoning=None):
    import json

    delta = {}
    if content is not None:
        delta["content"] = content
    if reasoning is not None:
        delta["reasoning"] = reasoning
    return "data: " + json.dumps({"choices": [{"delta": delta}]})


def test_stream_yields_content_and_drops_reasoning():
    provider = OpenAICompatibleProvider(api_key="k", model="m", base_url="https://x/v1")
    ctx = _StreamCtx(200, [
        _sse(reasoning="thinking…"), _sse("Talks "), "", _sse("resumed [1]."), "data: [DONE]",
    ])
    with patch("httpx.stream", return_value=ctx):
        stream = provider.stream("q", max_tokens=10)
        text = "".join(stream)

    assert stream.model == "m"
    assert text == "Talks resumed [1]."
    assert ctx.closed


def test_stream_falls_back_before_the_first_token():
    """A dead primary costs one round trip, not the answer."""
    provider = OpenAICompatibleProvider(
        api_key="k", model="big", base_url="https://x/v1", fallbacks=["small"],
    )
    dead, alive = _StreamCtx(429), _StreamCtx(200, [_sse("ok"), "data: [DONE]"])
    with patch("httpx.stream", side_effect=[dead, alive]):
        stream = provider.stream("q", max_tokens=10)
        assert "".join(stream) == "ok"

    assert stream.model == "small"
    assert dead.closed


def test_a_stream_that_opens_but_says_nothing_falls_through():
    provider = OpenAICompatibleProvider(
        api_key="k", model="big", base_url="https://x/v1", fallbacks=["small"],
    )
    silent = _StreamCtx(200, ["data: [DONE]"])
    alive = _StreamCtx(200, [_sse("ok"), "data: [DONE]"])
    with patch("httpx.stream", side_effect=[silent, alive]):
        stream = provider.stream("q", max_tokens=10)

    assert stream.model == "small"


def test_stream_with_every_model_down_raises_unavailable():
    provider = OpenAICompatibleProvider(api_key="k", model="m", base_url="https://x/v1")
    with patch("httpx.stream", return_value=_StreamCtx(503)), pytest.raises(LLMUnavailable):
        provider.stream("q", max_tokens=10)
