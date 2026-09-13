# Spendor Product Discovery Platform - interviewer walkthrough

## One-sentence description

I built an approved product-discovery prototype for Spendor that turns structured loudspeaker specifications into a browsable catalog and a natural-language search experience. I designed it as a trustworthy catalog-data system first, then layered smarter retrieval on top.

## Step 1 - establish the data source and publication boundary

**What I did:** With explicit company approval, I separated public-source extraction from production catalog data. The importer in `scripts/import-spendor-public-catalog.mjs` archives approved public source pages with the import time, source URLs, product links, PDF links, and discovered media URLs. The prototype uses exact official product images for seeded products.

**Why:** This remains a private interview portfolio project. A scraper is useful for bootstrap and change detection, but it should not silently change a catalog without review.

**Say this in an interview:** “I treated ingestion as a governed data pipeline. Public pages are source evidence; approved product records are the application’s source of truth.”

## Step 2 - model the catalog as structured data

**What I did:** I created a seed catalog in `server/data/catalog.json`. Each product keeps its series, category, technical specifications, finishes, curated room-size tags, source URL, and search terms.

**Why:** A product finder needs hard constraints such as product type and amplifier range. An LLM or embedding alone should not invent product facts or overrule those constraints.

**Say this in an interview:** “I kept facts structured so filters are deterministic, auditable, and fast. The natural-language layer only improves discovery.”

## Step 3 - build a transparent retrieval baseline

**What I did:** The Express API exposes `GET /api/products` with deterministic filters and an intent-aware ranking fallback. It identifies terms such as `small room`, `bookshelf`, `floorstanding`, and `theatre`, ranks matching curated tags, and returns human-readable match reasons.

**Why:** This creates a testable baseline before introducing embeddings. The UI never pretends that a weak keyword match is a magical AI result.

**Say this in an interview:** “Before adding vector search, I built an explainable baseline. That lets me measure whether embeddings actually improve results.”

**How I verify it:** `server/data/evaluation.json` holds draft relevance cases and `test/retrieval.test.mjs` verifies core expected ranking behavior. The next step is replacing the draft cases with product-team-reviewed cases and reporting offline quality metrics.

**Repeatable report:** `npm run evaluate` reports Hit@5 and MRR@5 for the same evaluation cases on every change.

## Step 4 - create the product experience

**What I did:** The React app combines a natural-language search box with product-line, type, and room-size filters. Results use approved official product imagery, link back to official source pages, and open a structured detail view instead of hiding facts inside generated prose.

**Why:** It demonstrates a real constraint: branded product media must be deliberately approved and mapped to the correct product, rather than substituted with random images.

**Say this in an interview:** “The interface exposes both free-form intent and technical constraints, and each result retains product provenance.”

**Shortlisting:** Users can compare up to two products in a fact-only comparison surface. This makes the system useful after discovery without asking the language model to invent differences between products.

## Step 5 - measure search quality before claiming semantic search

**Next work:** Build a reviewed evaluation set of at least 75 dealer/customer-style queries. Each query needs relevant product IDs, relevance grades, reviewer, and notes. Measure Recall@5 and NDCG@5 for the baseline, hybrid retrieval, and embedding retrieval.

**Why:** “Semantic search” is only a useful claim if it demonstrably improves recommendation quality.

**Say this in an interview:** “I would not ship or claim an AI search system without a relevance set and an offline evaluation loop.”

## Step 6 - add evaluated hybrid retrieval

**What I did:** The backend now supports a server-side Gemini embeddings integration. `npm run generate:embeddings` creates a local, ignored vector cache from the approved product catalog. At search time, if both the cache and `GEMINI_API_KEY` are available, the API blends deterministic catalog ranking with embedding similarity; otherwise it uses the explainable fallback.

**Why:** The key never reaches the browser. The fallback makes local review possible without API access, while hybrid retrieval keeps hard product constraints alongside natural-language similarity.

**Say this in an interview:** “I designed semantic search as an optional, observable retrieval layer rather than letting a model invent product recommendations. The system degrades safely when embeddings are unavailable.”

## Step 7 - productionize

**Next work:** Move the reviewed catalog to PostgreSQL, add migrations and admin review workflow, store embeddings with pgvector, use hybrid full-text plus vector retrieval, add auth for staff workflows, instrument latency and zero-result searches, and deploy staging/production environments.

**Say this in an interview:** “The prototype validates the product and data model. The next milestone replaces seed JSON with PostgreSQL and adds evaluated hybrid retrieval, observability, and governed updates.”

## Architecture today

```text
Approved public Spendor pages
          |
          v
Reviewable source archive (import script)
          |
          v
Approved seed catalog JSON  --->  Express API  --->  React product finder
                                      |
                                      v
                         Explainable intent-aware ranking
```

## What is intentionally not claimed yet

- No live price, stock, dealer, customer, or private business data.
- No unapproved product photos or brand media in the UI.
- No claim that the present baseline is embedding-based semantic search.
- No performance percentage until a documented benchmark exists.
# Spendor Product Discovery — interview walkthrough

## What I built

This is a private, permissioned portfolio project for Spendor Audio. It is a product-discovery experience rather than a visual catalog: it supports structured filtering, semantic search, product comparison, full product pages, specification PDFs, a searchable authorised-retailer directory and a contact journey.

## The walkthrough

1. **Model the source data.** I imported the 19 current products from the public Spendor site into one structured catalog. Each model carries its range, product format, room suitability, technical specifications, media URL and direct specification-PDF URL.
2. **Make browsing deliberate.** The homepage groups the collection by A-Line, D-Line and Classic before users reach the product finder. Filters represent hard constraints such as room size and format, so a “small room” request cannot be answered with a large-only model.
3. **Add semantic retrieval carefully.** The search service combines product-fact matching with Gemini embedding similarity when embeddings are configured. It keeps deterministic constraints in the loop and explains the retrieval mode rather than pretending every result is AI magic.
4. **Create a complete product journey.** Selecting a speaker opens a dedicated page with its key technical details, current-price request flow, a direct official specification PDF and an audition call-to-action.
5. **Treat the dealer network as data.** `npm run import:retailers` crawls Spendor’s public dealer sitemap and turns the detail pages into a 121-record searchable directory. It is refreshable, so the front end is not built around stale copied text.
6. **Handle enquiries honestly.** The contact form validates the user’s message and opens their email client addressed to Spendor. It deliberately does not claim to send or store enquiries without a real approved CRM or email service.

## Honest limits and next production steps

- Prices are shown as retailer-led because Spendor’s current public product pages direct customers to authorised retailers instead of publishing one global price list. A production version would add region-specific pricing only from a company-approved price feed.
- The directory is public-source data and has a refresh command. A production version would automate this with a scheduled job and a review queue for changed records.
- Before public release, replace remote public media links with approved, licensed asset delivery; wire the contact flow to an approved CRM; and review privacy, accessibility and analytics.
