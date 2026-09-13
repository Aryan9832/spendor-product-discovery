import express from "express";
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { hybridRank, inferSearchConstraints, rankCatalog } from "./retrieval.mjs";
import { createEmbeddings, cosineSimilarity } from "./embeddings.mjs";

const app = express();
const port = process.env.PORT || 8787;
const catalogPath = fileURLToPath(new URL("./data/catalog.json", import.meta.url));
const retailersPath = fileURLToPath(new URL("./data/retailers.json", import.meta.url));
const embeddingsPath = fileURLToPath(new URL("./data/embeddings.json", import.meta.url));
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));

app.use(express.json());

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", catalogSize: catalog.length, retrievalMode: "intent-aware fallback" });
});

async function loadEmbeddingMap() {
  try {
    await access(embeddingsPath);
    const stored = JSON.parse(await readFile(embeddingsPath, "utf8"));
    return new Map(stored.products.map((item) => [item.id, item.embedding]));
  } catch {
    return null;
  }
}

app.get("/api/products", async (request, response) => {
  const query = String(request.query.q || "");
  const series = String(request.query.series || "");
  const category = String(request.query.category || "");
  const room = String(request.query.room || "");
  const limit = Number(request.query.limit || 6);
  const inferred = inferSearchConstraints(query);

  let filteredCatalog = catalog
    .filter((product) => !series || product.series === series)
    .filter((product) => !category || product.category === category)
    .filter((product) => !room || product.roomSizes.includes(room));
  if (inferred.rooms.length) filteredCatalog = filteredCatalog.filter((product) => inferred.rooms.every((size) => product.roomSizes.includes(`${size[0].toUpperCase()}${size.slice(1)}`)));
  if (inferred.categories.length) filteredCatalog = filteredCatalog.filter((product) => inferred.categories.includes(product.category));
  let results = rankCatalog(filteredCatalog, query);
  let retrievalMode = "intent-aware fallback";
  const vectors = query ? await loadEmbeddingMap() : null;
  if (vectors && (process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY)) {
    try {
      const { vectors: [queryEmbedding] } = await createEmbeddings([query]);
      results = hybridRank(filteredCatalog, query, vectors, queryEmbedding, cosineSimilarity);
      retrievalMode = "hybrid: deterministic + embeddings";
    } catch (error) {
      console.warn("Hybrid retrieval unavailable; using fallback.", error.message);
    }
  }
  const totalMatches = results.length;
  if (query) results = results.slice(0, Math.max(1, Math.min(limit, 12)));

  response.json({
    data: results,
    meta: {
      query,
      count: results.length,
      totalMatches,
      appliedConstraints: inferred,
      retrievalMode,
      note: retrievalMode === "intent-aware fallback"
        ? "Set GEMINI_API_KEY and run npm run generate:embeddings to enable hybrid ranking."
        : "Ranking blends product facts with embedding similarity.",
    },
  });
});

app.get("/api/retailers", async (request, response) => {
  try {
    const directory = JSON.parse(await readFile(retailersPath, "utf8"));
    const q = String(request.query.q || "").trim().toLowerCase();
    const country = String(request.query.country || "").trim().toLowerCase();
    const retailers = directory.retailers.filter((retailer) => {
      const text = Object.values(retailer).join(" ").toLowerCase();
      return (!country || retailer.country.toLowerCase() === country) && (!q || text.includes(q));
    });
    response.json({ data: retailers, meta: { total: directory.retailers.length, count: retailers.length, refreshedAt: directory.refreshedAt } });
  } catch {
    response.status(503).json({ error: "Retailer directory has not been imported yet. Run npm run import:retailers." });
  }
});

app.listen(port, () => {
  console.log(`Spendor API listening at http://localhost:${port}`);
});
