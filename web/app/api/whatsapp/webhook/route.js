import { validSignature } from "@/lib/whatsapp";
import { handleWebhook } from "@/lib/feedback";

// Meta kat-verifier l-webhook b GET
export async function GET(req) {
  const p = new URL(req.url).searchParams;
  if (p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === process.env.WA_VERIFY_TOKEN)
    return new Response(p.get("hub.challenge"));
  return new Response("forbidden", { status: 403 });
}

export async function POST(req) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) return new Response("bad signature", { status: 401 });
  try { await handleWebhook(JSON.parse(raw)); } catch (e) { console.error("webhook", e); }
  return new Response("ok"); // dima 200 bach Meta ma t3awdch
}
