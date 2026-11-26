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
