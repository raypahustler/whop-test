import { admin } from "./supabase/server";
import { readSheetsFresh, isDelivered } from "./sheets";
import { REGIONS } from "./auth";
import { toIntl, sendFeedbackTemplate, sendText } from "./whatsapp";
import { analyzeFeedback } from "./ai";

const THANKS = {
  positive: "Choukran bzaf 🙏 farhtina! Ntsnnawk f commande jaya ❤️",
  neutral: "Choukran 3la l-avis dyalk 🙏 ghadi nkhdmo bach nkounou a7san.",
  negative: "Smh lina bzaf 🙏 l-équipe dyalna ghadi tttassel bik daba bach n7llo l-mochkil.",
};

// 1) Kaycreé les demandes l les livraisons dyal (lyoum - delay), 2) kaysift template
export async function queueAndSend({ date } = {}) {
  const db = admin();
  const delay = Number(process.env.FEEDBACK_DELAY_DAYS || 1);
  const target = date || new Date(Date.now() - delay * 86400000).toISOString().slice(0, 10);

  const sheets = await readSheetsFresh(Object.keys(REGIONS));
  const rows = sheets.flatMap((s) => s.rows).filter((r) => r.delivery_date === target && isDelivered(r));
  const seen = new Set();
  const toInsert = [];
  for (const r of rows) {
    const phone = toIntl(r.phone);
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    toInsert.push({ region: r.region, sheet_row_id: r.id, client_name: r.client_name, phone, product: r.product, delivery_date: target });
  }
  if (toInsert.length) await db.from("feedback_requests").upsert(toInsert, { onConflict: "phone,delivery_date", ignoreDuplicates: true });

  const { data: queued } = await db.from("feedback_requests").select("*").eq("status", "queued").limit(200);
  let sent = 0, failed = 0;
  for (const q of queued || []) {
    try {
      const id = await sendFeedbackTemplate(q.phone, q.client_name, q.product);
      await db.from("feedback_requests").update({ status: "sent", wa_message_id: id, sent_at: new Date().toISOString(), error: null }).eq("id", q.id);
      sent++;
    } catch (e) {
      await db.from("feedback_requests").update({ status: "failed", error: e.message }).eq("id", q.id);
      failed++;
    }
  }
  return { date: target, found: rows.length, queued: toInsert.length, sent, failed };
}

// Webhook: statuts (delivered/read/failed) w jawab dyal l-client
export async function handleWebhook(payload) {
  const db = admin();
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const v = change.value || {};

      for (const st of v.statuses || []) {
        const map = { delivered: "delivered", read: "read", failed: "failed" };
        if (!map[st.status]) continue;
        await db.from("feedback_requests").update({ status: map[st.status], ...(st.errors ? { error: st.errors[0]?.title } : {}) })
          .eq("wa_message_id", st.id).neq("status", "replied");
      }

      for (const m of v.messages || []) {
        const text = m.text?.body || m.button?.text || m.interactive?.button_reply?.title || m.interactive?.list_reply?.title || `[${m.type}]`;
        const since = new Date(Date.now() - 14 * 86400000).toISOString();
        const { data: req } = await db.from("feedback_requests").select("*").eq("phone", m.from)
          .gte("sent_at", since).order("sent_at", { ascending: false }).limit(1).maybeSingle();

        const { error: dup } = await db.from("feedback_messages").insert({ request_id: req?.id || null, phone: m.from, direction: "in", body: text, wa_message_id: m.id });
        if (dup || !req) continue; // doublon wla client ma 3ndoch demande

        const allText = [req.comment, text].filter(Boolean).join("\n");
        const a = await analyzeFeedback(allText, req.product);
        const first = req.status !== "replied";
        await db.from("feedback_requests").update({
          status: "replied", rating: a.rating ?? req.rating, comment: allText, sentiment: a.sentiment,
          ai_summary: a.summary, needs_followup: a.needs_followup, replied_at: new Date().toISOString(),
        }).eq("id", req.id);

        if (first && (a.rating || a.sentiment !== "neutral")) {
          const msg = THANKS[a.sentiment];
          const id = await sendText(m.from, msg).catch(() => null);
          await db.from("feedback_messages").insert({ request_id: req.id, phone: m.from, direction: "out", body: msg, wa_message_id: id });
        }
      }
    }
  }
}
