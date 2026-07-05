# 🎨 ULTRA-NEWS V3 — UI/UX Design System & Experience Specification

> Companion to `ultra-news-v3-architecture.md`. Where that document specifies how stories get deduplicated and clustered, this one specifies how that clustering actually *looks and feels* to a reader. The two are meant to be read together — several sections below reference architecture decisions directly (§6 in particular).

---

## 0. Premise

The architecture's real differentiator isn't "we show articles" — it's "we know that 12 outlets are covering the same event, and we've collapsed that into one verified story." Most news-aggregator UIs never surface that fact; they just show a flat list of cards that happen to be deduplicated on the backend, and the reader never sees *why* the product is trustworthy. That's the gap this design closes: the multiplicity and convergence of sources becomes a first-class, visible part of the interface, not a hidden backend detail.

---

## 1. Signature Concept: "The Wire Room"

**The idea in one sentence:** the visual language borrows from the wire service — the historical AP/Reuters newsroom where multiple incoming feeds converged into one verified report — because that convergence is literally what the ingestion pipeline does, not because "news = newspaper."

This is deliberately *not* a broadsheet pastiche (hairline rules, dense columns, zero border-radius). That look signals a single publisher's editorial authority. This product's authority comes from somewhere else — the visible act of triangulating many sources — so the design's one signature element is built around that instead:

**The Corroboration System** — every story that has more than one source gets a visible, physical sense of "stacked evidence": source cards fan out slightly behind the primary card (a literal stack), and a small signal-bar meter states the count and confidence in numerals. Card stacking and the meter are two expressions of the same fact, used together everywhere a story appears — feed, cluster page, search results.

This is the one place the design takes a real risk. Everything else stays quiet and disciplined around it.

---

## 2. Design Tokens

### 2.1 Color

| Token | Hex | Role |
|---|---|---|
| `ink` | `#12141C` | Primary text (light mode), primary surface (dark mode) — a blue-black, not a flat `#000` |
| `paper` | `#F7F5F0` | Primary surface (light mode) — warm off-white, easier on the eyes than stark white for long reading sessions and outdoor mobile glare |
| `signal-amber` | `#E8A33D` | **Functional, not decorative**: "developing" state — 1–2 sources, still unfolding |
| `verified-teal` | `#1F7A6C` | **Functional**: "corroborated" state — 3+ independent sources agree |
| `wire-red` | `#C4432B` | Breaking/urgent flag only. Used as a fill with paper/white text, never as small body text — spend this color sparingly or it stops meaning "urgent" |
| `slate` | `#5B6472` | Secondary text, metadata, dividers |

Verified contrast ratios (WCAG 2.1):
- `ink` on `paper`: **16.9:1** — exceeds AAA, safe for all body text.
- `slate` on `paper`: **5.5:1** — passes AA for normal text.
- `verified-teal` on `paper`: **4.76:1** — passes AA; use for badges/icons/large text rather than small captions.

Amber and teal aren't chosen for "vibe" — they map directly onto `Article.status` / `Story.source_count` in the architecture doc. If a designer or future contributor changes these colors, they need to know they're changing what a status *means*, not just a swatch.

### 2.2 Typography — three roles, each doing a different job

| Role | Typeface | Used for |
|---|---|---|
| Display / editorial | **Fraunces** (variable) | Headlines, hero story titles, pull quotes — large sizes, tight tracking. Warm, slightly idiosyncratic serif; carries the "editorial" voice |
| Body / interface | **Geist** | Body copy, nav, buttons, form fields — built for screen legibility at UI sizes |
| Data / telemetry | **IBM Plex Mono** | Timestamps, source counts, bylines, live indicators, admin dashboard. **This is a structural device, not decoration** — monospace consistently means "machine-verified fact" throughout the product, so a reader unconsciously learns to trust a mono-set number more than a headline claim |

Type scale (fluid, `clamp()`-based so it degrades gracefully on small screens):

| Token | Size | Use |
|---|---|---|
| `display-xl` | `clamp(2.25rem, 4vw+1rem, 3.5rem)` | Hero headline |
| `display-md` | `clamp(1.5rem, 2vw+1rem, 2.25rem)` | Story cluster headline |
| `body-lg` | `1.125rem / 1.7` | Article/summary body |
| `body-md` | `1rem / 1.6` | Card copy, UI text |
| `caption` | `0.8125rem` (mono) | Metadata, timestamps, source counts |

All three fonts are open (OFL) and on Google Fonts — no licensing friction.

### 2.3 Spacing, Radius, Elevation

- **Spacing**: 8px base grid (`4, 8, 12, 16, 24, 32, 48, 64`) — matches Tailwind's default scale, no custom config needed.
- **Radius**: small and deliberate — `6px` for cards, `4px` for chips/pills. Not the fully-rounded "friendly SaaS" bubble corners; this reads closer to a printed index card than an app icon, which suits a journalism product's credibility.
- **Elevation**: shadows are functional, used almost exclusively to create the fanned-stack illusion (§5) — two or three offset card silhouettes at decreasing opacity, not generic drop-shadows on every surface.

