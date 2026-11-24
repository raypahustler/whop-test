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
