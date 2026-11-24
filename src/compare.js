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
