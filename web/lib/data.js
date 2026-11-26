import { readSheets, isVirement } from "./sheets";
import { matchGroupToSheet, matchReceiptsToBank, matchOrdersToReceipts } from "./compare";
import { allowedRegions } from "./auth";

const iso = (d) => d.toISOString().slice(0, 10);
export function range(sp) {
  const today = new Date();
  return { from: sp.from || iso(today), to: sp.to || iso(new Date(today.getTime() + 2 * 86400000)) };
}
const inRange = (d, { from, to }) => d && d >= from && d <= to;

async function resolutionsMap(sb, kind) {
  const { data } = await sb.from("resolutions").select("*").eq("kind", kind);
  return Object.fromEntries((data || []).map((r) => [r.item_key, r]));
}

export async function ordersCheck(sb, profile, rng, regionFilter) {
  let regions = allowedRegions(profile);
  if (regionFilter && regions.includes(regionFilter)) regions = [regionFilter];

  const sheets = await readSheets(regions);
  const sheetRows = sheets.flatMap((s) => s.rows).filter((r) => inRange(r.delivery_date, rng));

  const { data: groupRows } = await sb.from("group_orders").select("*").in("region", regions)
    .gte("delivery_date", rng.from).lte("delivery_date", rng.to).order("delivery_date");
  // Commandes bla date f groupe: nqarnhom b date dyal l-message
  const { data: undated } = await sb.from("group_orders").select("*").in("region", regions).is("delivery_date", null)
    .gte("posted_at", rng.from).lte("posted_at", rng.to + "T23:59:59");

  const results = matchGroupToSheet([...(groupRows || []), ...(undated || [])], sheetRows);
  const res = await resolutionsMap(sb, "order");
  for (const r of results) {
    r.key = r.group ? `g${r.group.id}` : r.sheet.id;
    r.resolution = res[r.key];
  }
  return { results, sheets };
}

export async function virementsCheck(sb, profile, rng) {
  const from = new Date(new Date(rng.from).getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const [{ data: receipts }, { data: txs }] = await Promise.all([
    sb.from("receipts").select("*").gte("posted_at", from).order("posted_at", { ascending: false }),
    sb.from("bank_transactions").select("*").gte("tx_date", from).order("tx_date", { ascending: false }),
  ]);
  const bank = matchReceiptsToBank(receipts || [], txs || []);

  const sheets = await readSheets(allowedRegions(profile));
  const virementOrders = sheets.flatMap((s) => s.rows).filter((r) => isVirement(r) && inRange(r.delivery_date, rng));
  const orders = matchOrdersToReceipts(virementOrders, bank.receipts);

  const res = await resolutionsMap(sb, "receipt");
  for (const o of orders) { o.key = o.order.id; o.resolution = res[o.key]; }

  const signed = {};
  const paths = (receipts || []).map((r) => r.image_path).filter(Boolean);
  if (paths.length) {
    const { data } = await sb.storage.from("receipts").createSignedUrls(paths, 3600);
    (data || []).forEach((d) => { if (d.signedUrl) signed[d.path] = d.signedUrl; });
  }
  return { bank, orders, signed, txCount: (txs || []).length, sheets };
}
