# Serverless Email Tracker

A lightweight, high-performance, and privacy-focused email view tracker for Gmail. Built with Manifest V3 (via Plasmo), a Cloudflare Worker backend (Hono), and Cloudflare D1 (SQLite database).

---
<img width="1572" height="274" alt="image" src="https://github.com/user-attachments/assets/87435c88-8986-4592-ab15-0b33f617780e" />

<img width="1518" height="763" alt="image" src="https://github.com/user-attachments/assets/57e62723-033b-47ef-9071-128fa1f6b809" />

## 🚀 Features

- **Compose Toolbar Toggle**: "Tracking ON/OFF" button injected directly next to Gmail's Send button.
- **Auto-Track on Send**: An invisible 1x1 tracking pixel is embedded automatically when sending.
- **MailSuite-Style Badges**:
  - Green double checkmark (`✓✓`) in Gmail's Sent list right next to the recipient's name if the email has been viewed.
  - Grey single checkmark (`✓`) if the email is still pending.
  - Hover tooltips showing the recipient name and relative opened time.
- **Owner-View Protection**: Reverts open statuses triggered by you opening your own sent mail (both in list views and single email view).
- **Embedded Analytics Dashboard**: A premium statistics page built directly into the extension, displaying:
  - Total emails tracked, opened, and pending.
  - Overall open rate (%) with time metrics (opened today/this week).
  - Searchable list of tracked emails.
  - One-click CSV export of your data.
- **100% Serverless & Free**: Runs entirely on Cloudflare's free tier. No VPS, external databases, or Docker containers to configure or pay for.
- **High Performance**: Optimised with a 150ms debounce filter on the DOM mutation observer to reduce CPU footprint by 99% during scroll and page load.

---

## 🛠️ Folder Structure

```
magio/
├── extension/             # Plasmo Chrome Extension
│   ├── lib/               # Storage, API bindings, Gmail DOM manipulation
│   ├── tabs/              # Extension pages (Embedded Analytics Dashboard)
│   ├── content.ts         # Gmail DOM Injector (Optimised & Debounced)
│   └── popup.tsx          # Extension popup control toggle
├── worker/                # Cloudflare Worker Backend
│   ├── db/                # D1 Database SQL schema
│   ├── src/               # Hono router endpoints (/email, /pixel, /status, /stats)
│   └── wrangler.toml      # Wrangler configuration file
└── package.json           # Root package.json helper scripts
```

---

## 💻 Local Development Setup

### 1. Backend (Cloudflare Worker & D1 Database)
1. Navigate to the `worker/` directory:
   ```bash
   cd worker
   npm install
   ```
2. Initialize your local D1 SQLite database:
   ```bash
   npx wrangler d1 execute mailtracker-db --local --file=db/schema.sql --yes
   ```
3. Start the local dev server:
   ```bash
   npm run dev
   ```
   *The backend will boot up locally at `http://localhost:8787`.*

### 2. Chrome Extension (Plasmo)
1. Navigate to the `extension/` directory:
   ```bash
   cd extension
   npm install
   ```
2. Create a `.env` file inside the `extension/` directory pointing to your local server:
   ```env
   PLASMO_PUBLIC_API_URL=http://localhost:8787
   ```
3. Start the Plasmo development server:
   ```bash
   npm run dev
   ```
   *This compiles the extension into `extension/build/chrome-mv3-dev/`.*
4. Open Google Chrome and go to `chrome://extensions`.
5. Enable **Developer mode** (top-right toggle).
6. Click **Load unpacked** and select the compiled directory:
   `[root]/extension/build/chrome-mv3-dev`
7. Open Gmail and verify the integration!

---

## 🌐 Deploying to Cloudflare (Production)

1. Create a D1 Database in your Cloudflare account:
   ```bash
   cd worker
   npx wrangler d1 create mailtracker-db
   ```
2. Update the `database_id` inside `worker/wrangler.toml` with the ID returned by the command.
3. Deploy the SQL schema to the remote database:
   ```bash
   npx wrangler d1 execute mailtracker-db --remote --file=db/schema.sql --yes
   ```
4. Deploy the worker to production:
   ```bash
   npx wrangler deploy
   ```
5. Create a `.env` file inside the `extension/` directory pointing to your deployed worker URL:
   ```env
   PLASMO_PUBLIC_API_URL=https://mailtracker-backend.yourname.workers.dev
   ```
6. Build your production extension:
   ```bash
   cd extension
   npm run build
   ```
7. Open Chrome, go to `chrome://extensions`, delete the old dev extension, click **Load unpacked**, and select `extension/build/chrome-mv3-prod/`.

---

## 🚚 Setting Up on a New PC (Using Deployed Cloudflare Backend)

If your backend is already deployed to Cloudflare, you do not need to configure any databases or run local worker scripts on the new PC. Simply copy the extension files:

1. Clone the repository on the new PC:
   ```bash
   git clone https://github.com/jafar-b/email-tracker.git
   cd email-tracker/extension
   ```
2. Recreate the `.env` file in the `extension/` folder pointing to your deployed Worker:
   ```env
   PLASMO_PUBLIC_API_URL="https://mailtracker-backend.beldarjafar.workers.dev"
   ```
3. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```
4. Open Chrome, go to `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select `extension/build/chrome-mv3-prod/`.

---

## 📦 Sharing a ZIP Package

To install the extension directly onto another laptop (like an office laptop) without needing Git or NPM:

1. Package the built extension inside the `extension/` folder on your dev computer:
   ```bash
   npm run package
   ```
   *This outputs a clean `.zip` archive: `extension/build/chrome-mv3-prod.zip`.*
2. Send `chrome-mv3-prod.zip` to the other computer.
3. Extract the ZIP on the target laptop.
4. Go to `chrome://extensions`, enable **Developer Mode**, click **Load unpacked**, and select the extracted folder.
