import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { inferSearchConstraints, rankCatalog } from "../server/retrieval.mjs";

const catalog = JSON.parse(await readFile(new URL("../server/data/catalog.json", import.meta.url), "utf8"));

test("a small-room query ranks a compact product first", () => {
  const results = rankCatalog(catalog, "compact speaker for a small room");
  assert.equal(results[0].id, "a1-2");
  assert.ok(results[0].retrieval.reasons.length > 0);
});

test("a theatre query ranks a centre loudspeaker first", () => {
  const results = rankCatalog(catalog, "centre speaker for home theatre");
  assert.equal(results[0].category, "Centre");
});

test("catalog entries preserve a source URL", () => {
  for (const product of catalog) assert.match(product.sourceUrl, /^https:\/\/spendoraudio\.com\//);
});

test("every current catalog product includes approved presentation media", () => {
  assert.equal(catalog.length, 19);
  for (const product of catalog) assert.match(product.imageUrl, /^https:\/\/spendoraudio\.com\/wp-content\/uploads\//);
});

test("a large-room request is inferred as a room constraint", () => {
  assert.deepEqual(inferSearchConstraints("best speaker for large room"), { rooms: ["large"], categories: [] });
});
