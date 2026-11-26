"use client";
import { useActionState } from "react";
import { uploadBankScreenshots } from "../actions";

export default function Upload() {
  const [state, action, pending] = useActionState(uploadBankScreenshots, null);
  return (
    <form action={action} className="filters">
      <label>Screenshots dyal l-bank (wa7d wla bzaf)<input type="file" name="screens" accept="image/*" multiple required /></label>
      <button disabled={pending}>{pending ? "⏳ L-AI kayqra..." : "📤 Upload w qarn"}</button>
      {state?.ok && <span className="badge ok">{state.ok}</span>}
      {state?.error && <span className="badge bad">{state.error}</span>}
    </form>
  );
}
