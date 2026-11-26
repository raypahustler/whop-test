"use client";
import { useActionState } from "react";
import { sendFeedbackNow } from "../actions";

export default function SendNow({ defaultDate }) {
  const [state, action, pending] = useActionState(sendFeedbackNow, null);
  return (
    <form action={action} className="filters">
      <label>Livraisons dyal nhar<input type="date" name="date" defaultValue={defaultDate} /></label>
      <button disabled={pending}>{pending ? "⏳ Kaysift..." : "📨 Sift feedback daba"}</button>
      {state?.ok && <span className="badge ok">{state.ok}</span>}
      {state?.error && <span className="badge bad">{state.error}</span>}
    </form>
  );
}
