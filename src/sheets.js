import { google } from "googleapis";

const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_FILE,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });
const ID = process.env.SPREADSHEET_ID;
const RECEIPTS = process.env.RECEIPTS_TAB || "Reçus WhatsApp";
const BANK = process.env.BANK_TAB || "Relevé bancaire";

export const RECEIPT_HEADERS = [
  "Reçu le", "Client (WhatsApp)", "Numéro", "N° commande", "Montant", "Date virement",
  "Nom expéditeur", "Banque", "Référence", "Message", "Notes AI", "Statut", "Opération bancaire",
];

async function ensureTab(title, headers) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: ID });
  if (meta.data.sheets.some((s) => s.properties.title === title)) return;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: ID,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId: ID, range: `'${title}'!A1`, valueInputOption: "RAW",
    requestBody: { values: [headers] },
  });
}

export async function init() {
  await ensureTab(RECEIPTS, RECEIPT_HEADERS);
  await ensureTab(BANK, ["Ajouté le", "Date", "Montant", "Libellé", "Reçu lié (ligne)"]);
}

export async function appendReceipt(row) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: ID, range: `'${RECEIPTS}'!A1`, valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
}

export async function readReceipts() {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: ID, range: `'${RECEIPTS}'!A2:M` });
  return (res.data.values || []).map((r, i) => ({ rowNumber: i + 2, cells: r }));
}

export async function setReceiptStatus(rowNumber, status, bankInfo) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: ID, range: `'${RECEIPTS}'!L${rowNumber}:M${rowNumber}`, valueInputOption: "RAW",
    requestBody: { values: [[status, bankInfo]] },
  });
}

export async function appendBankRows(rows) {
  if (!rows.length) return;
  await sheets.spreadsheets.values.append({
    spreadsheetId: ID, range: `'${BANK}'!A1`, valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });
}

// ---- Orders ----
const O = {
  tab: process.env.ORDERS_TAB || "Orders",
  order: process.env.ORDERS_COL_ORDER || "N° commande",
  client: process.env.ORDERS_COL_CLIENT || "Client",
  phone: process.env.ORDERS_COL_PHONE || "Téléphone",
  amount: process.env.ORDERS_COL_AMOUNT || "Montant",
  payment: process.env.ORDERS_COL_PAYMENT || "Paiement",
  keyword: (process.env.ORDERS_PAYMENT_KEYWORD || "virement").toLowerCase(),
  status: process.env.ORDERS_COL_STATUS || "",
};

const colLetter = (i) => { let s = ""; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s; return s; };
const toNum = (v) => (v === "" || v == null ? null : Number(String(v).replace(/[^\d.,]/g, "").replace(",", ".")));

export async function readOrders() {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: ID, range: `'${O.tab}'` });
  const [headers = [], ...rows] = res.data.values || [];
  const idx = (name) => headers.findIndex((h) => h.trim().toLowerCase() === name.trim().toLowerCase());
  const c = { order: idx(O.order), client: idx(O.client), phone: idx(O.phone), amount: idx(O.amount), payment: idx(O.payment), status: O.status ? idx(O.status) : -1 };
  if (c.order < 0 || c.amount < 0) throw new Error(`Ma lqitch colonnes "${O.order}" / "${O.amount}" f onglet ${O.tab}`);
  return {
    statusCol: c.status >= 0 ? colLetter(c.status) : null,
    orders: rows
      .map((r, i) => ({
        rowNumber: i + 2,
        order: (r[c.order] || "").toString().trim(),
        client: c.client >= 0 ? r[c.client] : "",
        phone: c.phone >= 0 ? (r[c.phone] || "").replace(/\D/g, "") : "",
        amount: toNum(r[c.amount]),
        payment: c.payment >= 0 ? (r[c.payment] || "") : O.keyword,
      }))
      .filter((o) => o.order && o.payment.toLowerCase().includes(O.keyword)),
  };
}

export async function setOrderStatuses(statusCol, updates) {
  if (!statusCol || !updates.length) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: ID,
    requestBody: {
      valueInputOption: "RAW",
      data: updates.map((u) => ({ range: `'${O.tab}'!${statusCol}${u.rowNumber}`, values: [[u.status]] })),
    },
  });
}

export async function setReceiptOrder(rowNumber, order) {
  await sheets.spreadsheets.values.update({
    spreadsheetId: ID, range: `'${RECEIPTS}'!D${rowNumber}`, valueInputOption: "RAW",
    requestBody: { values: [[order]] },
  });
}
