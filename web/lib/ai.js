import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SCHEMA = {
  type: "object", additionalProperties: false, required: ["transactions"],
  properties: {
    transactions: {
      type: "array",
      items: {
        type: "object", additionalProperties: false, required: ["date", "amount", "label"],
        properties: {
          date: { type: ["string", "null"], description: "YYYY-MM-DD" },
          amount: { type: "number", description: "montant reçu (crédit) b DH" },
          label: { type: "string" },
        },
      },
    },
  },
};

export async function extractStatement(images) {
  const res = await client.beta.messages.create({
    model: process.env.CLAUDE_MODEL || "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: `Nta kayqra screenshots dyal historique bancaire marocain. Rja3 ghir les opérations li DAKHLIN (crédit / virement reçu), machi les dépenses. Ila nefs l-opération bant f 2 screenshots, 7ttha mra wa7da. Lyoum: ${new Date().toISOString().slice(0, 10)}.`,
    messages: [{
      role: "user",
      content: [
        ...images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.mimeType, data: i.data } })),
        { type: "text", text: "Stakhrj ga3 les virements reçus." },
      ],
    }],
  });
  if (res.stop_reason === "refusal") throw new Error("L-AI rfd la demande");
  return JSON.parse(res.content.find((b) => b.type === "text").text).transactions;
}

const FEEDBACK_SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["rating", "sentiment", "summary", "needs_followup"],
  properties: {
    rating: { type: ["integer", "null"], description: "note 1-5 ila l-client 3taha (wla wadha mn l-kalam), sinon null" },
    sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
    summary: { type: "string", description: "jomla wa7da b Darija (latin)" },
    needs_followup: { type: "boolean", description: "true ila kayn chikaya, mochkil f livraison/produit, wla note <= 3" },
  },
};

export async function analyzeFeedback(text, product) {
  const res = await client.beta.messages.create({
    model: process.env.CLAUDE_MODEL || "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: FEEDBACK_SCHEMA } },
    system: "Nta kat7llel avis dyal client 3la commande dyal traiteur marocain. L-client yqder ykteb b Darija, Français, Arabe wla emojis.",
    messages: [{ role: "user", content: `Produit: ${product || "?"}\nJawab dyal l-client:\n"""${text}"""` }],
  });
  if (res.stop_reason === "refusal") return { rating: null, sentiment: "neutral", summary: "", needs_followup: true };
  return JSON.parse(res.content.find((b) => b.type === "text").text);
}
