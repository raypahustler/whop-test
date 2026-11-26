"use client";
import { useActionState } from "react";
import { createUser } from "../actions";

export default function NewUser() {
  const [state, action, pending] = useActionState(createUser, null);
  return (
    <form action={action} className="filters">
      <label>Nom<input name="full_name" required /></label>
      <label>Email<input name="email" type="email" required /></label>
      <label>Mot de passe<input name="password" type="text" minLength={8} required /></label>
      <label>Rôle<select name="role" defaultValue="staff"><option value="staff">Staff</option><option value="supervisor">Superviseur</option><option value="admin">Admin</option></select></label>
      <label>Région<select name="region"><option value="">Ga3 les régions</option><option value="casablanca">Casablanca</option><option value="rabat">Rabat</option></select></label>
      <button disabled={pending}>➕ Zid</button>
      {state?.ok && <span className="badge ok">{state.ok}</span>}
      {state?.error && <span className="badge bad">{state.error}</span>}
    </form>
  );
}
