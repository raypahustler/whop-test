import { requireRole, REGIONS } from "@/lib/auth";
import { virementsCheck, range } from "@/lib/data";
import { Badge, PAY_STATUS, Resolve, DateFilters, SheetErrors } from "../ui";
import Upload from "./upload";

export const dynamic = "force-dynamic";

const RECEIPT_STATUS = {
  received: ["ok", "✅ Wsl"], name_diff: ["warn", "⚠️ Montant OK, smiya la"], not_received: ["bad", "❌ Ma wslch"],
};

export default async function Virements({ searchParams }) {
  const sp = await searchParams;
  const { sb, profile } = await requireRole("admin", "supervisor");
  const rng = range(sp);
  const { bank, orders, signed, txCount, sheets } = await virementsCheck(sb, profile, rng);
  const n = (s) => orders.filter((o) => o.status === s).length;

  return (
    <>
      <h1>💰 Virements</h1>
      <p className="sub">Commandes b virement (Sheet) ↔ reçus (groupe) ↔ relevé bancaire</p>
      <SheetErrors sheets={sheets} />
      <div className="card"><Upload /><div className="small">{txCount} opération bancaire f 7 jours l-khrin. Tqder tsift screenshot l-bot f WhatsApp privé ta howa.</div></div>
      <DateFilters rng={rng} />
      <div className="kpis">
        {Object.entries(PAY_STATUS).map(([k, [cls, label]]) => (
          <div key={k} className="kpi"><div className="v"><span className={`badge ${cls}`} style={{ fontSize: 20 }}>{n(k)}</span></div><div className="l">{label}</div></div>
        ))}
      </div>

      <div className="card tablewrap">
        <h3 style={{ marginTop: 0 }}>Commandes b virement</h3>
        <table>
          <thead><tr><th>Statut</th><th>Commande (Sheet)</th><th>Reçu (groupe)</th><th>Bank</th><th></th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.key}>
                <td><Badge map={PAY_STATUS} status={o.status} /></td>
                <td><b>{o.order.client_name}</b> · {o.order.phone}<br /><span className="small">{REGIONS[o.order.region]} · {o.order.delivery_date} · {o.order.amount ?? "?"} DH</span></td>
                <td>{o.receipt ? <>
                  {o.receipt.amount ?? "?"} DH · {o.receipt.sender_name || o.receipt.posted_by}<br />
                  <span className="small">{o.receipt.bank} {o.receipt.reference}</span>
                  {signed[o.receipt.image_path] && <> · <a href={signed[o.receipt.image_path]} target="_blank">tswira</a></>}
                </> : <span className="small">—</span>}</td>
                <td className="small">{o.tx ? `${o.tx.tx_date} · ${o.tx.amount} DH · ${o.tx.label}` : "—"}</td>
                <td>{o.status !== "paid" && <Resolve kind="receipt" itemKey={o.key} resolution={o.resolution} path="/virements" />}</td>
              </tr>
            ))}
            {!orders.length && <tr><td colSpan={5} className="small">Ma kayna hta commande b virement f had l-période.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card tablewrap">
        <h3 style={{ marginTop: 0 }}>Ga3 les reçus dyal l-groupe</h3>
        <table>
          <thead><tr><th>Statut bank</th><th>Tsift</th><th>Montant</th><th>Expéditeur</th><th>Notes AI</th></tr></thead>
          <tbody>
            {bank.receipts.map(({ receipt: r, status, tx }) => (
              <tr key={r.id}>
                <td><span className={`badge ${RECEIPT_STATUS[status][0]}`}>{RECEIPT_STATUS[status][1]}</span>{tx && <div className="small">{tx.label}</div>}</td>
                <td className="small">{new Date(r.posted_at).toLocaleString("fr-MA", { timeZone: "Africa/Casablanca" })}<br />{r.posted_by}</td>
                <td>{r.amount ?? "?"} DH {signed[r.image_path] && <a href={signed[r.image_path]} target="_blank">🖼</a>}</td>
                <td>{r.sender_name}<div className="small">{r.bank}</div></td>
                <td className="small">{r.ai_notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!!bank.unmatchedTx.length && (
        <div className="card tablewrap">
          <h3 style={{ marginTop: 0 }}>💰 Flouss dakhlin bla reçu ({bank.unmatchedTx.length})</h3>
          <table><tbody>{bank.unmatchedTx.map((t) => <tr key={t.id}><td>{t.tx_date}</td><td>{t.amount} DH</td><td>{t.label}</td></tr>)}</tbody></table>
        </div>
      )}
    </>
  );
}
