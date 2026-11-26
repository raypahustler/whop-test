import Link from "next/link";
import { getProfile, REGIONS, allowedRegions } from "@/lib/auth";
import { ordersCheck, virementsCheck, range } from "@/lib/data";
import { SheetErrors } from "./ui";
import { refreshSheets } from "./actions";

export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }) {
  const sp = await searchParams;
  const { sb, profile } = await getProfile();
  const rng = range(sp);
  const { results, sheets } = await ordersCheck(sb, profile, rng);
  const canMoney = ["admin", "supervisor"].includes(profile.role);
  const v = canMoney ? await virementsCheck(sb, profile, rng) : null;

  const open = (r) => !r.resolution;
  const count = (st, reg) => results.filter((r) => r.status === st && open(r) && (!reg || (r.group || r.sheet).region === reg)).length;
  const missingMoney = v ? v.orders.filter((o) => ["no_receipt", "fake_suspect"].includes(o.status) && !o.resolution)
    .reduce((s, o) => s + (o.order.amount || 0), 0) : 0;

  return (
    <>
      {sp.denied && <div className="alert bad">Ma 3ndekch l-accès l dik l-page.</div>}
      <h1>Dashboard</h1>
      <p className="sub">Livraisons mn {rng.from} hta {rng.to}</p>
      <SheetErrors sheets={sheets} />
      <div className="kpis">
        <div className="kpi"><div className="v">{results.length}</div><div className="l">Commandes (groupe + sheet)</div></div>
        <div className="kpi"><div className="v" style={{ color: "var(--bad)" }}>{count("missing_in_sheet")}</div><div className="l">❌ F groupe, machi f Sheet</div></div>
        <div className="kpi"><div className="v" style={{ color: "var(--info)" }}>{count("missing_in_group")}</div><div className="l">❓ F Sheet, machi f groupe</div></div>
        <div className="kpi"><div className="v" style={{ color: "var(--warn)" }}>{count("mismatch")}</div><div className="l">⚠️ Différences</div></div>
        {v && <div className="kpi"><div className="v" style={{ color: "var(--bad)" }}>{missingMoney.toLocaleString("fr-MA")} DH</div><div className="l">💰 Virements ma wslouch</div></div>}
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Région</th><th>✅ OK</th><th>⚠️</th><th>❌ Machi f Sheet</th><th>❓ Machi f groupe</th></tr></thead>
          <tbody>
            {allowedRegions(profile).map((reg) => (
              <tr key={reg}>
                <td><Link href={`/orders?region=${reg}&from=${rng.from}&to=${rng.to}`}>{REGIONS[reg]}</Link></td>
                <td>{count("ok", reg)}</td><td>{count("mismatch", reg)}</td>
                <td>{count("missing_in_sheet", reg)}</td><td>{count("missing_in_group", reg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <form action={refreshSheets}><button className="ghost">🔄 3awd qra Google Sheets</button></form>
    </>
  );
}
