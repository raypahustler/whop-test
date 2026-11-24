// Kayqarn les opérations dyal l-bank m3a les reçus li f Sheet.
const norm = (s) => (s || "").toString().toLowerCase().normalize("NFD").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

function nameScore(a, b) {
  const wa = new Set(norm(a).split(" ").filter((w) => w.length > 2));
  const wb = norm(b).split(" ").filter((w) => w.length > 2);
  if (!wa.size || !wb.length) return 0;
  return wb.filter((w) => wa.has(w)).length / Math.min(wa.size, wb.length);
}

const days = (a, b) => (a && b ? Math.abs((new Date(a) - new Date(b)) / 86400000) : 0);

/**
 * receipts: [{rowNumber, amount, date, sender, status}]
 * transactions: [{date, amount, label}]
 * Kayrj3: [{rowNumber, status, bankInfo}] + transactions ma tlaqaw b walo
 */
export function compare(receipts, transactions) {
  const pending = receipts.filter((r) => !r.status || !r.status.startsWith("✅"));
  const usedTx = new Set();
  const updates = [];

  for (const r of pending) {
    let best = null;
    transactions.forEach((t, i) => {
      if (usedTx.has(i) || r.amount == null) return;
      if (Math.abs(t.amount - r.amount) > 0.5) return;
      if (days(t.date, r.date) > 3) return;
      const score = nameScore(r.sender, t.label);
      if (!best || score > best.score) best = { i, t, score };
    });
    if (best) {
      usedTx.add(best.i);
      const info = `${best.t.date || ""} | ${best.t.amount} DH | ${best.t.label}`;
      updates.push({
        rowNumber: r.rowNumber,
        status: best.score > 0 ? "✅ Reçu" : "⚠️ Montant OK, smiya différente",
        bankInfo: info,
      });
    } else {
      updates.push({ rowNumber: r.rowNumber, status: "❌ Pas reçu", bankInfo: "" });
    }
  }

  const unmatched = transactions.filter((_, i) => !usedTx.has(i));
  return { updates, unmatched };
}

const digits = (s) => (s || "").toString().replace(/\D/g, "");
const samePhone = (a, b) => a && b && digits(a).slice(-9) === digits(b).slice(-9);
const sameOrder = (a, b) => a && b && digits(a) && digits(a) === digits(b);

/**
 * Kayqarn les commandes (virement) m3a les reçus dyal l-groupe.
 * orders: [{rowNumber, order, client, phone, amount}]
 * receipts: [{rowNumber, order, amount, sender, client, phone, status}]
 */
export function matchOrders(orders, receipts) {
  const used = new Set();
  const orderUpdates = [];
  const receiptLinks = [];

  const pick = (o, test) => receipts.find((r) => !used.has(r.rowNumber) && test(r));

  for (const o of orders) {
    const amountOk = (r) => o.amount == null || r.amount == null || Math.abs(r.amount - o.amount) <= 0.5;
    let r =
      pick(o, (r) => sameOrder(r.order, o.order)) ||
      pick(o, (r) => samePhone(r.phone, o.phone) && amountOk(r)) ||
      pick(o, (r) => r.amount != null && amountOk(r) && (nameScore(o.client, r.sender) > 0 || nameScore(o.client, r.client) > 0));

    if (!r) { orderUpdates.push({ ...o, status: "❌ Ma sift hta reçu" }); continue; }
    used.add(r.rowNumber);
    if (!r.order) receiptLinks.push({ rowNumber: r.rowNumber, order: o.order });

    let status;
    if (!amountOk(r)) status = `⚠️ Montant différent (reçu ${r.amount} DH)`;
    else if (r.status?.startsWith("✅")) status = "✅ Reçu + wsl l-bank";
    else if (r.status?.startsWith("❌")) status = "🚨 Reçu kayn walakin ma wslch l-bank";
    else status = "🧾 Reçu kayn (mazal ma tchecka m3a l-bank)";
    orderUpdates.push({ ...o, status, receiptRow: r.rowNumber });
  }

  const orphanReceipts = receipts.filter((r) => !used.has(r.rowNumber));
  return { orderUpdates, receiptLinks, orphanReceipts };
}
