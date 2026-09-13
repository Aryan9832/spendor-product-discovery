import { mkdir, writeFile } from "node:fs/promises";

const sitemapUrl = "https://spendoraudio.com/wp-sitemap-posts-distfind_distributor-1.xml";
const targetUrl = new URL("../server/data/retailers.json", import.meta.url);

function decode(value = "") {
  return value
    .replace(/<br\s*\/?>/gi, ", ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#8211;/g, "–").replace(/&#8217;/g, "'").replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ").replace(/&#[0-9]+;/g, " ")
    .replace(/\s+/g, " ").trim();
}

function pick(html, expression) {
  return decode(html.match(expression)?.[1] || "");
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { "user-agent": "SpendorPortfolioDataImport/1.0" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

function parseRetailer(html, sourceUrl) {
  const title = pick(html, /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i) || new URL(sourceUrl).pathname.split("/").filter(Boolean).at(-1);
  const address = pick(html, /<p[^>]*class=["'][^"']*address[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
  const phone = pick(html, /(?:Phone|Tel)\s*:\s*<strong[^>]*>([\s\S]*?)<\/strong>/i) || pick(html, /(?:Phone|Tel)\s*:\s*([^<\n]+)/i);
  const email = html.match(/mailto:([^"'?\s>]+)/i)?.[1] || "";
  const website = html.match(/Website:\s*<strong>\s*<a[^>]*href=["']([^"']+)/i)?.[1] || "";
  const parts = title.split("–").map((part) => part.trim());
  const countryCodes = { AR: "Argentina", AT: "Austria", AU: "Australia", BE: "Belgium", BR: "Brazil", BY: "Belarus", CA: "Canada", CH: "Switzerland", CN: "China", CY: "Cyprus", CZ: "Czechia", DE: "Germany", DK: "Denmark", EE: "Estonia", ES: "Spain", FI: "Finland", FR: "France", GB: "United Kingdom", GR: "Greece", HK: "Hong Kong", HR: "Croatia", HU: "Hungary", IE: "Ireland", IL: "Israel", IN: "India", IT: "Italy", JP: "Japan", KR: "South Korea", LT: "Lithuania", LU: "Luxembourg", LV: "Latvia", MD: "Moldova", MY: "Malaysia", NL: "Netherlands", NO: "Norway", NZ: "New Zealand", PH: "Philippines", PL: "Poland", PT: "Portugal", RO: "Romania", RS: "Serbia", RU: "Russia", SE: "Sweden", SG: "Singapore", SI: "Slovenia", SK: "Slovakia", TH: "Thailand", TR: "Turkey", TW: "Taiwan", UK: "United Kingdom", US: "United States", ZA: "South Africa" };
  const code = address.match(/\b([A-Z]{2})\s*$/)?.[1];
  const knownCountry = Object.keys(countryCodes).find((item) => parts[0].toLowerCase() === countryCodes[item].toLowerCase());
  const country = countryCodes[code] || (knownCountry ? countryCodes[knownCountry] : parts.length > 1 && !["DISTRIBUTOR", "Audio Eden", "Elite Audio Distribution"].includes(parts[0]) ? parts[0] : "International");
  const name = parts.length > 1 ? parts.slice(1).join(" – ") : title;
  return { id: sourceUrl.split("/").filter(Boolean).at(-1), name, country, address, phone, email, website, sourceUrl };
}

const sitemap = await fetchText(sitemapUrl);
const urls = [...sitemap.matchAll(/<loc>(https:\/\/spendoraudio\.com\/distributor\/[^<]+)<\/loc>/g)]
  .map((match) => match[1]).filter((url) => url !== "https://spendoraudio.com/distributor/");
const retailers = [];
for (let index = 0; index < urls.length; index += 8) {
  const batch = await Promise.all(urls.slice(index, index + 8).map(async (url) => {
    try { return parseRetailer(await fetchText(url), url); } catch { return null; }
  }));
  retailers.push(...batch.filter(Boolean));
}
await mkdir(new URL("../server/data/", import.meta.url), { recursive: true });
await writeFile(targetUrl, JSON.stringify({ refreshedAt: new Date().toISOString(), source: sitemapUrl, retailers }, null, 2));
console.log(`Imported ${retailers.length} public retailer records.`);
