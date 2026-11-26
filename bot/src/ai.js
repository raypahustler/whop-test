import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";

const RECEIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["is_payment", "amount", "currency", "date", "sender_name", "bank", "reference", "order_number", "notes"],
  properties: {
    is_payment: { type: "boolean", description: "true ila kan reçu/preuve de virement wla message kaygoul khlas" },
    amount: { type: ["number", "null"] },
    currency: { type: ["string", "null"] },
    date: { type: ["string", "null"], description: "YYYY-MM-DD" },
    sender_name: { type: ["string", "null"] },
    bank: { type: ["string", "null"] },
    reference: { type: ["string", "null"] },
    order_number: { type: ["string", "null"] },
    notes: { type: ["string", "null"], description: "chi haja machi normale (reçu modifié, montant ma wadehch...)" },
  },
};

const ORDER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["is_order", "client_name", "phone", "product", "quantity", "address", "city", "delivery_date", "delivery_time", "delivery_fee", "amount", "notes"],
  properties: {
    is_order: { type: "boolean", description: "true ila l-message commande (machi discussion 3adiya)" },
    client_name: { type: ["string", "null"] },
    phone: { type: ["string", "null"], description: "numéro marocain, ghir les chiffres (06/07...)" },
    product: { type: ["string", "null"], description: "produit kima mktoub (ex: plateau)" },
    quantity: { type: ["string", "null"], description: "ex: 12 pieces" },
    address: { type: ["string", "null"] },
    city: { type: ["string", "null"] },
    delivery_date: { type: ["string", "null"], description: "YYYY-MM-DD, date dyal livraison" },
    delivery_time: { type: ["string", "null"], description: "ex: 18:00" },
    delivery_fee: { type: ["number", "null"], description: "frais livraison (ex: '+15liv' = 15)" },
    amount: { type: ["number", "null"], description: "prix total ila mktoub" },
    notes: { type: ["string", "null"] },
  },
};

const STATEMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["transactions"],
  properties: {
    transactions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["date", "amount", "label"],
        properties: {
          date: { type: ["string", "null"], description: "YYYY-MM-DD" },
          amount: { type: "number", description: "montant reçu (crédit) b DH" },
          label: { type: "string", description: "libellé kima kayn f relevé (smiya dyal li sift)" },
        },
      },
    },
  },
};

async function ask({ system, image, text, schema }) {
  const content = [];
  if (image) content.push({ type: "image", source: { type: "base64", media_type: image.mimeType, data: image.data } });
  content.push({ type: "text", text });

  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema } },
    system,
    messages: [{ role: "user", content }],
  });
  if (res.stop_reason === "refusal") throw new Error("AI refused the request");
  const out = res.content.find((b) => b.type === "text");
  return JSON.parse(out.text);
}

const today = () => new Date().toISOString().slice(0, 10);

export function extractReceipt({ image, caption }) {
  return ask({
    system:
      "Nta assistant kayqra les preuves de virement bancaire f Maroc (CIH, Attijariwafa, BMCE, Banque Populaire, Chaabi, CashPlus, Wafacash...). " +
      "Rja3 ghir l-ma3loumat li katchoufha; ila chi haja ma kaynach, 7tt null. Montant b DH. " +
      `Lyoum: ${today()}.`,
    image,
    text: caption
      ? `Message dyal l-client: """${caption}"""\nStakhrj ma3loumat l-virement.`
      : "Stakhrj ma3loumat l-virement mn had tswira.",
    schema: RECEIPT_SCHEMA,
  });
}

export function extractOrder({ text, image, postedAt }) {
  return ask({
    system:
      "Nta kayqra les commandes li kaytsiftou f groupe WhatsApp dyal traiteur marocain (pastilla, plateaux...). " +
      "Les messages b Darija/Français, bhal:\n" +
      "vendredi 27 novembre mea 17h / plateau 12 pieces / rabat hay riyad prestigia+15liv / mayssane / 0661986331 / mea 18h\n" +
      "'mea 18h' = m3a 18h (wa9t). '+15liv' = 15 DH livraison. Ila kaynin 2 dyal l-awqat, l-akhir howa wa9t l-livraison. " +
      `Message tsift: ${postedAt}. Ila l-3am ma mktoubch, khod l-date l-jaya l-qriba.`,
    image,
    text: `Message:\n"""${text}"""\nStakhrj l-commande.`,
    schema: ORDER_SCHEMA,
  });
}

export function extractStatement({ image }) {
  return ask({
    system:
      "Nta kayqra screenshot dyal historique/relevé bancaire marocain. Rja3 ghir les opérations li dakhlin (crédit / virement reçu), " +
      `machi les dépenses. Lyoum: ${today()}.`,
    image,
    text: "Stakhrj ga3 les virements reçus mn had screenshot.",
    schema: STATEMENT_SCHEMA,
  });
}
