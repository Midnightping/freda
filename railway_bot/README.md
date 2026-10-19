# ⚡ DataMart 24/7 WhatsApp Channel Auto-Redeemer (Railway Edition)

An autonomous cloud bot that runs 24/7 on **Railway**, monitors your target **WhatsApp Channel** for promo code drops via real-time WebSockets, executes instant multi-token redemption with anti-429 defense, and sends a WhatsApp DM directly to your personal phone when data is won!

---

## 🚀 Key Advantages

1. **Zero PC Requirement**: Your laptop or desktop can be turned off, asleep, or in another country.
2. **Sub-Second Latency**: Directly connects via WhatsApp WebSockets in a high-speed data center.
3. **No Chromium / Heavy Browser**: Built on pure Node.js + `@whiskeysockets/baileys` consuming ~50MB RAM (costs pennies per month on Railway).
4. **Permanent Login with Railway Volumes**: Your WhatsApp session is preserved across Railway restarts and updates.
5. **No Camera / QR Scanning Needed**: Uses WhatsApp's **Pairing Code** feature. Just enter an 8-character code in your phone's WhatsApp settings!
6. **Remote Control via DM**: You can text `!status` or manually paste drops with `!drop <codes>` right inside WhatsApp.

---

## 🛠️ Step-by-Step Railway Deployment

### Step 1: Push or Upload to GitHub
1. Commit the `railway_bot` folder to a GitHub repository (or the entire project).
2. Go to [railway.app](https://railway.app) and create a **New Project**.
3. Select **Deploy from GitHub repo** and choose your repository (select the `railway_bot` root directory if in a monorepo).

---

### Step 2: Add a Persistent Volume (Important!)
*To prevent WhatsApp from asking you to log in again whenever Railway redeploys:*
1. In your Railway project, click on your bot service.
2. Go to the **Volumes** tab.
3. Click **Add Volume**.
4. Set the Mount Path to:
   ```
   /data
   ```
5. Click **Add Volume**.

---

### Step 3: Configure Environment Variables
Go to the **Variables** tab in your Railway service and add the following:

| Variable | Example Value | Description |
| :--- | :--- | :--- |
| `TARGET_PHONE` | `0244123456` | The phone number to receive the free data |
| `DATAMART_TOKENS` | `token1,token2` | Your DataMart session token(s) from `beta.datamartgh.shop` |
| `BOT_PHONE_NUMBER` | `233501234567` | Your **bot WhatsApp number** (international format with country code) |
| `OWNER_PHONE` | `233241234567` | Your **personal WhatsApp number** to receive winning DMs |
| `SCAN_ORDER` | `reverse` | `reverse` (Bottom-Up), `shuffle`, `middle`, or `top` |
| `CHANNEL_JID` | *(leave empty)* | Leave empty to listen to any followed channel, or fill in once known |
| `DATA_DIR` | `/data` | Path to persistent volume |
| `SESSION_DIR` | `/data/session` | Path to save WhatsApp credentials |

---

### Step 4: Link WhatsApp via Pairing Code (One-Time)
1. Go to the **Deployments** tab in Railway and click **View Logs**.
2. Within 10 seconds of starting, the logs will print:
   ```
   *******************************************************
   * 📲 YOUR WHATSAPP PAIRING CODE:                      *
   *                   ABCD-1234                         *
   *******************************************************
   ```
3. Open WhatsApp on your **bot phone**:
   - Go to **Settings > Linked Devices > Link a Device**.
   - Tap **"Link with phone number instead"** at the bottom.
   - Enter the 8-character code shown in your Railway logs.
4. That's it! The bot is now permanently connected. You'll receive a WhatsApp DM on your personal number saying:
   > `🟢 DataMart 24/7 Bot is ONLINE!`

---

### Step 5: Follow the Giveaway Channel
Make sure your bot WhatsApp account is **following** the target giveaway channel in WhatsApp. 

Any time the admin posts a list of codes, the bot automatically:
1. Grabs the message instantly.
2. Extracts voucher codes and filters dead ones.
3. Tests them bottom-up across your token pool.
4. Sends you a WhatsApp DM with the prize and winning code!

---

## 💬 WhatsApp Remote Control Commands

Send these messages to your bot from your `OWNER_PHONE` at any time:

* `!status` — Check if the bot is alive, view token pool count, and dead code cache size.
* `!drop <text>` — Manually paste codes to trigger an instant test run directly from your phone.
* `!help` — Display command guide.