---

## 3. Information Architecture

```
/                          Home (For You / Latest / Trending tabs)
/story/[storyId]           Story Cluster Detail — the aggregated view
/story/[storyId]/[source]  Individual source excerpt + outbound link
/category/[slug]           Category feed
/search?q=                 Search results
/topic-picker              Onboarding: pick interests (feeds personalization)
/saved                     Bookmarked stories
/settings                  Account, Data Saver, notification prefs
/admin/sources             Internal: source health dashboard (§4.7)
```

Flat and shallow on purpose — a reader should never be more than two taps from any story. No nested category trees, no nav mega-menus.

---

## 4. Page Specifications

### 4.1 Home / Feed

**Mobile** (primary target — bandwidth and screen-size assumptions favor mobile-first):

```
┌─────────────────────────┐
│ ULTRA·NEWS       ☰   🔍  │  masthead, mono wordmark
├─────────────────────────┤
│▌BREAKING: headline text →│  wire-red left bar, marquee
├─────────────────────────┤
│ For You │ Latest │ Trend │  tab bar
├─────────────────────────┤
│ ┌ ▓▓ fanned stack ─────┐ │
│ │  [hero photo]         │ │
│ │  TECH                 │ │  category pill (mono caption)
│ │  Large headline (Fraunces)
│ │  ●●●●○  4 sources      │ │  corroboration meter
│ │  12m ago · AP + 3      │ │  mono metadata
│ └───────────────────────┘ │
│  (repeat: standard cards) │
└─────────────────────────┘
```

**Desktop**: same card river in a 2-column grid, plus a right-hand **Signal Panel** — trending clusters as a compact live-updating list, mono-set counts ticking in real time via the SSE channel from §6/§9 of the architecture doc.

### 4.2 Story Cluster Detail

