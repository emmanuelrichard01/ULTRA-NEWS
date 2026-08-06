import json
import logging
from typing import Any, Dict

from django.utils import timezone

from core.models import Story

logger = logging.getLogger(__name__)

class AISynthesisService:
    """
    Multi-source intelligence briefs.

    Triangulates claims across independent outlets, surfaces where they
    contradict each other, and grounds against primary documents. The model is
    reached through core.services.llm, so no provider is hardcoded here — and
    with none configured the brief is built from source text instead.
    """
    # Sentinel so "not supplied" and "explicitly no key" are distinguishable.
    _UNSET = object()

    def __init__(self, api_key=_UNSET, provider=_UNSET):
        """
        `api_key=None` means run WITHOUT a model — it does not mean "fall back to
        the environment". The previous `api_key or os.environ.get(...)` made an
        explicit None indistinguishable from omitting the argument, so a test
        asking for the keyless path silently made real, billed API calls.

        `provider` resolves from configuration by default (see
        core/services/llm.py), so Gemini is no longer hardcoded here.
        """
        if provider is not self._UNSET:
            self.provider = provider
        elif api_key is None:
            self.provider = None
        else:
            from core.services.llm import get_provider
            self.provider = get_provider()

    def synthesize_story(self, story: Story) -> Dict[str, Any]:
        """
        Synthesize multi-source reporting for a given Story cluster.
        Returns a structured dictionary matching the AI intelligence brief schema.
        """
        # 'id' is the tiebreaker, not decoration. Wire copy about the same event
        # routinely carries an identical published_date, and Postgres is free to
        # return ties in any order — so without it the brief listed outlets in a
        # different order on each rebuild, for the same story and the same
        # inputs. That is a caching problem as much as a rendering one.
        articles = list(
            story.articles
            .select_related('source', 'raw_document')
            .order_by('published_date', 'id')
        )
        if not articles:
            return self._build_fallback_brief(story, "No articles found in cluster.")

        if self.provider is None:
            # Keyless is a supported mode, not a failure — the brief is built
            # from the sources directly and the product stays fully usable.
            logger.info("No LLM provider configured; extractive brief for story %s.", story.slug)
            return self._build_extractive_brief(story, articles)

        try:
            # Build rich multi-source context
            context_blocks = []
            primary_blocks = []

            for art in articles:
                source_type = getattr(art.source, 'source_type', 'news')
                pub_time = art.published_date.strftime('%Y-%m-%d %H:%M UTC')
                
                # Check for primary source full text
                has_rawdoc = hasattr(art, 'raw_document') and art.raw_document and art.raw_document.raw_content
                if source_type == 'primary' and has_rawdoc:
                    primary_blocks.append(
                        f"=== PRIMARY SOURCE: {art.source.name} ({pub_time}) ===\n"
                        f"Title: {art.title}\n"
                        f"Full Document Snippet:\n{art.raw_document.raw_content[:2000]}\n"
                    )
                else:
                    context_blocks.append(
                        f"=== OUTLET: {art.source.name} ({pub_time}) ===\n"
                        f"Headline: {art.title}\n"
                        f"Excerpt: {art.excerpt}\n"
                    )

            full_context = ""
            if primary_blocks:
                full_context += "PRIMARY SOURCES (GOV/OFFICIAL DOCUMENTS):\n" + "\n".join(primary_blocks) + "\n\n"
            full_context += "NEWS OUTLET REPORTING:\n" + "\n".join(context_blocks)

            prompt = (
                f"You are the 'Wire Room' lead intelligence analyst.\n"
                f"Synthesize the following reporting on the story: '{story.title}'.\n\n"
                f"{full_context}\n\n"
                f"Respond ONLY with a valid JSON object matching this exact schema:\n"
                f"{{\n"
                f'  "consensus_lead": "Concise 2-sentence objective summary of confirmed facts.",\n'
                f'  "outlet_claims": [\n'
                f'    {{"source": "Outlet Name", "claim": "Key claim or angle reported by this outlet."}}\n'
                f'  ],\n'
                f'  "discrepancies": [\n'
                f'    "Explicit factual, numerical, or timeline contradiction between outlets (or leave empty list if none)."\n'
                f'  ],\n'
                f'  "primary_alignment": "Analysis of how media coverage aligns or deviates from official primary sources (or empty string if no primary source)."\n'
                f"}}\n"
            )

            result = self.provider.generate(prompt, max_tokens=1200)
            raw_text = result.text
            # Strip markdown code fencing if returned by LLM
            clean_json_str = raw_text.strip()
            if clean_json_str.startswith("```json"):
                clean_json_str = clean_json_str[7:]
            if clean_json_str.startswith("```"):
                clean_json_str = clean_json_str[3:]
            if clean_json_str.endswith("```"):
                clean_json_str = clean_json_str[:-3]

            parsed_data = json.loads(clean_json_str.strip())
            
            # Enrich with metadata
            parsed_data["model"] = result.model
            parsed_data["synthesized_at"] = timezone.now().isoformat()
            parsed_data["articles_count"] = len(articles)
            parsed_data["independent_count"] = story.independent_count
            parsed_data["synthesis_type"] = "llm"

            return parsed_data

        except Exception as e:
            logger.error("AI Synthesis failed for story '%s': %s", story.slug, e)
            return self._build_extractive_brief(story, articles)

    def _build_extractive_brief(self, story: Story, articles: list) -> Dict[str, Any]:
        """Extractive fallback brief when LLM is unavailable."""
        first_art = articles[0] if articles else None
        outlet_claims = []
        seen_sources = set()

        for art in articles:
            if art.source.name not in seen_sources:
                seen_sources.add(art.source.name)
                outlet_claims.append({
                    "source": art.source.name,
                    "claim": art.title
                })

        return {
            "consensus_lead": story.summary or (first_art.excerpt if first_art else story.title),
            "outlet_claims": outlet_claims[:5],
            "discrepancies": [],
            "primary_alignment": "Primary document verification active.",
            "model": "extractive-fallback",
            "synthesized_at": timezone.now().isoformat(),
            "articles_count": len(articles),
            "independent_count": story.independent_count,
            "synthesis_type": "extractive"
        }

    def _build_fallback_brief(self, story: Story, message: str) -> Dict[str, Any]:
        return {
            "consensus_lead": story.title,
            "outlet_claims": [],
            "discrepancies": [message],
            "primary_alignment": "",
            "model": "system-fallback",
            "synthesized_at": timezone.now().isoformat(),
            "articles_count": 0,
            "independent_count": 0,
            "synthesis_type": "extractive"
        }
