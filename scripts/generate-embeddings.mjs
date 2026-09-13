import { mkdir, readFile, writeFile } from "node:fs/promises";
import { productSearchDocument, createEmbeddings } from "../server/embeddings.mjs";

const catalogUrl = new URL("../server/data/catalog.json", import.meta.url);
const outputUrl = new URL("../server/data/embeddings.json", import.meta.url);
const catalog = JSON.parse(await readFile(catalogUrl, "utf8"));
const documents = catalog.map(productSearchDocument);
const result = await createEmbeddings(documents);

await mkdir(new URL("../server/data/", import.meta.url), { recursive: true });
await writeFile(outputUrl, JSON.stringify({
  generatedAt: new Date().toISOString(),
  model: result.model,
  products: catalog.map((product, index) => ({ id: product.id, embedding: result.vectors[index] })),
}, null, 2));

console.log(`Generated ${result.vectors.length} ${result.model} embeddings at ${outputUrl.pathname}`);