The page that actually sells the product. Structure, top to bottom:
1. Headline (Fraunces, `display-md`+) and AI-generated one-paragraph summary, clearly labeled "AI summary" — never presented as if it were a human editor's words.
2. Corroboration meter at full size, with the exact source count and first-seen timestamp (mono).
3. **Source list** — every contributing outlet as its own row: outlet name/logo, its specific angle/excerpt (≤40 words, per the architecture's excerpt-only model — §13.1), and a clear "Read at [Outlet]" outbound button. This is the moment the excerpt-not-full-text decision becomes visible UX, not just a legal footnote.
4. Related stories (semantic, via `pgvector` similarity — architecture §5).

### 4.3 Source Article (Outbound Interstitial)

Not a full mirrored article page. A single excerpt card plus a prominent, unambiguous outbound link. The copy is direct: *"Read the full story at Reuters"* — never a disguised or delayed redirect. This is a trust move as much as a legal one (§13.1).

### 4.4 Category

Same card river as Home, scoped to one category, with a sticky sub-nav for related categories.

### 4.5 Search

Meilisearch/Typesense-backed instant search (§1 of the architecture doc) — results stream in as-you-type, faceted by category/date/source. Empty state is a real prompt ("Try a topic, outlet, or person") not a blank void.

### 4.6 Onboarding — Topic Picker

A single screen, large tappable category pills, 3–7 selections required to proceed. Feeds `UserPreference` directly (architecture §3). Skippable — never gate the core product behind setup.

### 4.7 Admin — Source Health Dashboard

Deliberately different register from the reader-facing product: **mono-forward**, data-dense, table-based. This is the one screen where the "wire room" concept is literal rather than metaphorical — operators watching feed health, fetch success rate, circuit-breaker status per `Source` (architecture §8). No Fraunces here; this is an instrument panel, not a reading experience.

---

## 5. Component Library

| Component | Notes |
|---|---|
| **Story Card** (standard + hero) | Image, category pill, Fraunces headline, corroboration meter, mono metadata line |
| **Fanned Stack** | 2–3 offset card silhouettes behind the primary card, opacity-decreasing, only rendered when `source_count > 1` — this is what makes "multiple sources" legible at a glance, before any text is read |
| **Corroboration Meter** | 5-segment signal-bar indicator. 1–2 filled = amber ("Developing"), 3+ filled = teal ("Corroborated"), always paired with the exact mono-set number — never bars alone, since bars alone are ambiguous |
| **Source Chip** | Outlet name + small favicon, used in source lists and search facets |
| **Category Pill** | Mono caption, low-emphasis background |
| **Breaking Ticker** | Marquee, wire-red accent bar, reduced-motion-aware (pauses/becomes static list if `prefers-reduced-motion`) |
| **Skeleton Loaders** | Shape-matched to the exact component they replace — see §6, these are not generic gray boxes, they're the Suspense fallback UI |
| **Data Saver Toggle** | Settings + first-run prompt on detected slow connection (`navigator.connection.effectiveType`); see §10 |
| **Save/Bookmark**, **Share Sheet** | Standard patterns, kept deliberately unremarkable — not every component needs to be a design statement |

---

## 6. PPR Boundary Map — where design meets architecture

This is the direct translation of the architecture doc's Next.js 16 Cache Components strategy (§6) into concrete UI decisions. Get this mapping right and the perceived-performance win is real; get it wrong and you've just added complexity for nothing.

| Static shell (prerendered, edge-cached) | Dynamic hole (inside `<Suspense>`, streamed) |
|---|---|
| Masthead, nav, category pills, footer | "For You" personalized rail (depends on session) |
| Story card layout, images, headlines, excerpts | Live corroboration count (can tick up after page load) |
| Category/search page chrome | Breaking ticker content (SSE-driven) |
| — | Bookmark/save button state (depends on auth) |

Practical rule for implementation: **the skeleton loader for each dynamic hole should be the exact shape of the real component**, sized correctly, so there's no layout shift when the stream resolves — a gray corroboration-meter-shaped skeleton, not a generic shimmer block.

---

## 7. Motion

Sparse, purposeful, and always secondary to content — per the principle that extra animation is usually what makes a design read as generic or AI-generated. Three moments, and only three:

1. **Corroboration meter increment** — when a new source joins a story in real time (SSE push), the meter ticks up with a brief, small scale-pulse. This is the single most important animation in the product because it's the only one tied to something actually happening.
2. **Breaking ticker marquee** — continuous, slow, pausable on hover/focus.
3. **Fanned-stack parallax** — a 2–4px shift on scroll, barely perceptible, reinforcing the "physical stack of papers" read.

Everything else — page transitions, hovers, taps — is a fast (150–200ms), simple opacity/transform, no bounce or elastic easing. All motion respects `prefers-reduced-motion`: ticker becomes a static list, meter increments without the pulse, parallax is disabled entirely.

---

## 8. Responsive Strategy

Mobile-first, not mobile-adapted. Breakpoints follow Tailwind defaults (`sm 640 / md 768 / lg 1024 / xl 1280`). The right-rail Signal Panel (§4.1) only appears at `lg`+ — it's an enhancement for spare desktop width, never a place dynamic content is exclusively rendered, so mobile never loses functionality, only a convenience panel.

---

## 9. Accessibility

- Color is never the only signal: the corroboration meter always pairs color with a numeral and a text label ("Developing" / "Corroborated"), so it reads correctly for color-blind users and in Data Saver mode with color stripped.
- Visible keyboard focus rings on every interactive element (a 2px `verified-teal` outline, offset 2px).
- All contrast ratios verified against WCAG AA at minimum (§2.1).
- `prefers-reduced-motion` respected everywhere motion appears (§7).
- Semantic HTML first — `<article>` per story card, proper heading hierarchy, outbound links marked with accessible names that include the outlet ("Read full story at Reuters," not a bare "Read more").

---

## 10. Dark Mode & Data Saver Mode — both first-class, not afterthoughts

**Dark mode**: `ink` and `paper` simply swap roles as surface/text; amber, teal, and red are already tuned to work on both (verify contrast on dark surfaces during implementation the same way §2.1 was verified on light).

**Data Saver mode** (ties to architecture §12): a real, functional feature reflecting the target market's variable mobile network conditions, not a decorative gesture —
- Images replaced with low-res placeholders or omitted entirely (text-only cards).
- Fonts fall back to system stack (no webfont download).
- All motion disabled.
- Auto-suggested on detected slow connections, always available as a manual toggle in Settings regardless of detected speed.

---

## 11. Engineering Handoff — Tailwind v4 Token Mapping

```css
/* globals.css — Tailwind v4 theme layer */
@theme {
  --color-ink: #12141C;
  --color-paper: #F7F5F0;
  --color-signal-amber: #E8A33D;
  --color-verified-teal: #1F7A6C;
  --color-wire-red: #C4432B;
  --color-slate: #5B6472;

  --font-display: "Fraunces", ui-serif, serif;
  --font-body: "Geist", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;

  --radius-card: 6px;
  --radius-chip: 4px;
}
```

Load fonts via `next/font/google` (both `Geist` and `IBM Plex Mono` are natively supported; `Fraunces` too) rather than a `<link>` tag — this gets automatic self-hosting, no layout shift, and no third-party request at runtime.

---

## 12. Self-Critique — What Was Deliberately Avoided

Being explicit about this because it's the difference between a choice and a default:

- **Not** warm-cream-background + high-contrast-serif + terracotta accent (the current AI-generated-design default #1) — too soft/lifestyle-brand for a product whose value is rigor and verification.
- **Not** near-black + single acid accent (default #2) — this palette uses *two* functional accents tied to real product states (amber/teal), not one decorative one, specifically to avoid landing here.
- **Not** broadsheet hairline-rule newspaper pastiche (default #3) — the tempting default for "news," and rejected on purpose: it signals a single publisher's authority, which isn't this product's actual value proposition. The fanned-stack/corroboration system replaces it with something that encodes the *real* mechanism (multi-source convergence) instead of cosplaying a print newspaper.
- **Not** numbered "01 / 02 / 03" section markers anywhere in the actual product UI — reserved that device for the ingestion *pipeline* description in the architecture doc, where the steps are a genuine sequence. Nothing in this UI is being falsely presented as a sequence.
