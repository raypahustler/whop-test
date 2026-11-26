"use server";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { supabase, admin } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { extractStatement } from "@/lib/ai";

export async function signIn(_, formData) {
  const sb = await supabase();
  const { error } = await sb.auth.signInWithPassword({ email: formData.get("email"), password: formData.get("password") });
  if (error) return { error: "Email wla mot de passe ghalet" };
  redirect("/");
}

export async function signOut() {
  const sb = await supabase();
  await sb.auth.signOut();
  redirect("/login");
}

export async function refreshSheets() {
  revalidateTag("sheets");
  revalidatePath("/", "layout");
}

export async function uploadBankScreenshots(_, formData) {
  const { sb, user } = await requireRole("admin", "supervisor");
  const files = formData.getAll("screens").filter((f) => f && f.size);
  if (!files.length) return { error: "Khtar chi screenshot" };
  const images = [];
  for (const f of files) {
    const buf = Buffer.from(await f.arrayBuffer());
    const path = `bank/${Date.now()}-${f.name.replace(/[^\w.-]/g, "_")}`;
    await admin().storage.from("receipts").upload(path, buf, { contentType: f.type });
    images.push({ mimeType: f.type, data: buf.toString("base64"), path });
  }
  const txs = await extractStatement(images);
  const rows = txs.map((t) => ({ tx_date: t.date, amount: t.amount, label: t.label, screenshot_path: images[0].path, uploaded_by: user.id }));
  const { data, error } = await sb.from("bank_transactions").upsert(rows, { onConflict: "tx_date,amount,label", ignoreDuplicates: true }).select("id");
  if (error) return { error: error.message };
  revalidatePath("/virements");
  return { ok: `${txs.length} opération tqrat · ${data.length} jdad` };
}

export async function resolveItem(formData) {
  const { sb, user } = await requireRole("admin", "supervisor");
  await sb.from("resolutions").upsert({
    kind: formData.get("kind"), item_key: formData.get("key"), status: formData.get("status"),
    note: formData.get("note") || null, resolved_by: user.id,
  }, { onConflict: "kind,item_key" });
  revalidatePath(formData.get("path") || "/");
}

export async function createUser(_, formData) {
  await requireRole("admin");
  const a = admin();
  const { data, error } = await a.auth.admin.createUser({
    email: formData.get("email"), password: formData.get("password"), email_confirm: true,
    user_metadata: { full_name: formData.get("full_name") },
  });
  if (error) return { error: error.message };
  await a.from("profiles").upsert({
    id: data.user.id, full_name: formData.get("full_name"),
    role: formData.get("role"), region: formData.get("region") || null,
  });
  revalidatePath("/users");
  return { ok: `Compte tcreé l ${formData.get("email")}` };
}

export async function updateUser(formData) {
  await requireRole("admin");
  await admin().from("profiles").update({ role: formData.get("role"), region: formData.get("region") || null }).eq("id", formData.get("id"));
  revalidatePath("/users");
}

export async function sendFeedbackNow(_, formData) {
  await requireRole("admin", "supervisor");
  const { queueAndSend } = await import("@/lib/feedback");
  try {
    const r = await queueAndSend({ date: formData.get("date") || undefined });
    revalidatePath("/feedback");
    return { ok: `${r.date}: ${r.found} livraison · ${r.sent} tsift · ${r.failed} fشل`.replace("fشل", "erreur") };
  } catch (e) { return { error: e.message }; }
}

export async function markFollowup(formData) {
  const { sb } = await requireRole("admin", "supervisor");
  await sb.from("feedback_requests").update({ followup_done: true }).eq("id", formData.get("id"));
  revalidatePath("/feedback");
}
