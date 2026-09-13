/**
 * Approved bootstrap importer for public Spendor catalog pages.
 *
 * This deliberately produces a reviewable source archive, not an automatic
 * production update. A Spendor reviewer must approve normalized catalog data
 * and media rights before it reaches server/data/catalog.json.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const sources = [
  "https://spendoraudio.com/a-line-loudspeakers/",
  "https://spendoraudio.com/d-line-loudspeakers/",
  "https://spendoraudio.com/classic-loudspeakers/",
];

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

async function collectPage(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "SpendorCatalogPrototype/0.1 (approved internal import)" },
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  const html = await response.text();
  const links = unique([...html.matchAll(/href=["']([^"']+)["']/gi)].map((match) => match[1]));
  const images = unique([...html.matchAll(/(?:src|data-src)=["']([^"']+\.(?:png|jpe?g|webp)[^"']*)["']/gi)].map((match) => match[1]));
  const pdfs = links.filter((href) => /\.pdf(?:\?|$)/i.test(href));
  return {
    sourceUrl: url,
    importedAt: new Date().toISOString(),
    title: (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/\s+/g, " ").trim(),
    productLinks: links.filter((href) => /\/product\//i.test(href)),
    images,
    pdfs,
    text: stripHtml(html),
  };
}

const pages = [];
for (const source of sources) {
  console.log(`Importing ${source}`);
  pages.push(await collectPage(source));
}

const outputDir = fileURLToPath(new URL("../server/data/imports/", import.meta.url));
await mkdir(outputDir, { recursive: true });
const outputPath = fileURLToPath(new URL("../server/data/imports/spendor-public-pages.json", import.meta.url));
await writeFile(outputPath, JSON.stringify({ approvalRequired: true, pages }, null, 2));
console.log(`Saved ${pages.length} public source snapshots to ${outputPath}`);
