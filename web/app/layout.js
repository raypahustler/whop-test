import "./globals.css";
import Link from "next/link";
import { supabase } from "@/lib/supabase/server";
import { ROLES, REGIONS } from "@/lib/auth";
import { signOut } from "./actions";

export const metadata = { title: "Audit Check" };

export default async function RootLayout({ children }) {
  const sb = await supabase();
  const { data: { user } } = await sb.auth.getUser();
  const { data: profile } = user ? await sb.from("profiles").select("*").eq("id", user.id).single() : { data: null };
  const canMoney = profile && ["admin", "supervisor"].includes(profile.role);

  return (
    <html lang="fr">
      <body>
        {!user ? children : (
          <div className="shell">
            <nav className="side">
              <div className="logo">✅ Audit Check</div>
              <Link href="/">📊 Dashboard</Link>
              <Link href="/orders">📦 Check commandes</Link>
              {canMoney && <Link href="/virements">💰 Virements</Link>}
              <Link href="/feedback">⭐ Feedback</Link>
              {profile?.role === "admin" && <Link href="/users">👥 Utilisateurs</Link>}
              <div className="me">
                {profile?.full_name}<br />
                {ROLES[profile?.role]}{profile?.region ? ` · ${REGIONS[profile.region]}` : ""}
                <form action={signOut}><button className="ghost" style={{ marginTop: 8, width: "100%" }}>Déconnexion</button></form>
              </div>
            </nav>
            <main>{children}</main>
          </div>
        )}
      </body>
    </html>
  );
}
