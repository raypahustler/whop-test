# Audit Check — Handoff (bach tkml f chat jdid)

**Repo:** raypahustler/whop-test · **Branch:** claude/virment-tracking-comparison-3f35sd

## L-projet
Webapp "Audit Check" l traiteur marocain (allopastilla.site):
- Groupes WhatsApp: **Casablanca** (commandes), **Rabat** (commandes), **Virements** (reçus).
- CRM = **2 Google Sheets** (Casablanca region, Rabat region) + allopastilla.site (mazal ma trbtch, ma 3rfnach wach fih API).
- Format commande f groupe: `vendredi 27 novembre mea 17h / plateau 12 pieces / rabat hay riyad prestigia+15liv / mayssane / 0661986331 / mea 18h`
- Rôles: admin, supervisor, staff (staff = région dyalo ghir).

## Architecture
- `bot/` — Baileys (numéro WhatsApp normal, kayqra ghir, ma kayjawbch) → Claude kayqra commandes/reçus/relevés → Supabase.
- `web/` — Next.js 15 + Supabase auth/RLS. Pages: Dashboard, Check commandes (groupe ↔ Sheet), Virements (Sheet "virement" ↔ reçus ↔ bank screenshot), Utilisateurs.
- `supabase/schema.sql` — tables + RLS. `web/lib/compare.js` — moteur de matching (téléphone + date + montant + smiya).
- AI: Claude (`claude-opus-5-5`, structured outputs JSON schema, `fallbacks: "default"`).

## Status
- ✅ Phase 1 kamla, build OK, logique mjarrba b données khawyin. **Mazal ma tjarrbat m3a Supabase/Sheets/WhatsApp dyal bssah** (ma kaynach clés).
- 🚧 Phase 2 Feedback (WhatsApp Business Cloud API) — WIP:
  - Kayn: `supabase/002_feedback.sql`, `web/lib/whatsapp.js` (send template, signature), `web/lib/feedback.js` (cron: livraisons J+delay → template; webhook: jawab → Claude analyse note/sentiment/followup → remerciement), routes `web/app/api/whatsapp/webhook`, `web/app/api/cron/feedback`, `vercel.json` cron, actions `sendFeedbackNow`/`markFollowup`.
  - Khass: page `web/app/feedback/page.js` (KPIs: tsift, taux réponse, note moyenne; liste "needs followup" f l-awwel; bouton envoi manuel), `npm run build`, test.

## Mazal khassna mn l-user
1. Smiyat les colonnes dyal les 2 Sheets (ligne 1) — defaults f `web/.env.example` (COL_*).
2. allopastilla.site: wach fih API / export?
3. Template feedback (texte) + ch7al mn nhar mn b3d livraison. Proposition template Meta (`feedback_commande`, fr):
   "Salam {{1}} 👋 Choukran 3la commande dyalk ({{2}}). Kifach lqitiha? Jawbna b note mn 1 l 5 ⭐ w ila bghiti zid commentaire 🙏"
