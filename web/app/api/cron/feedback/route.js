import { queueAndSend } from "@/lib/feedback";

export const maxDuration = 300;

export async function GET(req) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return new Response("unauthorized", { status: 401 });
  return Response.json(await queueAndSend());
}
