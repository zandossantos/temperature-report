# Temperature report — deploy to Vercel (report only)

This folder contains **only** what gets pushed to GitHub and deployed to Vercel.  
Your main Polymarket project, `.env`, and any secrets **never** go to GitHub.

---

## What you need

- A **GitHub account** (free): https://github.com/signup  
- A **Vercel account** (free): https://vercel.com/signup (you can sign up with GitHub)

---

## Step 1 — Get your report data

On your computer, in your **main Polymarket project** folder, run the tracker (or use an existing summary), then copy the summary into this deploy folder:

**Option A — From Polymarket project (recommended):**

```bash
cd c:\Users\zando\OneDrive\Desktop\VisualCode\Polymarket
npm run sync:summary-for-vercel
```

This copies the summary into both `data/summary.json` and `temperature-report-deploy\data\summary.json`. Then copy the whole **temperature-report-deploy** folder to your new report-only folder (Step 2).

**Option B — Manual copy:**

- Copy the file:  
  `PM\temperature-under-15c\summary.json`  
  (or wherever your tracker writes it)  
- Paste it into this folder as:  
  `temperature-report-deploy\data\summary.json`

---

## Step 2 — Create a new folder (report only)

You will push **only** the contents of `temperature-report-deploy` to GitHub. Not your full Polymarket project.

1. Create a new folder **outside** your Polymarket project, for example:
   - `C:\Users\zando\Desktop\temperature-report`
   - or `C:\Users\zando\Documents\temperature-report`

2. Copy **everything inside** `temperature-report-deploy` into that new folder:
   - `data\` (with `summary.json` inside it)
   - `scripts\` (with `build-report.js` inside it)
   - `vercel.json`
   - `.gitignore`
   - `README.md`

So the new folder should look like:

```
temperature-report/
  data/
    summary.json
  scripts/
    build-report.js
  vercel.json
  .gitignore
  README.md
```

---

## Step 3 — Create a GitHub repo (empty)

1. Go to https://github.com and sign in (or create an account).
2. Click the **+** (top right) → **New repository**.
3. Name it e.g. `temperature-report` (or anything you like).
4. Choose **Public**.
5. **Do not** add a README, .gitignore, or license (leave the repo empty).
6. Click **Create repository**.
7. Copy the repo URL (e.g. `https://github.com/YourUsername/temperature-report.git`).

---

## Step 4 — Push only this folder to GitHub

Open **Command Prompt** or **PowerShell** and go to the **new folder** you created (e.g. `C:\Users\zando\Desktop\temperature-report`):

```bash
cd C:\Users\zando\Desktop\temperature-report
```

Then run (replace the URL with your own repo URL from Step 3):

```bash
git init
git add .
git status
```

Check that `git status` lists only: `data/summary.json`, `scripts/build-report.js`, `vercel.json`, `.gitignore`, `README.md`.  
There must be **no** `.env`, no `src/`, no other Polymarket files.

Then:

```bash
git commit -m "Temperature report for Vercel"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

(If GitHub asks for login, use a **Personal Access Token** as password, or use GitHub Desktop.)

After this, **only** the report files are on GitHub. Your main Polymarket project is still only on your PC.

---

## Step 5 — Deploy on Vercel

1. Go to https://vercel.com and sign in (e.g. with GitHub).
2. Click **Add New…** → **Project**.
3. **Import** the repo you just created (`temperature-report` or whatever you named it).
4. Vercel will show:
   - **Build Command:** `node scripts/build-report.js` (from vercel.json)
   - **Output Directory:** `public`
   - **Install Command:** can stay empty or “echo No install needed”
5. Click **Deploy**.
6. Wait for the build to finish.

---

## Step 6 — Share the link

When the deploy is done, Vercel gives you a URL like:

`https://temperature-report-xxxx.vercel.app`

That is your report. Share it with anyone; they only see the report page, nothing else.

---

## Updating the report later

1. In your **Polymarket project**, run the tracker (or leave it running) so `summary.json` is updated.
2. Copy the new summary into the **report-only** folder:
   - From Polymarket folder:  
     `copy PM\temperature-under-15c\summary.json C:\Users\zando\Desktop\temperature-report\data\summary.json`  
     (adjust paths if your folder is elsewhere)
3. In the **report-only** folder:
   ```bash
   cd C:\Users\zando\Desktop\temperature-report
   git add data/summary.json
   git commit -m "Update report data"
   git push
   ```
4. Vercel will redeploy automatically; the same URL will show the new report.

---

## Summary

- You never push your main Polymarket project or any secrets.
- You only ever push the small **temperature-report** folder (data + build script + config).
- GitHub holds only: report data, build script, and Vercel config.
- Vercel builds the HTML from that data and serves it at your public URL.
