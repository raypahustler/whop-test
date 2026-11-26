import { resolveItem } from "./actions";

export const ORDER_STATUS = {
  ok: ["ok", "✅ OK"],
  mismatch: ["warn", "⚠️ Différence"],
  missing_in_sheet: ["bad", "❌ Machi f Sheet"],
  missing_in_group: ["info", "❓ Machi f groupe"],
};
export const PAY_STATUS = {
  paid: ["ok", "✅ Khlas (wsl l-bank)"],
  receipt_only: ["info", "🧾 Reçu kayn, mazal l-bank"],
  amount_diff: ["warn", "⚠️ Montant différent"],
  fake_suspect: ["bad", "🚨 Reçu bla flouss"],
  no_receipt: ["bad", "❌ Bla reçu"],
};

export const Badge = ({ map, status }) => <span className={`badge ${map[status][0]}`}>{map[status][1]}</span>;

export function Resolve({ kind, itemKey, resolution, path }) {
  if (resolution)
    return <span className={`badge ${resolution.status === "ok" ? "ok" : "bad"}`} title={resolution.note || ""}>
      {resolution.status === "ok" ? "✔ Validé" : "✖ Problème"}{resolution.note ? ` · ${resolution.note}` : ""}
    </span>;
  return (
    <form action={resolveItem} style={{ display: "flex", gap: 4 }}>
      <input type="hidden" name="kind" value={kind} /><input type="hidden" name="key" value={itemKey} />
      <input type="hidden" name="path" value={path} />
      <input name="note" placeholder="Note" style={{ width: 90, padding: "4px 6px" }} />
      <button name="status" value="ok" style={{ padding: "4px 8px" }}>✔</button>
      <button name="status" value="problem" className="ghost" style={{ padding: "4px 8px" }}>✖</button>
    </form>
  );
}

export function DateFilters({ rng, extra }) {
  return (
    <form className="filters">
      <label>Mn<input type="date" name="from" defaultValue={rng.from} /></label>
      <label>Hta<input type="date" name="to" defaultValue={rng.to} /></label>
      {extra}
      <button>Filtrer</button>
    </form>
  );
}

export function SheetErrors({ sheets }) {
  const bad = sheets.filter((s) => s.error || s.missing?.length);
  if (!bad.length) return null;
  return bad.map((s) => (
    <div key={s.region} className="alert warn">
      Sheet {s.region}: {s.error || `colonnes ma tlqawch: ${s.missing.join(", ")} (bdl COL_* f .env)`}
    </div>
  ));
}
