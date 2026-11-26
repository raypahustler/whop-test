// Moteur de comparaison — fonctions pures, bla base de données.
export const norm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

export function nameScore(a, b) {
  const wa = new Set(norm(a).split(" ").filter((w) => w.length > 2));
  const wb = norm(b).split(" ").filter((w) => w.length > 2);
  if (!wa.size || !wb.length) return 0;
  return wb.filter((w) => wa.has(w)).length / Math.min(wa.size, wb.length);
}

const digits = (s) => (s || "").toString().replace(/\D/g, "");
export const phoneKey = (s) => digits(s).slice(-9);
export const samePhone = (a, b) => phoneKey(a).length === 9 && phoneKey(a) === phoneKey(b);
export const days = (a, b) => (a && b ? Math.abs((new Date(a) - new Date(b)) / 86400000) : 0);
const amountOk = (a, b) => a == null || b == null || Math.abs(a - b) <= 0.5;
const nums = (s) => (norm(s).match(/\d+/g) || []).join(",");

/**
 * Commandes f groupe ↔ lignes f Google Sheet (nefs région).
 * Kayrj3 lignes: {status, group, sheet, diffs[]}
 * status: ok | mismatch | missing_in_sheet | missing_in_group
 */
export function matchGroupToSheet(groupOrders, sheetRows) {
  const used = new Set();
  const out = [];
  for (const g of groupOrders) {
    const candidates = sheetRows.filter((s) => !used.has(s.id) && s.region === g.region);
    const s =
      candidates.find((s) => samePhone(s.phone, g.phone) && days(s.delivery_date, g.delivery_date) <= 1) ||
      candidates.find((s) => samePhone(s.phone, g.phone)) ||
      candidates.find((s) => !g.phone && nameScore(s.client_name, g.client_name) >= 0.5 && days(s.delivery_date, g.delivery_date) <= 1);
    if (!s) { out.push({ status: "missing_in_sheet", group: g, sheet: null, diffs: [] }); continue; }
    used.add(s.id);
    const diffs = [];
    if (g.delivery_date && s.delivery_date && g.delivery_date !== s.delivery_date) diffs.push(`Date: groupe ${g.delivery_date} ≠ sheet ${s.delivery_date}`);
    const gq = nums(`${g.product} ${g.quantity}`), sq = nums(s.product);
    if (gq && sq && gq !== sq) diffs.push(`Quantité: groupe "${g.product} ${g.quantity || ""}" ≠ sheet "${s.product}"`);
    if (!amountOk(g.amount, s.amount)) diffs.push(`Prix: groupe ${g.amount} ≠ sheet ${s.amount}`);
    out.push({ status: diffs.length ? "mismatch" : "ok", group: g, sheet: s, diffs });
  }
  for (const s of sheetRows) if (!used.has(s.id)) out.push({ status: "missing_in_group", group: null, sheet: s, diffs: [] });
  return out;
}

/**
 * Reçus ↔ opérations bancaires. Kayrj3 {receipts: [{receipt, status, tx}], unmatchedTx}
 * status: received | name_diff | not_received
 */
export function matchReceiptsToBank(receipts, transactions) {
  const usedTx = new Set();
  const result = receipts.map((r) => {
    let best = null;
    transactions.forEach((t) => {
      if (usedTx.has(t.id) || r.amount == null || Math.abs(t.amount - r.amount) > 0.5) return;
      if (days(t.tx_date, r.transfer_date || r.posted_at?.slice(0, 10)) > 3) return;
      const score = Math.max(nameScore(r.sender_name, t.label), nameScore(r.posted_by, t.label));
      if (!best || score > best.score) best = { t, score };
    });
    if (!best) return { receipt: r, status: "not_received", tx: null };
    usedTx.add(best.t.id);
    return { receipt: r, status: best.score > 0 ? "received" : "name_diff", tx: best.t };
  });
  return { receipts: result, unmatchedTx: transactions.filter((t) => !usedTx.has(t.id)) };
}

/**
 * Commandes "virement" f Sheet ↔ reçus. Kayrj3 [{order, status, receipt}]
 * status: paid | receipt_only | amount_diff | fake_suspect | no_receipt
 */
export function matchOrdersToReceipts(orders, receiptResults) {
  const used = new Set();
  return orders.map((o) => {
    const free = receiptResults.filter((x) => !used.has(x.receipt.id));
    const hit =
      free.find((x) => x.receipt.order_ref && phoneKey(x.receipt.order_ref) === phoneKey(o.phone)) ||
      free.find((x) => samePhone(x.receipt.posted_phone, o.phone)) ||
      free.find((x) => amountOk(x.receipt.amount, o.amount) && x.receipt.amount != null &&
        (nameScore(o.client_name, x.receipt.sender_name) > 0 || nameScore(o.client_name, x.receipt.posted_by) > 0));
    if (!hit) return { order: o, status: "no_receipt", receipt: null };
    used.add(hit.receipt.id);
    let status = "receipt_only";
    if (!amountOk(hit.receipt.amount, o.amount)) status = "amount_diff";
    else if (hit.status === "received") status = "paid";
    else if (hit.status === "not_received" && days(hit.receipt.posted_at, new Date().toISOString()) >= 2) status = "fake_suspect";
    return { order: o, status, receipt: hit.receipt, tx: hit.tx };
  });
}
