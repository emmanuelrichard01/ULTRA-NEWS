from unittest.mock import MagicMock

import pytest
from django.core.cache import cache
from django.utils import timezone

from core.models import Article, Source, Story
from core.services.synthesis import AISynthesisService


@pytest.fixture(autouse=True)
def clear_cache():
    cache.clear()

@pytest.fixture
def test_story():
    now = timezone.now()
    src1 = Source.objects.create(name="Reuters", url="http://reuters.com", source_type="news")
    src2 = Source.objects.create(name="BBC News", url="http://bbc.co.uk", source_type="news")
    
    story = Story.objects.create(
        title="Central Bank Announces Monetary Policy Shift",
        slug="cbn-policy-shift",
        first_seen_at=now,
        source_count=2,
        independent_count=2,
        status=Story.Status.DEVELOPING,
    )
    
    Article.objects.create(
        source=src1,
        title="Central Bank Raises Interest Rates by 100 bps",
        slug="reuters-cbn-rate",
        url="http://reuters.com/1",
        excerpt="The central bank increased the benchmark interest rate to curb persistent inflation.",
        published_date=now,
        story=story,
    )
    
    Article.objects.create(
        source=src2,
        title="Apex Bank Holds Benchmark Rate Steady at 27.25%",
        slug="bbc-cbn-rate",
        url="http://bbc.co.uk/1",
        excerpt="Monetary policy committee members voted to maintain borrowing costs unchanged.",
        published_date=now,
        story=story,
    )
    
    return story

@pytest.mark.django_db
def test_extractive_fallback_brief(test_story):
    # Service without LLM API key generates extractive fallback
    service = AISynthesisService(api_key=None)
    result = service.synthesize_story(test_story)
    
    assert result["synthesis_type"] == "extractive"
    assert len(result["outlet_claims"]) == 2
    assert result["outlet_claims"][0]["source"] == "Reuters"
    assert result["outlet_claims"][1]["source"] == "BBC News"

@pytest.mark.django_db
def test_llm_synthesis_parses_a_model_response(test_story):
    """
    The synthesis path, independent of which vendor answered.

    This used to patch `google.genai.Client` directly, which coupled it to one
    adapter's internals: when the default provider changed, the mock stopped
    intercepting anything and the test made a REAL request to a live API. Inject
    a provider instead — it is what the `provider=` argument exists for, and it
    cannot reach the network.
    """
    mock_llm_json = """{
      "consensus_lead": "The Central Bank announced major policy adjustments regarding inflation.",
      "outlet_claims": [
        {"source": "Reuters", "claim": "Reports a 100 bps rate hike."},
        {"source": "BBC News", "claim": "Reports rates were held steady."}
      ],
      "discrepancies": [
        "Conflicting reports: Reuters states rates increased while BBC reports rates were held steady."
      ],
      "primary_alignment": "Pending official release."
    }"""
    
    from core.services.llm import LLMResponse

    stub = MagicMock()
    stub.name = "stub"
    stub.generate.return_value = LLMResponse(text=mock_llm_json, model="stub-model")

    result = AISynthesisService(provider=stub).synthesize_story(test_story)

    assert result["synthesis_type"] == "llm"
    assert "Central Bank announced" in result["consensus_lead"]
    assert len(result["discrepancies"]) == 1
    assert "Conflicting reports" in result["discrepancies"][0]
    assert stub.generate.called

@pytest.mark.django_db
def test_synthesize_task_idempotency_and_circuit_breaker(test_story):
    from core.tasks import synthesize_story_brief
    
    # 1. Test task execution
    synthesize_story_brief(test_story.id)
    test_story.refresh_from_db()
    
    assert test_story.synthesis_status == Story.SynthesisStatus.COMPLETED
    assert test_story.ai_summary is not None
    assert test_story.synthesized_at is not None
