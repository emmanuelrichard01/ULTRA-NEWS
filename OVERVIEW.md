# Ultra News — what it is, in plain terms

Whether you're an engineer, a journalist, or just tired of reading the same
story fifteen times, this explains what this project does and why.

---

## The problem

When something happens, fifty outlets publish about it. Your feed shows you
fifty headlines and leaves you to work out that they're all one event — and, more
importantly, whether anyone has actually confirmed it or whether fifty outlets
are all repeating one unverified wire report.

That second question is the one that matters, and no feed answers it.

## What Ultra News does

It groups coverage of the same event into a single **story**, then tells you
**how many independent newsrooms stand behind it**.

That number is the whole product. Everything else exists to make it trustworthy:

- **Publishers, not articles.** One newsroom filing five updates is one source,
  not five. Two RSS feeds from the same publisher count once. A newsroom cannot
  corroborate itself.
- **Who broke it, and who followed.** Every story shows the outlets in the order
  they published, with the lag between them.
- **Whether it was independent.** Six outlets publishing within twenty minutes
  is consistent with one wire feeding everyone. Six over nine hours suggests
  newsrooms working separately. Both read as "six outlets" on a counter alone,
  so the story page shows the *shape* of the pickup.
- **Where they disagree.** Outlets covering identical facts choose different
  words. Their headlines are laid side by side, with words unique to one outlet
  marked.

## Three editions

Each is a different **ordering** of everything, not a slice — so none is ever
empty:

| Edition | What it shows |
| --- | --- |
| **The Wire** | Everything, newest first |
| **Developing** | Stories gaining independent outlets *right now* |
| **The Record** | Corroborated, ordered by weight of evidence |

"Developing" ranks by outlets that picked a story up in the last 12 hours, so a
story appears while it's accelerating and drops out once it settles.

The front page puts the two halves of the question side by side: the most recent
stories a second newsroom has **confirmed**, next to the most recent ones
**nobody has** — the same wire, the same hour, split by the only thing that
decides whether a count means anything. Beside them, what is being picked up
fastest right now.

A single-source story is not a doubtful one. Original investigative reporting
starts at one outlet by definition, and most items in that column are simply
early. What makes one worth a second look is how long it has stood alone, which
is what that column is ordered by.

## Ask the Wire Room

A question box that answers from the clustered reporting and names the outlets
it drew on. It respects corroboration: an answer resting on a single
unconfirmed source says so.

It runs **without any AI provider configured**, answering from the sources
directly. Paid inference is optional.

---

## What it does not claim

A high corroboration count is **not a truth score**. Ten outlets can repeat one
mistaken report — that is exactly what a corroboration count looks like when it
fails. A low count isn't a red flag either: original investigative reporting
starts at one outlet by definition.

Ultra News doesn't republish anyone's journalism. Every story shows a short
excerpt and links to the newsroom that wrote it.

---

## How it works

1. **Ingest** — every 15 minutes, workers poll RSS feeds. Conditional requests
   mean an unchanged feed costs one round trip with no body.
2. **Cluster** — each article is embedded locally and matched against recent
   stories by semantic similarity. The threshold is set by measurement, and
   deliberately errs toward leaving two related stories apart rather than
   merging unrelated ones.
3. **Corroborate** — as distinct publishers join, the count rises and the story
   moves up The Record.
4. **Synthesise** — multi-source stories get a machine-written brief that
   summarises agreement and, more usefully, flags contradiction. Always labelled
   as machine-written.

## Stack

Django + Celery + PostgreSQL (with pgvector) on the back; Next.js on the front;
`bge-small-en-v1.5` running locally for embeddings, so clustering and topic
classification cost nothing per article. Everything runs in Docker.

Full technical detail is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); the
method and its limits are documented at `/about` in the running app.
