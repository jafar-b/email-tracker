# Serverless Email Tracker

A lightweight, serverless, and privacy-focused email view tracker for Gmail. Built with Manifest V3 (via Plasmo), a Cloudflare Worker backend (Hono), and Cloudflare D1 (SQLite database).

---
<img width="1572" height="274" alt="image" src="https://github.com/user-attachments/assets/87435c88-8986-4592-ab15-0b33f617780e" />

<img width="1518" height="763" alt="image" src="https://github.com/user-attachments/assets/57e62723-033b-47ef-9071-128fa1f6b809" />

## 🚀 Features

- **Compose Toolbar Toggle**: "Tracking ON/OFF" button injected directly next to Gmail's Send button.
- **Auto-Track on Send**: An invisible 1x1 tracking pixel is embedded automatically.
- **MailSuite-Style Badges**:
  - Green double checkmark (`✓✓`) in Gmail's Sent list if the email has been viewed.
  - Grey single checkmark (`✓`) if the email is still pending.
  - Hover tooltips showing the recipient and relative opened time.
- **Owner-View Protection**: Reverts opens triggered by the sender opening their own sent mail.
- **Embedded Analytics Dashboard**: A premium statistics page built directly into the extension, displaying:
  - Total emails tracked, opened, and pending.
  - Overall open rate (%) with time metrics (opened today/this week).
  - Searchable list of tracked emails.
  - One-click CSV export of your data.
- **100% Serverless & Free**: Runs entirely on Cloudflare's free tier. No VPS, databases, or Docker containers to configure or pay for.

---

## 🛠️ Folder Structure

```
magio/
├── extension/             # Plasmo Chrome Extension
│   ├── lib/               # Storage, API bindings, Gmail DOM manipulation
│   ├── tabs/              # Extension pages (Embedded Analytics Dashboard)
│   ├── content.ts         # Gmail DOM Injector
│   └── popup.tsx          # Extension popup control toggle
├── worker/                # Cloudflare Worker Backend
│   ├── db/                # D1 Database SQL schema
│   ├── src/               # Hono router endpoints (/email, /pixel, /status, /stats)
│   └── wrangler.toml      # Wrangler configuration file
└── package.json           # Root package.json helper scripts
```

---

## 💻 Local Development

### 1. Backend (Cloudflare Worker & D1)
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
2. Start the Plasmo development server:
   ```bash
   npm run dev
   ```
   *This compiles the extension into `extension/build/chrome-mv3-dev/`.*
3. Open Google Chrome and go to `chrome://extensions`.
4. Enable **Developer mode** (top-right toggle).
5. Click **Load unpacked** and select the compiled directory:
   `[root]/extension/build/chrome-mv3-dev`
6. Open Gmail and verify the integration!

---

## 🌐 Cloudflare Deployment (Production)

1. Create a D1 Database in your Cloudflare dashboard or via CLI:
   ```bash
   cd worker
   npx wrangler d1 create mailtracker-db
   ```
2. Update the `database_id` inside `worker/wrangler.toml` with the ID returned by the command.
3. Deploy the SQL schema to the remote database:
   ```bash
   npx wrangler d1 execute mailtracker-db --remote --file=db/schema.sql
   ```
4. Deploy the worker:
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
   Load the production bundle located in `extension/build/chrome-mv3-prod/` into your browser.
