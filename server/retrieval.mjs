const intentTerms = {
  "small room": ["small room", "compact", "apartment", "near field"],
  "large room": ["large room", "floorstanding", "high power"],
  bookshelf: ["bookshelf", "stand mount", "compact"],
  floorstanding: ["floorstanding"],
  theatre: ["home theatre", "multi channel", "centre", "center"],
  wall: ["wall mount", "surface"],
};

const ignoredQueryTerms = new Set(["best", "speaker", "speakers", "for", "the", "a", "an", "with", "and", "to", "in", "of"]);

function normalise(value = "") {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function scoreProduct(product, query) {
  const q = normalise(query);
  if (!q) return { score: 0, reasons: [] };

  const haystack = normalise([
    product.model,
    product.series,
    product.category,
    product.summary,
    ...product.searchTerms,
    ...product.roomSizes,
  ].join(" "));
  const reasons = [];
  let score = 0;

  for (const token of q.split(" ").filter((word) => word.length > 2 && !ignoredQueryTerms.has(word))) {
    if (haystack.includes(token)) {
      score += 2;
      reasons.push(`matches “${token}”`);
    }
  }

  for (const [intent, terms] of Object.entries(intentTerms)) {
    if (q.includes(intent) || terms.some((term) => q.includes(term))) {
      const matched = terms.find((term) => haystack.includes(term));
      if (matched) {
        score += 4;
        reasons.push(`fits ${intent}`);
      }
    }
  }

  return { score, reasons: [...new Set(reasons)].slice(0, 3) };
}

export function inferSearchConstraints(query) {
  const normalized = normalise(query);
  const rooms = ["small", "medium", "large"].filter((room) => normalized.includes(`${room} room`));
  const categories = [];
  if (/\b(centre|center|home theatre|home theater)\b/.test(normalized)) categories.push("Centre");
  if (/\b(wall mount|on wall|surround)\b/.test(normalized)) categories.push("Wall-mount");
  if (/\bfloorstanding\b/.test(normalized)) categories.push("Floorstanding");
  if (/\b(bookshelf|stand mount)\b/.test(normalized)) categories.push("Stand-mount");
  return { rooms, categories };
}

export function rankCatalog(products, query) {
  return products
    .map((product) => ({ ...product, retrieval: scoreProduct(product, query) }))
    .sort((a, b) => b.retrieval.score - a.retrieval.score || a.model.localeCompare(b.model));
}

export function hybridRank(products, query, vectorByProductId, queryEmbedding, dotProduct) {
  const lexical = rankCatalog(products, query);
  const maxLexicalScore = Math.max(1, ...lexical.map((product) => product.retrieval.score));
  return lexical
    .map((product) => {
      const embedding = vectorByProductId.get(product.id);
      const vectorScore = embedding ? dotProduct(queryEmbedding, embedding) : 0;
      const lexicalScore = product.retrieval.score / maxLexicalScore;
      return {
        ...product,
        retrieval: {
          ...product.retrieval,
          lexicalScore,
          vectorScore,
          score: (0.45 * lexicalScore) + (0.55 * vectorScore),
          mode: "hybrid",
        },
      };
    })
    .sort((a, b) => b.retrieval.score - a.retrieval.score || a.model.localeCompare(b.model));
}
