# Follow Check (insta-followers)

Find out who you follow on Instagram who doesn't follow you back — entirely in your browser.

**Live usage:** open `index.html` — no server, no install, no dependencies.

## How it works
Instagram doesn't allow scraping follower lists, so this tool works off Instagram's official **data export**:

1. Instagram app/web → **Settings** → **Your activity** → **Download your information**
2. Request a download (select **Followers and following**, format **JSON**)
3. Wait for the email link (minutes to 48h), download & extract the ZIP
4. Upload `followers_1.json` and `following.json` from the `followers_and_following` folder into the app

## Tips for accurate results
- **Upload ALL follower chunks** — large accounts are split into `followers_1.json`, `followers_2.json`, … Select them all at once (Ctrl/Cmd-click); anyone in a chunk you skip will be missing from the results.
- **Unzip the download first** — upload the `.json` files inside, not the ZIP (the app will tell you if you drop a ZIP by mistake).
- The export is a **snapshot** from the moment you requested it — follows/unfollows made afterwards won't be reflected.
- Works the same on **Windows, Mac, Linux, and mobile** — files edited in Notepad (BOMs, CRLF line endings), odd characters, and duplicate/case-variant usernames are all handled.
- Legacy and current export schemas (including `title`/`href`-only entries) are all counted.

## Features
- Drag-and-drop or file picker upload (multiple files merged — e.g. `followers_1.json`, `followers_2.json`)
- Three computed lists: **Not following back**, **Fans**, **Mutuals** (with counts)
- Searchable, sortable lists with A–Z quick-filter chips
- Copy usernames + CSV export per list
- Dark mode, mobile-friendly
- Handles current and legacy Instagram export JSON schemas (including `title`-based entries)

## Privacy
🔒 Nothing is uploaded or stored anywhere — all parsing happens in your browser. No backend, no network calls, no tracking.

---
Not affiliated with Instagram or Meta.
