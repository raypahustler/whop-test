"use client";
import { useActionState } from "react";
import { signIn } from "../actions";

export default function Login() {
  const [state, action, pending] = useActionState(signIn, null);
  return (
    <div className="login card">
      <h1>✅ Audit Check</h1>
      <p className="sub">Dkhol b compte dyalk</p>
      <form action={action}>
        <label>Email<input name="email" type="email" required /></label>
        <label>Mot de passe<input name="password" type="password" required /></label>
        {state?.error && <div className="alert bad">{state.error}</div>}
        <button disabled={pending}>{pending ? "..." : "Connexion"}</button>
      </form>
    </div>
  );
}
