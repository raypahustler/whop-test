import "dotenv/config";
import makeWASocket, {
  useMultiFileAuthState, DisconnectReason, downloadMediaMessage, fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";
import { extractReceipt, extractOrder, extractStatement } from "./ai.js";
import * as db from "./db.js";

const logger = pino({ level: "warn" });
const OWNER = `${process.env.OWNER_NUMBER}@s.whatsapp.net`;
const GROUPS = {
  [process.env.GROUP_VIREMENTS]: { kind: "virements" },
  [process.env.GROUP_CASABLANCA]: { kind: "orders", region: "casablanca" },
  [process.env.GROUP_RABAT]: { kind: "orders", region: "rabat" },
};
delete GROUPS["undefined"]; delete GROUPS[""];

const MONEY_WORDS = /(virement|virment|vir|dh|mad|درهم|khlst|khlas|sift|reçu|recu|payé|paye|\d{3,})/i;
const ORDER_HINT = /(0[5-7]\d{8}|\+212|pi[eè]ce|plateau|pastilla|liv)/i;

const getText = (m) => m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.documentMessage?.caption || "";
const tsOf = (msg) => new Date(Number(msg.messageTimestamp) * 1000);

async function toImage(msg, sock) {
  const m = msg.message;
  const media = m.imageMessage || (m.documentMessage?.mimetype?.startsWith("image/") && m.documentMessage);
  if (!media) return null;
  const buf = await downloadMediaMessage(msg, "buffer", {}, { logger, reuploadRequest: sock.updateMediaMessage });
  return { mimeType: media.mimetype.split(";")[0], data: buf.toString("base64") };
}

async function handleOrder(msg, sock, region) {
  const text = getText(msg.message);
  if (!ORDER_HINT.test(text) && !msg.message.imageMessage) return;
  const image = await toImage(msg, sock);
  const postedAt = tsOf(msg);
  const o = await extractOrder({ text, image, postedAt: postedAt.toISOString() });
  if (!o.is_order) return;
  await db.saveOrder({
    wa_message_id: msg.key.id,
    region,
    posted_by: msg.pushName || (msg.key.participant || "").split("@")[0],
    posted_at: postedAt.toISOString(),
    raw_text: text || "[image]",
    client_name: o.client_name, phone: o.phone, product: o.product, quantity: o.quantity,
    address: o.address, city: o.city, delivery_date: o.delivery_date, delivery_time: o.delivery_time,
    delivery_fee: o.delivery_fee, amount: o.amount, ai_notes: o.notes,
  });
  console.log(`📦 [${region}] ${o.client_name} ${o.phone} — ${o.product} ${o.quantity || ""}`);
}

async function handleReceipt(msg, sock) {
  const text = getText(msg.message);
  const image = await toImage(msg, sock);
  if (!image && !MONEY_WORDS.test(text)) return;
  const r = await extractReceipt({ image, caption: text });
  if (!r.is_payment) return;
  const postedAt = tsOf(msg);
  const image_path = image ? await db.saveImage(`group/${postedAt.toISOString().slice(0, 10)}/${msg.key.id}.${image.mimeType.split("/")[1]}`, image) : null;
  await db.saveReceipt({
    wa_message_id: msg.key.id,
    posted_by: msg.pushName || "",
    posted_phone: (msg.key.participant || "").split("@")[0],
    posted_at: postedAt.toISOString(),
    raw_text: text, image_path,
    amount: r.amount, transfer_date: r.date, sender_name: r.sender_name, bank: r.bank,
    reference: r.reference, order_ref: r.order_number, ai_notes: r.notes,
  });
  console.log(`🧾 Reçu: ${msg.pushName} — ${r.amount} DH`);
}

async function handleBankStatement(msg, sock) {
  const image = await toImage(msg, sock);
  if (!image) return sock.sendMessage(OWNER, { text: "Sift liya screenshot dyal l-historique bancaire 📸 (wla upload f webapp)" });
  const { transactions } = await extractStatement({ image });
  const path = await db.saveImage(`bank/${Date.now()}.${image.mimeType.split("/")[1]}`, image);
  const added = await db.saveBankTransactions(transactions.map((t) => ({ tx_date: t.date, amount: t.amount, label: t.label, screenshot_path: path })));
  await sock.sendMessage(OWNER, { text: `✅ ${transactions.length} opération tqrat (${added} jdad). Chouf l-résultat f Audit Check → Virements.` });
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({ version, auth: state, logger, markOnlineOnConnect: false });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) { console.log("📱 Scanni had QR b WhatsApp dyal numéro l-bot:"); qrcode.generate(qr, { small: true }); }
    if (connection === "open") console.log(`✅ L-bot mconnecté — kaysm3 l ${Object.keys(GROUPS).length} groupe`);
    if (connection === "close") {
      const loggedOut = lastDisconnect?.error?.output?.statusCode === DisconnectReason.loggedOut;
      console.log(loggedOut ? "❌ Logged out — mse7 dossier auth/ w scanni mn jdid" : "🔄 Reconnexion...");
      if (!loggedOut) setTimeout(start, 3000);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const chat = msg.key.remoteJid;
      try {
        const g = GROUPS[chat];
        if (g?.kind === "orders") await handleOrder(msg, sock, g.region);
        else if (g?.kind === "virements") await handleReceipt(msg, sock);
        else if (chat.endsWith("@g.us")) {
          const meta = await sock.groupMetadata(chat).catch(() => ({}));
          console.log(`ℹ️ Groupe ma m3rrfch: "${meta.subject || "?"}" → ${chat}`);
        } else if (chat === OWNER) await handleBankStatement(msg, sock);
      } catch (e) {
        console.error("Erreur:", e.message);
      }
    }
  });
}

start();
