# Search evaluation guide

## Why this exists

The project must not claim that semantic or hybrid search is better just because it feels better. This evaluation set is the proof mechanism: every retrieval strategy runs against the same approved customer-style queries.

## What a reviewed case needs

Each row should include:

| Field | Example |
|---|---|
| Query | `I need a compact speaker for a small room` |
| Relevant product IDs | `a1-2`, `classic-4-5`, `ds1` |
| Relevance grade | 3 = ideal, 2 = suitable, 1 = acceptable |
| Reason | Product dimensions/type/placement guidance that supports the choice |
| Reviewer | Spendor product reviewer |
| Review date | Date the recommendation was approved |

## Metrics used

- **Hit@5:** Did at least one relevant product appear in the first five results?
- **MRR@5:** How close to first place was the first relevant result? A correct first result scores 1.0; a correct fifth result scores 0.2.
- **NDCG@5:** The final metric once relevance grades are available. It rewards putting ideal recommendations above merely acceptable ones.

## How to run the baseline

```bash
npm run evaluate
```

The current cases are draft sanity checks only. Do not show their resulting metrics externally until at least 75 product-team-reviewed queries replace them.

## Compare the baseline with hybrid retrieval

```bash
npm run evaluate:hybrid
```

This command uses the stored catalog embeddings and Gemini query embeddings. It is intentionally separate from the no-cost baseline report so the contribution of semantic similarity is visible.
