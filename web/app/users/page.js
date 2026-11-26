import { requireRole, ROLES, REGIONS } from "@/lib/auth";
import { updateUser } from "../actions";
import NewUser from "./new";

export const dynamic = "force-dynamic";

export default async function Users() {
  const { sb } = await requireRole("admin");
  const { data: users } = await sb.from("profiles").select("*").order("created_at");
  return (
    <>
      <h1>👥 Utilisateurs</h1>
      <p className="sub"><b>Admin</b>: kolchi + users · <b>Superviseur</b>: ga3 les régions + virements + validation · <b>Staff</b>: check commandes dyal région dyalo</p>
      <div className="card"><NewUser /></div>
      <div className="card tablewrap">
        <table>
          <thead><tr><th>Nom</th><th>Rôle</th><th>Région</th><th></th></tr></thead>
          <tbody>
            {(users || []).map((u) => (
              <tr key={u.id}>
                <td>{u.full_name}</td>
                <td colSpan={3}>
                  <form action={updateUser} style={{ display: "flex", gap: 8 }}>
                    <input type="hidden" name="id" value={u.id} />
                    <select name="role" defaultValue={u.role}>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    <select name="region" defaultValue={u.region || ""}><option value="">Ga3 les régions</option>{Object.entries(REGIONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    <button className="ghost">Enregistrer</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
