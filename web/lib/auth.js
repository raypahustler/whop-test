import { redirect } from "next/navigation";
import { supabase } from "./supabase/server";

export const ROLES = { admin: "Admin", supervisor: "Superviseur", staff: "Staff" };
export const REGIONS = { casablanca: "Casablanca", rabat: "Rabat" };

export async function getProfile() {
  const sb = await supabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await sb.from("profiles").select("*").eq("id", user.id).single();
  return { sb, user, profile: profile || { role: "staff", region: null } };
}

export async function requireRole(...roles) {
  const ctx = await getProfile();
  if (!roles.includes(ctx.profile.role)) redirect("/?denied=1");
  return ctx;
}

// Staff b region kaychouf ghir region dyalo
export const allowedRegions = (profile) =>
  profile.role === "staff" && profile.region ? [profile.region] : Object.keys(REGIONS);
