# Locked-down Apps Script setup

Suppliers can only **submit**. Only someone with the admin key can read canvasses.

1. Open the Google Sheet that stores canvasses, then **Extensions > Apps Script**.
2. Paste `apps-script/Code.gs` over the existing code and save.
3. **Project Settings > Script properties > Add**: `ADMIN_KEY` = a long random string (16+ chars). Keep it secret.
4. **Deploy > New deployment > Web app**: Execute as **Me**, Who has access **Anyone**. Copy the `/exec` URL.
5. In `index.html`, set `SHEET_URL` to that URL and push.
6. Procurement opens `https://remultarachel.github.io/My-interactivecanvass-html/#admin=YOUR_KEY` once per browser session to see the Summary tab. The key is removed from the address bar and kept only for that tab.

Notes
- New data goes in a sheet tab named `Canvass_v2`; records from the old script are not migrated.
- Change the key any time in Script properties; old links stop working.
- The old `/exec` URL currently in `index.html` is public and returns all records until you replace it. Delete or archive that old deployment (Deploy > Manage deployments) after switching.
- A supplier can update only their own canvass (secret token kept in their browser) and not after it is finalized.
