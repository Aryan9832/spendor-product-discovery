import { readFile } from "node:fs/promises";
import { createEmbeddings, cosineSimilarity } from "../server/embeddings.mjs";
import { hybridRank, rankCatalog } from "../server/retrieval.mjs";

const catalog = JSON.parse(await readFile(new URL("../server/data/catalog.json", import.meta.url), "utf8"));
const stored = JSON.parse(await readFile(new URL("../server/data/embeddings.json", import.meta.url), "utf8"));
const evaluation = JSON.parse(await readFile(new URL("../server/data/evaluation.json", import.meta.url), "utf8"));
const vectorByProductId = new Map(stored.products.map((item) => [item.id, item.embedding]));
const { vectors: queryVectors } = await createEmbeddings(evaluation.cases.map((item) => item.query));

function calculate(testCase, ranked) {
  const topFive = ranked.slice(0, 5).map((product) => product.id);
  const position = topFive.findIndex((id) => testCase.relevantProductIds.includes(id));
  return { topFive, hitAt5: position >= 0 ? 1 : 0, reciprocalRank: position >= 0 ? 1 / (position + 1) : 0 };
}

function summary(label, values) {
  const hitAt5 = values.reduce((total, item) => total + item.hitAt5, 0) / values.length;
  const mrrAt5 = values.reduce((total, item) => total + item.reciprocalRank, 0) / values.length;
  console.log(`${label} Hit@5: ${(hitAt5 * 100).toFixed(1)}% | MRR@5: ${(mrrAt5 * 100).toFixed(1)}%`);
}

const baseline = evaluation.cases.map((testCase) => calculate(testCase, rankCatalog(catalog, testCase.query)));
const hybrid = evaluation.cases.map((testCase, index) => calculate(testCase, hybridRank(catalog, testCase.query, vectorByProductId, queryVectors[index], cosineSimilarity)));

console.log(`Evaluation status: ${evaluation.status}`);
console.log(`Embedding model: ${stored.model}`);
summary("Baseline", baseline);
summary("Hybrid", hybrid);
console.table(evaluation.cases.map((testCase, index) => ({
  id: testCase.id,
  query: testCase.query,
  baselineTopResult: baseline[index].topFive[0],
  hybridTopResult: hybrid[index].topFive[0],
})));
