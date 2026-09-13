# Spendor Product Discovery Platform

An approved internal prototype for helping listeners discover Spendor loudspeakers using structured product facts and natural-language search.

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`.

## Import approved public sources

```bash
npm run import:public-catalog
```

This command archives public source pages for review only. It does **not** publish, overwrite, or automatically approve catalog data or media.

## Project explanation

See [PROJECT_WALKTHROUGH.md](PROJECT_WALKTHROUGH.md) for the implementation narrative and interviewer talking points.
# Spendor Product Discovery

Private, permissioned interview portfolio project for Spendor Audio.

## Run locally

```powershell
npm run dev
```

Open `http://localhost:5173`. The API runs at `http://localhost:8787`.

## Data refresh

```powershell
npm run import:public-catalog
npm run import:retailers
```

The retailer importer reads Spendor's public dealer sitemap and stores a refreshable structured snapshot in `server/data/retailers.json`.

## Verify

```powershell
npm run build
npm test
```
