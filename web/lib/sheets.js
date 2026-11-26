import { google } from "googleapis";
import { unstable_cache } from "next/cache";

const cols = (name, fallback) => (process.env[name] || fallback).split(",").map((s) => s.trim().toLowerCase());
const COLS = {
  date: cols("COL_DATE", "Date livraison,Date"),
  client: cols("COL_CLIENT", "Client,Nom"),
  phone: cols("COL_PHONE", "Téléphone,Telephone,Tel,Phone"),
  product: cols("COL_PRODUCT", "Produit,Commande"),
  qty: cols("COL_QTY", "Quantité,Qte"),
  address: cols("COL_ADDRESS", "Adresse"),
  amount: cols("COL_AMOUNT", "Prix,Montant,Total"),
  payment: cols("COL_PAYMENT", "Paiement,Mode paiement"),
  status: cols("COL_STATUS", "Statut,Etat"),
};
const OPTIONAL = ["qty", "address", "status"];

const MONTHS = { janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, décembre: 12 };
const pad = (n) => String(n).padStart(2, "0");

export function parseDate(v) {
  if (v == null || v === "") return null;
  const s = String(v).trim().toLowerCase();
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  if ((m = s.match(/(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?/))) {
    const y = m[3] ? (m[3].length === 2 ? "20" + m[3] : m[3]) : new Date().getFullYear();
    return `${y}-${pad(m[2])}-${pad(m[1])}`;
  }
  if ((m = s.match(/(\d{1,2})\s+([a-zéû]+)(?:\s+(\d{4}))?/)) && MONTHS[m[2]])
    return `${m[3] || new Date().getFullYear()}-${pad(MONTHS[m[2]])}-${pad(m[1])}`;
  if (/^\d{5}$/.test(s)) { // date série Google Sheets
    const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  return null;
}

export const toNum = (v) => {
  if (v === "" || v == null) return null;
  const n = Number(String(v).replace(/[^\d.,]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

function client() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "{}");
  const auth = new google.auth.GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"] });
  return google.sheets({ version: "v4", auth });
}

async function readRegion(region) {
  const key = region.toUpperCase();
  const id = process.env[`SHEET_${key}_ID`];
  const tab = process.env[`SHEET_${key}_TAB`] || "Sheet1";
  if (!id) return { region, rows: [], error: `SHEET_${key}_ID ma m3mmrach` };
  try {
    const res = await client().spreadsheets.values.get({ spreadsheetId: id, range: `'${tab}'`, valueRenderOption: "UNFORMATTED_VALUE" });
    const [headers = [], ...data] = res.data.values || [];
    const h = headers.map((x) => String(x).trim().toLowerCase());
    const find = (names) => h.findIndex((x) => names.includes(x));
    const c = Object.fromEntries(Object.entries(COLS).map(([k, v]) => [k, find(v)]));
    const get = (r, k) => (c[k] >= 0 ? r[c[k]] : null);
    const rows = data
      .map((r, i) => ({
        id: `${region}:${i + 2}`, region, rowNumber: i + 2,
        delivery_date: parseDate(get(r, "date")),
        client_name: get(r, "client") || "",
        phone: String(get(r, "phone") ?? "").replace(/\D/g, ""),
        product: [get(r, "product"), get(r, "qty")].filter(Boolean).join(" "),
        address: get(r, "address") || "",
        amount: toNum(get(r, "amount")),
        payment: String(get(r, "payment") ?? ""),
        status: String(get(r, "status") ?? ""),
      }))
      .filter((r) => r.phone || r.client_name);
    const missing = Object.entries(c).filter(([k, i]) => i < 0 && !OPTIONAL.includes(k)).map(([k]) => k);
    return { region, rows, missing, sheetUrl: `https://docs.google.com/spreadsheets/d/${id}/edit` };
  } catch (e) {
    return { region, rows: [], error: e.message };
  }
}

// Cache 60s bach ma nqrawch Sheet f kol clic
export const readSheets = unstable_cache(
  async (regions) => Promise.all(regions.map(readRegion)),
  ["sheets"],
  { revalidate: 60, tags: ["sheets"] },
);

export const readSheetsFresh = (regions) => Promise.all(regions.map(readRegion));

export const isDelivered = (row) => !row.status || row.status.toLowerCase().includes((process.env.DELIVERED_KEYWORD || "livr").toLowerCase());

export const isVirement = (row) => row.payment.toLowerCase().includes((process.env.PAYMENT_KEYWORD || "virement").toLowerCase());
