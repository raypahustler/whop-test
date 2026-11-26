import { getProfile, REGIONS } from "@/lib/auth";
import { DateFilters } from "../ui";
import { markFollowup } from "../actions";
import SendNow from "./send";

export const dynamic = "force-dynamic";

const iso = (d) => d.toISOString().slice(0, 10);
const STATUS = {
  queued: ["warn", "⏳ F l-queue"], sent: ["warn", "📨 Tsift"], delivered: ["warn", "✔ Wsl"],
  read: ["warn", "👀 Tqra"], failed: ["bad", "❌ Erreur"], replied: ["ok", "💬 Jawb"],
};
const SENTIMENT = { positive: ["ok", "🙂 Positif"], neutral: ["warn", "😐 Neutre"], negative: ["bad", "🙁 Négatif"] };
const stars = (n) => (n ? "⭐".repeat(n) : "—");
const fmt = (t) => (t ? new Date(t).toLocaleString("fr-MA", { timeZone: "Africa/Casablanca" }) : "");

function feedbackStats(rows) {
  const sent = rows.filter((r) => !["queued", "failed"].includes(r.status)).length;
  const replied = rows.filter((r) => r.status === "replied");
  const rated = replied.filter((r) => r.rating);
  return {
    sent, replied: replied.length,
    rate: sent ? Math.round((replied.length / sent) * 100) : 0,
    avg: rated.length ? (rated.reduce((s, r) => s + r.rating, 0) / rated.length).toFixed(1) : "—",
    failed: rows.filter((r) => r.status === "failed").length,
  };
}

export default async function Feedback({ searchParams }) {
  const sp = await searchParams;
  const { sb, profile } = await getProfile();
  const canAct = ["admin", "supervisor"].includes(profile.role);
  const today = new Date();
  const rng = { from: sp.from || iso(new Date(today.getTime() - 30 * 86400000)), to: sp.to || iso(today) };
  const yesterday = iso(new Date(today.getTime() - Number(process.env.FEEDBACK_DELAY_DAYS || 1) * 86400000));

  // RLS kaykhalli staff ychouf ghir region dyalo
  const { data, error } = await sb.from("feedback_requests").select("*")
    .gte("delivery_date", rng.from).lte("delivery_date", rng.to)
    .order("delivery_date", { ascending: false }).limit(1000);
  const rows = data || [];
  const k = feedbackStats(rows);
  const followups = rows.filter((r) => r.needs_followup && !r.followup_done);
  const rest = rows.filter((r) => !(r.needs_followup && !r.followup_done));

  const Row = ({ r }) => (
    <tr>
      <td><span className={`badge ${STATUS[r.status]?.[0] || "warn"}`}>{STATUS[r.status]?.[1] || r.status}</span>
        {r.error && <div className="small">{r.error}</div>}</td>
      <td><b>{r.client_name}</b> · {r.phone}<br /><span className="small">{REGIONS[r.region]} · {r.delivery_date} · {r.product}</span></td>
      <td>{stars(r.rating)}{r.sentiment && <> <span className={`badge ${SENTIMENT[r.sentiment]?.[0]}`}>{SENTIMENT[r.sentiment]?.[1]}</span></>}</td>
      <td className="small">{r.comment && <div>“{r.comment}”</div>}{r.ai_summary && <div><i>AI: {r.ai_summary}</i></div>}<div>{fmt(r.replied_at)}</div></td>
      <td>{canAct && r.needs_followup && !r.followup_done && (
        <form action={markFollowup}><input type="hidden" name="id" value={r.id} /><button className="ghost">✔ Tsalat</button></form>
      )}{r.followup_done && <span className="badge ok">✔ Tsalat</span>}</td>
    </tr>
  );
  const Head = () => <thead><tr><th>Statut</th><th>Client</th><th>Note</th><th>Commentaire</th><th></th></tr></thead>;

  return (
    <>
      <h1>⭐ Feedback clients</h1>
      <p className="sub">Template WhatsApp mn b3d l-livraison → jawab dyal l-client → analyse AI</p>
      {error && <div className="alert warn">Erreur: {error.message} (wach 002_feedback.sql tdar?)</div>}
      {canAct && <div className="card"><SendNow defaultDate={yesterday} /><div className="small">L-cron kaysift automatiquement kol nhar. Hna tqder tsift yadawi l nhar mo3ayan.</div></div>}
      <DateFilters rng={rng} />
      <div className="kpis">
        <div className="kpi"><div className="v">{k.sent}</div><div className="l">Tsiftou</div></div>
        <div className="kpi"><div className="v">{k.rate}%</div><div className="l">Taux réponse ({k.replied})</div></div>
        <div className="kpi"><div className="v">{k.avg}</div><div className="l">Note moyenne /5</div></div>
        <div className="kpi"><div className="v">{followups.length}</div><div className="l">Khasshom suivi</div></div>
        <div className="kpi"><div className="v">{k.failed}</div><div className="l">Erreurs</div></div>
      </div>

      {!!followups.length && (
        <div className="card tablewrap">
          <h3 style={{ marginTop: 0 }}>🚨 Khass ttassel bihom ({followups.length})</h3>
          <table><Head /><tbody>{followups.map((r) => <Row key={r.id} r={r} />)}</tbody></table>
        </div>
      )}

      <div className="card tablewrap">
        <h3 style={{ marginTop: 0 }}>Ga3 les demandes</h3>
        <table><Head /><tbody>
          {rest.map((r) => <Row key={r.id} r={r} />)}
          {!rest.length && <tr><td colSpan={5} className="small">Ma kayn walo f had l-période.</td></tr>}
        </tbody></table>
      </div>
    </>
  );
}
