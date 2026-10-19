require('dotenv').config();
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');
const { RedeemerEngine } = require('./redeemer');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const SESSION_DIR = process.env.SESSION_DIR || path.join(DATA_DIR, 'session');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const redeemer = new RedeemerEngine(DATA_DIR);

function getCleanPhone(phone) {
  if (!phone) return '';
  return phone.replace(/[^0-9]/g, '');
}

function getOwnerJid() {
  const clean = getCleanPhone(process.env.OWNER_PHONE);
  if (!clean) return null;
  return `${clean}@s.whatsapp.net`;
}

async function sendOwnerAlert(sock, messageText) {
  const ownerJid = getOwnerJid();
  if (!ownerJid) {
    console.log(`[Alert] OWNER_PHONE not set. Message not sent via WhatsApp: ${messageText}`);
    return;
  }
  try {
    await sock.sendMessage(ownerJid, { text: messageText });
    console.log(`[Alert] Sent WhatsApp notification to ${ownerJid}`);
  } catch (err) {
    console.error(`[Alert] Failed to send WhatsApp notification: ${err.message}`);
  }
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  console.log(`\n=======================================================`);
  console.log(`  DataMart 24/7 WhatsApp Channel Auto-Redeemer (Railway)`);
  console.log(`  Baileys Engine Version: ${version.join('.')}`);
  console.log(`  Target Phone: ${process.env.TARGET_PHONE || 'Not set'}`);
  console.log(`  Owner Alert Phone: ${process.env.OWNER_PHONE || 'Not set'}`);
  console.log(`=======================================================\n`);

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'error' }),
    printQRInTerminal: !process.env.BOT_PHONE_NUMBER,
    auth: state,
    browser: ['Ubuntu', 'Chrome', '20.0.04']
  });

  sock.ev.on('creds.update', saveCreds);

  // Pairing code flow for Railway / headless cloud
  if (process.env.BOT_PHONE_NUMBER && !sock.authState.creds.registered) {
    const botNum = getCleanPhone(process.env.BOT_PHONE_NUMBER);
    console.log(`[Auth] Requesting pairing code for: +${botNum}...`);
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(botNum);
        console.log(`\n*******************************************************`);
        console.log(`* 📲 YOUR WHATSAPP PAIRING CODE:                      *`);
        console.log(`*                   ${code}                          *`);
        console.log(`*                                                     *`);
        console.log(`* Steps on your Bot Phone:                           *`);
        console.log(`* 1. Open WhatsApp -> Settings -> Linked Devices      *`);
        console.log(`* 2. Tap "Link a Device" -> "Link with phone number" *`);
        console.log(`* 3. Type the 8-letter code above!                    *`);
        console.log(`*******************************************************\n`);
      } catch (err) {
        console.error('[Auth] Failed to generate pairing code:', err.message);
      }
    }, 4500);
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !process.env.BOT_PHONE_NUMBER) {
      console.log('[Auth] Scan the QR code below using your bot WhatsApp account:');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(`[Connection] Closed (Status ${statusCode}). Reconnecting: ${shouldReconnect}`);

      if (shouldReconnect) {
        setTimeout(startBot, 3000);
      } else {
        console.error('[Connection] Logged out. Delete session folder and restart to re-pair.');
      }
    } else if (connection === 'open') {
      console.log(`[Connection] ✓ WhatsApp Connected Successfully! Bot is LIVE 24/7.`);
      await sendOwnerAlert(sock, `🟢 DataMart 24/7 Bot is ONLINE!\n\nTarget Phone: ${process.env.TARGET_PHONE}\nListening for channel drops...`);
    }
  });

  // Message listener (Channels, Groups, and DMs)
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    for (const msg of messages) {
      if (!msg.message) continue;
      const jid = msg.key.remoteJid || '';
      const isFromMe = msg.key.fromMe;
      const isChannel = jid.endsWith('@newsletter');
      const isOwnerDM = getOwnerJid() && jid === getOwnerJid();

      // Extract message text content
      const text = msg.message.conversation ||
                   msg.message.extendedTextMessage?.text ||
                   msg.message.imageMessage?.caption ||
                   msg.message.videoMessage?.caption || '';

      if (!text.trim()) continue;

      // Handle Owner WhatsApp DM Commands (!status, !drop, !help)
      if (isOwnerDM && !isFromMe) {
        const cmd = text.trim();
        if (cmd === '!status' || cmd === '!ping') {
          const deadCount = redeemer.deadCodes.size;
          const tokensCount = (process.env.DATAMART_TOKENS || '').split(',').filter(Boolean).length;
          await sock.sendMessage(jid, {
            text: `🤖 *Bot Status: ONLINE*\n\n` +
                  `📱 *Target Phone:* ${process.env.TARGET_PHONE}\n` +
                  `🔑 *Auth Tokens in Pool:* ${tokensCount}\n` +
                  `🧠 *Dead Codes Filtered in Memory:* ${deadCount}\n` +
                  `⚡ *Scan Strategy:* ${process.env.SCAN_ORDER || 'reverse'}\n` +
                  `📡 *Target Channel JID:* ${process.env.CHANNEL_JID || 'Listening to all followed channels'}`
          });
          continue;
        } else if (cmd.startsWith('!drop') || cmd.startsWith('!redeem')) {
          const dropContent = cmd.replace(/^!(drop|redeem)\s*/i, '');
          await sock.sendMessage(jid, { text: `⚡ Processing manual drop from WhatsApp DM...` });
          const res = await redeemer.processDrop(dropContent);
          if (res.success && res.claimed) {
            await sock.sendMessage(jid, {
              text: `🎉 *SUCCESSFULLY REDEEMED!*\n\n` +
                    `🎁 *Reward:* ${res.claimed.reward}GB\n` +
                    `🔑 *Code:* ${res.claimed.code}\n` +
                    `📱 *Delivered To:* ${res.claimed.deliveryPhone}\n` +
                    `💬 *Server Message:* ${res.claimed.message}`
            });
          } else {
            await sock.sendMessage(jid, {
              text: `❌ Drop finished. None succeeded.\n${res.message || `Tested: ${res.testedCount || 0} codes.`}`
            });
          }
          continue;
        } else if (cmd === '!help') {
          await sock.sendMessage(jid, {
            text: `💡 *Available Commands:*\n\n` +
                  `• *!status* - Check if bot is alive and see token pool\n` +
                  `• *!drop <codes>* - Manually test/redeem a drop text right here\n` +
                  `• *!help* - Show this command list`
          });
          continue;
        }
      }

      // Handle WhatsApp Channel Drop Event
      if (isChannel) {
        console.log(`[Channel Post] Received message from channel: ${jid}`);

        // If specific CHANNEL_JID is set, verify match
        if (process.env.CHANNEL_JID && process.env.CHANNEL_JID !== jid) {
          console.log(`[Channel] Ignored post from ${jid} (Target is: ${process.env.CHANNEL_JID})`);
          continue;
        }

        console.log(`[Channel Drop] Incoming post content:\n${text.substring(0, 150)}...`);

        // Trigger Auto-Redeemer Engine immediately!
        const result = await redeemer.processDrop(text);

        if (result.noCodes) {
          console.log(`[Channel] No valid voucher codes in this post.`);
          continue;
        }

        if (result.success && result.claimed) {
          const alertMsg = 
            `🎉🎉 *DATAMART FREE DATA CLAIMED!* 🎉🎉\n\n` +
            `🎁 *Reward:* ${result.claimed.reward}GB Data\n` +
            `🔑 *Winning Code:* \`${result.claimed.code}\`\n` +
            `📱 *Delivered To:* ${result.claimed.deliveryPhone}\n` +
            `⚡ *Scan Mode:* Bottom-Up (${process.env.SCAN_ORDER || 'reverse'})\n` +
            `💬 *Server Note:* ${result.claimed.message}`;

          await sendOwnerAlert(sock, alertMsg);
        } else {
          const summaryMsg = 
            `⚡ *DataMart Drop Processed*\n\n` +
            `📊 Extracted: ${result.totalExtracted || 0} codes\n` +
            `🗑️ Skipped dead: ${result.filteredDead || 0}\n` +
            `🔍 Tested: ${result.testedCount || 0} codes\n` +
            `⚠️ Result: All tested codes were already claimed or expired.`;

          await sendOwnerAlert(sock, summaryMsg);
        }
      }
    }
  });
}

startBot().catch((err) => {
  console.error('[Fatal Error]', err);
  process.exit(1);
});
