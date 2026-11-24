import "dotenv/config";
import makeWASocket, {
  useMultiFileAuthState, DisconnectReason, downloadMediaMessage, fetchLatestBaileysVersion,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import pino from "pino";
import { extractReceipt, extractStatement } from "./ai.js";
import * as db from "./sheets.js";
import { compare, matchOrders } from "./compare.js";

const logger = pino({ level: "warn" });
const GROUP_ID = process.env.GROUP_ID;
const OWNER = `${process.env.OWNER_NUMBER}@s.whatsapp.net`;
const MONEY_WORDS = /(virement|virment|vir|dh|mad|درهم|khlst|khlas|sift|reçu|recu|payé|paye|\d{3,})/i;

function getText(m) {
  return m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.documentMessage?.caption || "";
}

async function toImage(msg, sock) {
  const m = msg.message;
  const media = m.imageMessage || (m.documentMessage?.mimetype?.startsWith("image/") && m.documentMessage);
  if (!media) return null;
  const buf = await downloadMediaMessage(msg, "buffer", {}, { logger, reuploadRequest: sock.updateMediaMessage });
  return { mimeType: media.mimetype.split(";")[0], data: buf.toString("base64") };
}

async function handleGroupMessage(msg, sock) {
  const text = getText(msg.message);
  const image = await toImage(msg, sock);
  if (!image && !MONEY_WORDS.test(text)) return; // message 3adi, ma fih walo

  const r = await extractReceipt({ image, caption: text });
  if (!r.is_payment) return;

  const sender = msg.key.participant || "";
  await db.appendReceipt([
    new Date().toLocaleString("fr-MA", { timeZone: "Africa/Casablanca" }),
    msg.pushName || "",
    sender.split("@")[0],
    r.order_number || "",
    r.amount ?? "",
    r.date || "",
    r.sender_name || "",
    r.bank || "",
    r.reference || "",
    image ? `[tswira] ${text}` : text,
    r.notes || "",
    "⏳ En attente",
    "",
  ]);
  console.log(`🧾 Reçu tsjjel: ${msg.pushName} — ${r.amount} DH`);
}

async function handleBankStatement(msg, sock) {
  const image = await toImage(msg, sock);
  if (!image) {
    await sock.sendMessage(OWNER, { text: "Sift liya screenshot dyal l-historique bancaire 📸" });
    return;
  }
  await sock.sendMessage(OWNER, { text: "⏳ Kanqra l-relevé w kanqarn..." });
  const { transactions } = await extractStatement({ image });

  const receipts = await loadReceipts();

  const { updates, unmatched } = compare(receipts, transactions);
  for (const u of updates) await db.setReceiptStatus(u.rowNumber, u.status, u.bankInfo);
  const stamp = new Date().toLocaleString("fr-MA", { timeZone: "Africa/Casablanca" });
  await db.appendBankRows(transactions.map((t) => [stamp, t.date, t.amount, t.label, ""]));

  const byRow = Object.fromEntries(receipts.map((r) => [r.rowNumber, r]));
  const line = (u) => { const r = byRow[u.rowNumber]; return `• ${r.client || "?"} ${r.order ? "#" + r.order : ""} — ${r.amount ?? "?"} DH`; };
  const ok = updates.filter((u) => u.status.startsWith("✅"));
  const warn = updates.filter((u) => u.status.startsWith("⚠️"));
  const ko = updates.filter((u) => u.status.startsWith("❌"));

  let report = `📊 *Comparaison* (${transactions.length} opération f relevé)\n\n✅ Wslo: ${ok.length}\n`;
  if (warn.length) report += `\n⚠️ Chouf b 3inik (${warn.length}):\n${warn.map(line).join("\n")}\n`;
  if (ko.length) report += `\n❌ Ma wslouch (${ko.length}):\n${ko.map(line).join("\n")}\n`;
  if (unmatched.length) report += `\n💰 Flouss dakhlin bla reçu (${unmatched.length}):\n${unmatched.map((t) => `• ${t.amount} DH — ${t.label}`).join("\n")}`;
  await sock.sendMessage(OWNER, { text: report });
  await checkOrders(sock);
}

async function loadReceipts() {
  const rows = await db.readReceipts();
  return rows.map(({ rowNumber, cells }) => ({
    rowNumber,
    client: cells[1],
    phone: cells[2],
    order: cells[3],
    amount: cells[4] === "" || cells[4] == null ? null : Number(String(cells[4]).replace(",", ".")),
    date: cells[5],
    sender: cells[6] || cells[1],
    status: cells[11],
  }));
}

// Kaychouf wach kol commande "virement" f Sheet 3ndha reçu f l-groupe
async function checkOrders(sock) {
  const { orders, statusCol } = await db.readOrders();
  const receipts = await loadReceipts();
  const { orderUpdates, receiptLinks, orphanReceipts } = matchOrders(orders, receipts);

  for (const l of receiptLinks) await db.setReceiptOrder(l.rowNumber, l.order);
  await db.setOrderStatuses(statusCol, orderUpdates);

  const fmt = (o) => `• #${o.order} ${o.client || ""} — ${o.amount ?? "?"} DH`;
  const group = (p) => orderUpdates.filter((u) => u.status.startsWith(p));
  const sections = [
    ["✅", "Reçu + wsl l-bank"],
    ["🧾", "Reçu kayn, mazal ma tchecka m3a l-bank"],
    ["⚠️", "Montant différent"],
    ["🚨", "Reçu kayn walakin flouss ma wslouch"],
    ["❌", "Commande b virement bla reçu f l-groupe"],
  ];
  let report = `📦 *Commandes vs groupe* (${orders.length} commande b virement)\n`;
  for (const [icon, title] of sections) {
    const list = group(icon);
    if (!list.length) continue;
    report += icon === "✅" ? `\n✅ ${title}: ${list.length}\n` : `\n${icon} ${title} (${list.length}):\n${list.map((u) => fmt(u) + (icon === "⚠️" ? ` → ${u.status}` : "")).join("\n")}\n`;
  }
  if (orphanReceipts.length)
    report += `\n❓ Reçus f l-groupe bla commande f Sheet (${orphanReceipts.length}):\n${orphanReceipts.map((r) => `• ${r.client || r.sender || "?"} — ${r.amount ?? "?"} DH`).join("\n")}`;
  await sock.sendMessage(OWNER, { text: report });
}

async function start() {
  await db.init();
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({ version, auth: state, logger, markOnlineOnConnect: false });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) { console.log("📱 Scanni had QR b WhatsApp dyal numéro l-bot:"); qrcode.generate(qr, { small: true }); }
    if (connection === "open") console.log("✅ L-bot mconnecté");
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
        if (chat.endsWith("@g.us")) {
          if (!GROUP_ID) { console.log(`ℹ️ Message mn groupe: ${chat} — 7ttha f GROUP_ID`); continue; }
          if (chat === GROUP_ID) await handleGroupMessage(msg, sock);
        } else if (chat === OWNER) {
          const t = getText(msg.message).trim().toLowerCase();
          if (!msg.message.imageMessage && ["check", "commandes", "orders"].includes(t)) await checkOrders(sock);
          else await handleBankStatement(msg, sock);
        }
      } catch (e) {
        console.error("Erreur:", e.message);
      }
    }
  });
}

start();
