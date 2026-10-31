# Fee Register

A phone-friendly tuition fee register. A teacher keeps batches (each with its own monthly fee), students in those batches, and taps **Mark paid** to record the amount and date. A **Due** tab shows who hasn't paid, with WhatsApp and call buttons, and a monthly report downloads as CSV or prints to PDF.

Stack: Vite + React, Supabase (Postgres + email login), deployable on Vercel.

## Try it right now (demo mode)

```bash
npm install
npm run dev
```

With no Supabase keys set, the app runs on sample data saved in your browser only. No login. Good for trying every screen.

## Set up the real thing

### 1. Supabase

1. Create a project at supabase.com.
2. **SQL Editor** → paste all of `supabase/schema.sql` → Run. This creates the tables and makes each login see only its own rows.
3. **Authentication → Users → Add user** → enter the teacher's email and a password, tick **Auto Confirm User**.
4. **Authentication → Sign In / Providers** → turn off **Allow new users to sign up**, so only the account you created can log in.
5. **Project Settings → API** → copy the **Project URL** and the **anon public** key.

### 2. Run locally with the keys

```bash
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

### 3. Deploy on Vercel

1. Push this folder to a GitHub repo.
2. Import the repo in Vercel (framework: Vite is auto-detected).
3. Add the two `VITE_SUPABASE_*` variables under Settings → Environment Variables, then redeploy.
4. Open the URL on the teacher's phone → browser menu → **Add to Home screen**.

The anon key is safe to ship in the browser because row-level security (in `schema.sql`) blocks access without a login.

## Using it on phone, tablet and laptop

It's one website, so every device uses the same link and the same login, and the data is shared through Supabase. Change something on the phone and it shows on the laptop after a refresh.

- **Android (Chrome):** open the link → ⋮ menu → **Install app** (or **Add to Home screen**).
- **iPhone / iPad (Safari):** open the link → Share button → **Add to Home Screen**.
- **Laptop:** just bookmark it, or in Chrome/Edge use the install icon in the address bar to get a window of its own. On a wide screen the menu moves to a sidebar, students and dues show as tables, and forms open as centred dialogs. Tablets get a slightly wider version of the phone layout.

Once added, it opens full screen like an app. It needs an internet connection to load and save.

## Deleting things

- **Student:** tap the name → **Delete student**. This also deletes that student's payment records, so if they simply left, untick **Still attending** instead and the history stays.
- **Batch:** tap the pencil on the Batches tab → **Delete batch**. If it has students, the confirm screen says how many students and payment records go with it. To stop a class but keep the history, untick **Still attending** on each student instead.

## How the fee logic works

- A **batch** has a monthly fee. Students belong to one batch.
- Each student has a **fees start from** month. Earlier months are never counted as due.
- A **payment** is one row per student per month: amount received, date paid, optional note. Saving a payment marks that month settled, even if the amount is lower than the fee (a discount or part payment shows as "₹1,800 of ₹2,000").
- **Due** lists active students with unpaid months from their start month up to the month you are viewing. Mark a student "Still attending: off" when they leave and they drop out of the due list; their past payments stay.

## Layout

```
src/lib/db.js        Supabase backend + demo backend (same interface)
src/lib/calc.js      month totals and due list
src/lib/format.js    ₹ formatting, WhatsApp link, CSV parse/export
src/components/      screens and bottom sheets
supabase/schema.sql  tables + row-level security
```
