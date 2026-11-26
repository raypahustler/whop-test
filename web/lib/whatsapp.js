import crypto from "crypto";

const API = "https://graph.facebook.com/v21.0";

// 06XXXXXXXX / +212 6XX / 2126XX → 2126XXXXXXXX
export function toIntl(phone) {
  const d = String(phone || "").replace(/\D/g, "");
  if (d.startsWith("212") && d.length === 12) return d;
  if (d.startsWith("0") && d.length === 10) return "212" + d.slice(1);
  if (d.length === 9) return "212" + d;
  return null;
}

async function call(body) {
  const res = await fetch(`${API}/${process.env.WA_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...body }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || `WhatsApp API ${res.status}`);
  return json.messages?.[0]?.id;
}

// Template approuvé f Meta. {{1}} = smiya, {{2}} = produit
export const sendFeedbackTemplate = (to, name, product) =>
  call({
    to, type: "template",
    template: {
      name: process.env.WA_TEMPLATE_NAME || "feedback_commande",
      language: { code: process.env.WA_TEMPLATE_LANG || "fr" },
      components: [{ type: "body", parameters: [{ type: "text", text: name || "cher client" }, { type: "text", text: product || "votre commande" }] }],
    },
  });

// Message 3adi (msmou7 ghir f 24h mn b3d ma jaweb l-client)
export const sendText = (to, text) => call({ to, type: "text", text: { body: text } });

export function validSignature(raw, header) {
  if (!process.env.WA_APP_SECRET || !header) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", process.env.WA_APP_SECRET).update(raw).digest("hex");
  return expected.length === header.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header));
}
