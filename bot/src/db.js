import { createClient } from "@supabase/supabase-js";

// Service role key: kaybqa ghir f serveur dyal l-bot, 3mmrha ma tkoun f l-webapp côté client.
export const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function insert(table, row) {
  const { error } = await db.from(table).upsert(row, { onConflict: "wa_message_id", ignoreDuplicates: true });
  if (error) throw new Error(`${table}: ${error.message}`);
}

export const saveOrder = (row) => insert("group_orders", row);
export const saveReceipt = (row) => insert("receipts", row);

export async function saveImage(path, image) {
  const { error } = await db.storage.from("receipts")
    .upload(path, Buffer.from(image.data, "base64"), { contentType: image.mimeType, upsert: true });
  if (error) throw new Error(`storage: ${error.message}`);
  return path;
}

export async function saveBankTransactions(rows) {
  if (!rows.length) return 0;
  const { data, error } = await db.from("bank_transactions")
    .upsert(rows, { onConflict: "tx_date,amount,label", ignoreDuplicates: true }).select("id");
  if (error) throw new Error(`bank: ${error.message}`);
  return data.length;
}
