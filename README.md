# ⚡ DataMart Free Data Auto-Redeemer Pro (v2.0)

A high-speed bot engineered specifically for **`beta.datamartgh.shop`** with advanced anti-429 defense, multi-token rotation, dead-code memory, and reverse/shuffle queue ordering.

---

## 🌟 What's New in v2.0

1. **Anti-429 Zero-Loss Retries**: 
   In previous versions, a 429 (`Too Many Attempts`) response would move on to the next code, causing rate-limited codes to be skipped unverified. Now, **no code is ever lost**. When a 429 occurs, the bot pauses to cool down the server token bucket and retries the exact same code until it receives a real verification (`claimed` vs `invalid` vs `success`).
2. **Scan Order Strategies (Beating the Crowd)**:
   - **⬆️ Bottom-Up / Reverse (Default & Recommended)**: In 150-code drops, 99% of people start from Code #1. Starting from the bottom means you test fresh codes that haven't been touched yet!
   - **🔀 Random Shuffle**: Shuffles the drop completely at random.
   - **🎯 Middle-Out**: Starts in the center of the list (e.g. Code 75) and works outward.
   - **⬇️ Top-to-Bottom**: Standard order.
3. **Dead-Code Memory Cache**:
   The bot automatically remembers every code that returned `already claimed` or `expired`. If an admin re-posts an old list or repeats codes across drops, the bot filters them out instantly without wasting your rate limit quota.
4. **Multi-Account / Multi-Token Pool (Round-Robin)**:
   You can add extra DataMart account `authToken`s in the **⚙️ Multi-Account** panel. The bot will automatically distribute requests round-robin across accounts (Token 1, Token 2, Token 3) to multiply your rate limit throughput by **2x or 3x**, while still sending all claimed data to your **single target phone number**.
5. **Adaptive Burst Pacing**:
   Rapidly bursts the first ~7 requests per token (~180ms), then smoothly transitions to an adaptive pace (~3.5s divided across your account pool) to stay permanently under the server's rate-limiting threshold.

---

## 📦 How to Update / Reload the Chrome Extension

If you already have the extension loaded in Chrome / Edge:
1. Open `chrome://extensions/` (or `edge://extensions/`).
2. Find **DataMart Free Data Auto-Redeemer**.
3. Click the **🔄 Reload (circular arrow)** icon.
4. Refresh `https://beta.datamartgh.shop` — you will see the new v2.0 panel at the bottom right!

---

## 📜 How to Update the Tampermonkey Userscript

1. Open Tampermonkey in your browser and click on your DataMart script.
2. Replace its entire contents with:
   ```
   c:\Users\Jason\Desktop\Pjs\fre da\userscript\datamart_auto_redeemer.user.js
   ```
3. Press **Ctrl + S** to save.
4. Refresh `https://beta.datamartgh.shop`.

---

## 🐍 How to Run the Python CLI Bot

1. Open PowerShell or Command Prompt:
   ```powershell
   cd "c:\Users\Jason\Desktop\Pjs\fre da\python_bot"
   python redeemer.py
   ```
2. Follow the on-screen prompts to select your Scan Strategy, paste codes, and run!
