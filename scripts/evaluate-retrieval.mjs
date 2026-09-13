import { readFile } from "node:fs/promises";
import { rankCatalog } from "../server/retrieval.mjs";

const catalog = JSON.parse(await readFile(new URL("../server/data/catalog.json", import.meta.url), "utf8"));
const evaluation = JSON.parse(await readFile(new URL("../server/data/evaluation.json", import.meta.url), "utf8"));

function metricsFor(testCase) {
  const ranked = rankCatalog(catalog, testCase.query);
  const topFive = ranked.slice(0, 5).map((product) => product.id);
  const firstRelevantIndex = topFive.findIndex((id) => testCase.relevantProductIds.includes(id));
  return {
    id: testCase.id,
    query: testCase.query,
    topFive,
    hitAt5: firstRelevantIndex >= 0 ? 1 : 0,
    reciprocalRank: firstRelevantIndex >= 0 ? 1 / (firstRelevantIndex + 1) : 0,
  };
}

const results = evaluation.cases.map(metricsFor);
const hitAt5 = results.reduce((total, item) => total + item.hitAt5, 0) / results.length;
const mrrAt5 = results.reduce((total, item) => total + item.reciprocalRank, 0) / results.length;

console.log(`Evaluation status: ${evaluation.status}`);
console.log(`Cases: ${results.length}`);
console.log(`Hit@5: ${(hitAt5 * 100).toFixed(1)}%`);
console.log(`MRR@5: ${(mrrAt5 * 100).toFixed(1)}%`);
console.table(results.map(({ id, query, topFive }) => ({ id, query, topFive: topFive.join(", ") })));
