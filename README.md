# Bot Virement WhatsApp 🤖💰

L-bot kaydkhol l-groupe WhatsApp b numéro jdid w kayqra **kolchi**: les screenshots dyal les reçus w les messages b l-ktaba ("sifttlek 350 DH").
Kaysjjel kol virement f Google Sheet. Mli katsift lih screenshot dyal l-bank f privé, kayqarn w kayjawbek b rapport.

## Kifach kaykhdem
1. Client kaysift reçu f l-groupe → l-AI kayqra montant, smiya, date, banque, référence, N° commande.
2. Kaytsjjel f onglet **"Reçus WhatsApp"** b statut `⏳ En attente`.
3. Nta katsift l-bot **f privé** screenshot dyal l-historique bancaire.
4. L-bot kaybdl statut kol reçu (`✅ Reçu` / `⚠️ smiya différente` / `❌ Pas reçu`) w kaysift lik rapport:
   - Chkoun wslo
   - Chkoun ma wslouch
   - Flouss li dkhlo bla reçu

## Check dyal les commandes ↔ groupe
L-bot kaychouf kol commande f onglet **Orders** li l-paiement dyalha **virement**, w kayqlleb 3la reçu dyalha f l-groupe:
- 1) b N° commande, 2) b numéro dyal téléphone + montant, 3) b smiya + montant.

Kaysift lik rapport:
- ✅ Reçu kayn + flouss wslo l-bank
- 🧾 Reçu kayn, mazal ma tchecka m3a l-bank
- ⚠️ Montant f reçu machi howa montant dyal commande
- 🚨 Reçu kayn walakin flouss ma wslouch (yqder ykoun **faux reçu**)
- ❌ Commande b virement w l-client ma sift hta reçu
- ❓ Reçus f l-groupe ma 3ndhomch commande f Sheet

Had check kaytdar automatiquement mli katsift relevé bancaire. Ila bghitih bla relevé, sift l-bot f privé: **check**.
Smiyat les colonnes dyal Orders kat7ttehom f `.env` (`ORDERS_COL_...`). Ila 3mmrti `ORDERS_COL_STATUS`, l-bot ykteb statut f dik l-colonne nichan f Sheet dyal les commandes.

Comparaison: montant b dbt (±0.5 DH) + date (±3 jours) + smiya.

## Installation (mra wa7da)

### 1. Numéro l-bot
SIM jdida → WhatsApp (wla WhatsApp Business) → zidha l-groupe.

### 2. Clé Claude
[console.anthropic.com](https://console.anthropic.com) → API Keys → Create key.

### 3. Google Sheet
1. [console.cloud.google.com](https://console.cloud.google.com) → projet jdid → activer **Google Sheets API**.
2. IAM → Service Accounts → Create → Keys → Add key → JSON → 7tto f dossier b smiya `service-account.json`.
3. Ftah Google Sheet → **Partager** → zid l-email dyal service account (`...@...iam.gserviceaccount.com`) b droit **Éditeur**.
4. `SPREADSHEET_ID` howa li kayn f lien: `docs.google.com/spreadsheets/d/`**`HADA`**`/edit`

### 4. Lancement
```bash
npm install
cp .env.example .env   # 3mmer les valeurs
npm start
```
- Scanni QR code b telephone dyal numéro l-bot (WhatsApp → Appareils connectés).
- Sift chi message f l-groupe: l-bot ghadi ytb3 `ID` dyal l-groupe (`...@g.us`). 7tto f `GROUP_ID` w 3awd `npm start`.

### 5. Bach ybqa khddam 24/24
Hott l-bot 3la serveur (VPS, Railway...). Ila 3ndek VPS: `npm i -g pm2 && pm2 start src/index.js --name virement-bot`.
Khass dossier `auth/` ybqa mhfoud (fih session dyal WhatsApp).

## ⚠️ Mohimm
- Baileys **machi officiel**. Khdem ghir b numéro jdid. L-bot **ma kayjawbch f l-groupe** bach ma ytbloquach.
- Ghir numéro dyalk (`OWNER_NUMBER`) li yqder ysift relevé bancaire.
- Ma t3ti l-hta wa7ed `.env` wla `service-account.json`.
- Taman: kol reçu kaykllf ~0.05–0.20 DH f l-API (Claude Opus 5.5). Bach tnqes, bdl `CLAUDE_MODEL=claude-haiku-5-5` f `.env`.
