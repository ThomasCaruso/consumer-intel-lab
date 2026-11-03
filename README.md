# Consumer Intelligence Lab

A personal AI consumer-intelligence laboratory for a Digital Marketing course. It shows how an
advertising platform would model **you**: your interests, digital footprint, shopping style,
the segments you'd be targeted as, and the products you'd be recommended. Every profile is built
from your own authorized records only.

- **Live dashboard:** https://thomascaruso.github.io/consumer-intel-lab/
- **Privacy policy:** https://thomascaruso.github.io/consumer-intel-lab/privacy.html

```
CONNECT CHROME  →  APPROVE PERMISSION  →  EXPLORE MY PROFILE
```

## What's here

| Folder | What it is |
|---|---|
| `dashboard/` | React + TypeScript + Vite dashboard (sections A–I), deployed to GitHub Pages |
| `extension/` | Manifest V3 Chrome extension ("Connector") that reads `chrome.history` after you approve it |
| `scripts/` | `make-icons.mjs` (renders icons), `pack-extension.mjs` (zips the extension) |
| `store/` | Chrome Web Store listing text, permission justifications, and the upload zip (generated) |

### Dashboard sections

- **A. Consumer Overview:** KPIs, an interest constellation, and evidence-based insights tagged *observed* or *inferred*.
- **B. Interest Universe:** a force-directed graph of interests, sites, brands, searches and products, with Louvain communities, zoom, pan, drag, search, and the evidence behind every edge.
- **C. Digital Footprint:** a 24-hour radial clock, a weekly heatmap, an activity calendar, a category-flow Sankey, an interest streamgraph, habitual-vs-exploratory sites, interest changes, and a site table.
- **D. Personality & Shopping Style:** six behavioral tendencies with confidence, uncertainty bands, methods and limits.
- **E. Consumer Segments:** 15 marketing segments with transparent weighted formulas, an overlap map and a contribution matrix.
- **F. Product Discovery:** open a retailer page, capture its product with the extension (schema.org data only), and import catalogs.
- **G. Recommendations:** real products ranked against your profile, with a score breakdown. Prices are shown only when they were actually read.
- **H. AI vs. Reality:** grade each inference Accurate, Unsure or Inaccurate, then rate yourself. Your feedback re-weights the profile.
- **I. Data & Privacy:** connection status, sources, per-record deletion, the method, and a full reset.

### Analysis rules

- Observed facts and inferences are kept separate and labeled.
- Each finding gets a confidence level of High, Medium or Low.
- When evidence is thin, the finding reads **INSUFFICIENT DATA** instead of a guess.
- Health, religion, politics and sexuality are **never inferred**. Matching records are excluded before analysis, and only their count is shown.
- Logins, localhost and rapid reloads are filtered out as noise.

## Privacy model

- The published site contains **no personal data**. It is static code only.
- History goes from the extension to the open dashboard tab in your own browser, and all analysis runs locally in that tab.
- Nothing is sent to any server, AI API or analytics service.
- Raw records stay **in memory only**: closing the tab discards them. The only things kept in `localStorage` are your accuracy feedback, captured or imported product details, and the theme.
- The extension asks for `history` as an **optional** permission, requested only when you click *Approve*. It can be revoked from the dashboard or from `chrome://extensions`.
- URLs are scrubbed of credential-like parameters (tokens, codes, session IDs) before they leave the extension.
- The extension bridge only answers the dashboard's own origins.

## Install the extension (temporary, unpacked)

The Connector is **not published on the Chrome Web Store** (see `store/STORE_LISTING.md` for submission prep).

1. Download `consumer-intel-lab-extension.zip` from the dashboard's Overview page and unzip it, or use the `extension/` folder from this repo.
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the unzipped folder.
4. Reload the dashboard. It shows "Connector extension detected". Click **Approve history access**, accept Chrome's prompt, choose a period, then click **Analyze my history**.

You can also skip the extension and import files on the Overview page: Google Takeout (BrowserHistory.json, My Activity JSON or HTML), a ChatGPT `conversations.json` (only your own messages are used), an order-history CSV, or a generic CSV or JSON.

## Develop

```bash
cd dashboard
npm install
npm run dev            # http://localhost:5173 (the extension bridge also runs here)
npm test               # unit tests (vitest, synthetic fixtures only)
npm run build          # production build → dist/
npm run pack-extension # zip the extension into public/ and store/
```

### Automated extension test

`npm run e2e` (with the dev server running) loads the extension into a **throwaway Chromium profile**, seeds that profile with **synthetic** history, and drives the whole dashboard. It never touches your real Chrome profile.

Chrome stable ignores `--load-extension`, so point it at Playwright's Chromium:

```bash
CHROMIUM_PATH=/path/to/ms-playwright/chromium-XXXX/chrome-win64/chrome.exe npm run e2e
```

Automation cannot click Chrome's permission prompt. Part A tests the real optional-permission flow up to the prompt; part B uses a temporary copy of the manifest with `history` pre-granted. A **real installation test** (loading the extension in your own Chrome and approving the prompt) is a separate, manual step.

## How to delete everything

This project is fully self-contained. Removing it does not affect anything else.

1. **Extension:** go to `chrome://extensions` and click **Remove** on "Consumer Intelligence Lab Connector".
2. **Dashboard data in your browser:** Data & Privacy, then **Reset dashboard**. Or clear site data for `thomascaruso.github.io`.
3. **Local files:** delete the folder `C:\work\consumer-intel-lab`.
4. **GitHub repo and live site:** `gh repo delete ThomasCaruso/consumer-intel-lab`, or delete it under the repo's Settings on GitHub. This also takes the Pages site down.
