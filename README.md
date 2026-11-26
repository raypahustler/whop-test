# Audit Check ✅

Webapp kat9arn les commandes dyal **groupes WhatsApp (Casablanca, Rabat)** m3a **Google Sheets**, w kattcheki les **virements** (reçus f groupe ↔ relevé bancaire).

```
bot/       Bot WhatsApp (numéro normal, lecture seule) → kayqra 3 groupes → Supabase
web/       Webapp Next.js (Dashboard, Check commandes, Virements, Utilisateurs)
supabase/  schema.sql (tables + sécurité par rôle)
```

## Chno kaydir
| Section | Check |
|---|---|
| 📦 Check commandes | Kol commande f groupe Casa/Rabat → wach kayna f Sheet dyal region? (b téléphone + date). ❌ machi f Sheet · ❓ machi f groupe · ⚠️ date/quantité/prix différents |
| 💰 Virements | Commandes "virement" f Sheet ↔ reçus f groupe ↔ screenshot bank. ✅ khlas · 🧾 reçu bla bank · ⚠️ montant · 🚨 reçu bla flouss · ❌ bla reçu |
| 👥 Rôles | **Admin**: kolchi + users · **Superviseur**: ga3 les régions + virements + validation · **Staff**: commandes dyal région dyalo |
| ⭐ Feedback | Phase 2 (WhatsApp Business API) |

## Installation

### 1. Supabase
1. Créé projet f [supabase.com](https://supabase.com).
2. SQL Editor → colle `supabase/schema.sql` → Run.
3. Authentication → Users → Add user (email dyalk). Mn b3d f SQL Editor:
   `update profiles set role = 'admin' where id = (select id from auth.users where email = 'EMAIL_DYALK');`
4. Settings → API: khod `URL`, `anon key`, `service_role key`.

### 2. Google
1. Google Cloud → projet → activer **Google Sheets API** → Service account → Key JSON.
2. Partagi les 2 Sheets (Casablanca, Rabat) m3a email dyal service account (**Lecteur** kafi).

### 3. Webapp (Vercel)
`cd web && cp .env.example .env.local` → 3mmer kolchi → `npm install && npm run dev`.
F Vercel: importer repo, Root Directory = `web`, zid les variables dyal `.env.example`.
Ila smiyat les colonnes dyal Sheet mkhtalfin, bdl `COL_*` (l-app katwerrik ila chi colonne ma tlqatch).

### 4. Bot (VPS)
`cd bot && cp .env.example .env` → 3mmer → `npm install && npm start` → scanni QR b numéro l-bot.
Sift message f kol groupe: l-bot kaytb3 l-ID dyalo → 7tto f `GROUP_CASABLANCA` / `GROUP_RABAT` / `GROUP_VIREMENTS` → restart.
Bach ybqa khddam: `pm2 start src/index.js --name audit-bot`. Hfd dossier `auth/`.

## ⚠️ Sécurité
- `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, JSON dyal Google: ghir f serveur, 3mmrhom f Git.
- L-bot ma kayjawb f hta groupe (bach numéro ma ytbloquach).
