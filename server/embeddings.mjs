import "./env.mjs";

function embeddingModel() {
  return process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001";
}

export function productSearchDocument(product) {
  return [
    `Model: ${product.model}.`,
    `Range: ${product.series}.`,
    `Product type: ${product.category}.`,
    `Summary: ${product.summary}`,
    `Room sizes: ${product.roomSizes.join(", ")}.`,
    `Published frequency response: ${product.frequencyResponse}.`,
    `Published impedance: ${product.impedance}.`,
    `Recommended amplifier power: ${product.amplifierPower}.`,
    `Search concepts: ${product.searchTerms.join(", ")}.`,
  ].join(" ");
}

export function cosineSimilarity(left, right) {
  if (left.length !== right.length) throw new Error("Embedding vectors must have the same dimension.");
  const { dot, leftNorm, rightNorm } = left.reduce((total, value, index) => ({
    dot: total.dot + (value * right[index]),
    leftNorm: total.leftNorm + (value * value),
    rightNorm: total.rightNorm + (right[index] * right[index]),
  }), { dot: 0, leftNorm: 0, rightNorm: 0 });
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

export async function createEmbeddings(inputs) {
  // OPENAI_API_KEY is accepted temporarily for the existing local configuration.
  // New installations should use GEMINI_API_KEY.
  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is required to generate embeddings.");
  const model = embeddingModel();
  const vectors = [];
  for (const input of inputs) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent`, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: { parts: [{ text: input }] } }),
    });
    if (!response.ok) throw new Error(`Embedding request failed with HTTP ${response.status}. Check the server-side API key and project permissions.`);
    const payload = await response.json();
    vectors.push(payload.embedding.values);
  }
  return { model, vectors };
}
