import { getProfile, REGIONS, allowedRegions } from "@/lib/auth";
import { ordersCheck, range } from "@/lib/data";
import { Badge, ORDER_STATUS, Resolve, DateFilters, SheetErrors } from "../ui";

export const dynamic = "force-dynamic";

const Cell = ({ o, src }) => !o ? <span className="small">—</span> : (
  <div>
    <b>{o.client_name || "?"}</b> · {o.phone}<br />
    {o.product} {src === "g" ? o.quantity || "" : ""}<br />
    <span className="small">{o.delivery_date}{src === "g" && o.delivery_time ? ` · ${o.delivery_time}` : ""}{o.amount != null ? ` · ${o.amount} DH` : ""}</span>
    {src === "s" && <div className="small">Ligne {o.rowNumber}</div>}
  </div>
);

export default async function Orders({ searchParams }) {
  const sp = await searchParams;
  const { sb, profile } = await getProfile();
  const rng = range(sp);
  const { results, sheets } = await ordersCheck(sb, profile, rng, sp.region);
  const status = sp.status || "problems";
  const shown = results.filter((r) =>
    status === "all" ? true : status === "problems" ? r.status !== "ok" && !r.resolution : r.status === status);
  const canResolve = ["admin", "supervisor"].includes(profile.role);
  const q = (s) => `?${new URLSearchParams({ ...sp, status: s })}`;
  const n = (s) => results.filter((r) => r.status === s).length;

  return (
    <>
      <h1>📦 Check commandes</h1>
      <p className="sub">Groupes WhatsApp ↔ Google Sheet</p>
      <SheetErrors sheets={sheets} />
      <DateFilters rng={rng} extra={allowedRegions(profile).length > 1 && (
        <label>Région<select name="region" defaultValue={sp.region || ""}>
          <option value="">Kolchi</option>
          {allowedRegions(profile).map((r) => <option key={r} value={r}>{REGIONS[r]}</option>)}
        </select></label>
      )} />
      <div className="tabs">
        <a className={status === "problems" ? "on" : ""} href={q("problems")}>À vérifier ({results.filter((r) => r.status !== "ok" && !r.resolution).length})</a>
        {Object.entries(ORDER_STATUS).map(([k, [, label]]) => (
          <a key={k} className={status === k ? "on" : ""} href={q(k)}>{label} ({n(k)})</a>
        ))}
        <a className={status === "all" ? "on" : ""} href={q("all")}>Kolchi ({results.length})</a>
      </div>
      <div className="card tablewrap">
        <table>
          <thead><tr><th>Statut</th><th>Région</th><th>WhatsApp groupe</th><th>Google Sheet</th><th>Message</th>{canResolve && <th></th>}</tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.key}>
                <td><Badge map={ORDER_STATUS} status={r.status} />{r.diffs.map((d) => <div key={d} className="diff">{d}</div>)}</td>
                <td>{REGIONS[(r.group || r.sheet).region]}</td>
                <td><Cell o={r.group} src="g" /></td>
                <td><Cell o={r.sheet} src="s" /></td>
                <td className="small" style={{ whiteSpace: "pre-wrap", maxWidth: 220 }}>{r.group?.raw_text}{r.group && <div>— {r.group.posted_by}</div>}</td>
                {canResolve && <td><Resolve kind="order" itemKey={r.key} resolution={r.resolution} path="/orders" /></td>}
              </tr>
            ))}
            {!shown.length && <tr><td colSpan={6} className="small">Walo hna 👌</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
