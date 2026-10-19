const fs = require('fs');
const path = require('path');

const API_BASE = "https://api.datamartgh.shop";

const IGNORED_WORDS = new Set([
  'THE', 'AND', 'FOR', 'FREE', 'DATA', 'DROP', 'CODES', 'CODE', 'FAST', 'GUYS',
  'TRY', 'NOW', 'NEW', 'TODAY', 'ONLY', 'CLAIM', 'TELECEL', 'AIRTELTIGO',
  'GHANA', 'DATAMART', 'DATAMARTGH', 'HTTP', 'HTTPS', 'WWW', 'SHOP', 'BETA', 'PLEASE', 'GIVEAWAY',
  'MTN', 'STATUS', 'REDEEM', 'ENJOY', 'QUICK', 'CHECK', 'LINK', 'GROUP', 'JOIN',
  'WHATSAPP', 'CHANNEL', 'FOLLOW', 'SHARE', 'ADMIN', 'ALERT', 'UPDATE'
]);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractCodesFromText(text) {
  if (!text) return [];
  const words = text.match(/[a-zA-Z0-9_\-]+/g) || [];
  const codes = [];
  const seen = new Set();

  for (const w of words) {
    const clean = w.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (clean.length >= 3 && clean.length <= 30 && !IGNORED_WORDS.has(clean) && !seen.has(clean)) {
      seen.add(clean);
      codes.push(clean);
    }
  }
  return codes;
}

function orderCodes(codes, orderType = 'reverse') {
  const list = [...codes];
  if (orderType === 'reverse') {
    return list.reverse();
  } else if (orderType === 'shuffle') {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  } else if (orderType === 'middle') {
    const mid = Math.floor(list.length / 2);
    return list.sort((a, b) => Math.abs(codes.indexOf(a) - mid) - Math.abs(codes.indexOf(b) - mid));
  }
  return list;
}

class RedeemerEngine {
  constructor(storageDir = './data') {
    this.storageDir = storageDir;
    this.deadCodesFile = path.join(this.storageDir, 'dead_codes.json');
    this.deadCodes = this.loadDeadCodes();
    this.isRunning = false;
  }

  loadDeadCodes() {
    try {
      if (fs.existsSync(this.deadCodesFile)) {
        const raw = fs.readFileSync(this.deadCodesFile, 'utf8');
        return new Set(JSON.parse(raw));
      }
    } catch (e) {
      console.warn(`[Redeemer] Could not read dead_codes.json: ${e.message}`);
    }
    return new Set();
  }

  saveDeadCodes() {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
      }
      const arr = Array.from(this.deadCodes).slice(-3000);
      fs.writeFileSync(this.deadCodesFile, JSON.stringify(arr, null, 2), 'utf8');
    } catch (e) {
      console.warn(`[Redeemer] Could not save dead_codes.json: ${e.message}`);
    }
  }

  async claimCode(code, phone, token) {
    const url = `${API_BASE}/api/promo-codes/claim`;
    const payload = JSON.stringify({ code, phone });
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-auth-token': token,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    };

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers,
        body: payload,
        signal: AbortSignal.timeout(10000)
      });
      const data = await resp.json().catch(() => ({ message: resp.statusText }));
      return { status: resp.status, data };
    } catch (err) {
      return { status: 0, data: { message: err.message } };
    }
  }

  async processDrop(rawText, options = {}) {
    if (this.isRunning) {
      return { success: false, message: 'Already processing a drop! Queue busy.' };
    }

    this.isRunning = true;
    try {
      const phone = options.phone || process.env.TARGET_PHONE;
      const rawTokens = options.tokens || process.env.DATAMART_TOKENS || '';
      const orderType = options.order || process.env.SCAN_ORDER || 'reverse';

      const tokens = Array.isArray(rawTokens) 
        ? rawTokens 
        : rawTokens.split(',').map(t => t.trim()).filter(Boolean);

      if (!phone) {
        throw new Error('TARGET_PHONE is not configured!');
      }
      if (tokens.length === 0) {
        throw new Error('No DATAMART_TOKENS configured in pool!');
      }

      const extracted = extractCodesFromText(rawText);
      if (extracted.length === 0) {
        return { success: false, noCodes: true, message: 'No valid voucher codes found in text.' };
      }

      // Filter known dead codes
      const codesToRun = [];
      let filteredDeadCount = 0;
      for (const c of extracted) {
        if (this.deadCodes.has(c)) {
          filteredDeadCount++;
        } else {
          codesToRun.push(c);
        }
      }

      console.log(`[Redeemer] Extracted ${extracted.length} codes (${filteredDeadCount} dead filtered). Testing ${codesToRun.length} in [${orderType.toUpperCase()}] order.`);

      if (codesToRun.length === 0) {
        return {
          success: false,
          totalExtracted: extracted.length,
          filteredDead: filteredDeadCount,
          message: `All ${extracted.length} codes were already marked dead in memory.`
        };
      }

      const orderedCodes = orderCodes(codesToRun, orderType);
      let claimedResult = null;
      let i = 0;
      let requestIdx = 0;
      let burstCount = 0;

      while (i < orderedCodes.length) {
        const code = orderedCodes[i];
        const token = tokens[requestIdx % tokens.length];
        const acctNum = (requestIdx % tokens.length) + 1;

        console.log(`[Redeemer] [${i + 1}/${orderedCodes.length}] [Acct ${acctNum}] Testing: ${code}...`);
        const { status, data } = await this.claimCode(code, phone, token);

        if (status === 200 && data.success) {
          console.log(`[Redeemer] 🎉🎉 SUCCESS! Claimed code: ${code} 🎉🎉`);
          claimedResult = {
            success: true,
            code,
            reward: data.data?.rewardValue || 'Bonus',
            deliveryPhone: data.data?.deliveryPhone || phone,
            message: data.message || 'Data credited successfully!'
          };
          break;
        } else if (status === 429) {
          const backoff = tokens.length > 1 ? 2500 : 4500;
          console.log(`[Redeemer] ⚠️ Rate limit 429! Cooling down ${backoff}ms before retrying ${code}...`);
          await sleep(backoff);
          requestIdx++;
          burstCount = 0;
          // Do not increment i, retry same code
          continue;
        } else if (status === 401) {
          console.warn(`[Redeemer] Token for Acct ${acctNum} is invalid or expired (401)!`);
          if (tokens.length > 1) {
            requestIdx++;
            continue;
          } else {
            throw new Error('All auth tokens expired or invalid.');
          }
        } else if (status >= 500 || /unreachable|server error|database|gateway|backup|try again/i.test(String(data.message))) {
          console.log(`[Redeemer] ⚠️ Server overloaded (${data.message}). Waiting 3.5s...`);
          await sleep(3500);
          requestIdx++;
          continue;
        } else {
          // Normal rejection (already claimed, expired, invalid)
          const err = data.message || 'Invalid or claimed';
          console.log(`[Redeemer] Code ${code} FAILED: ${err}`);
          if (/already|expired|invalid|not found/i.test(String(err))) {
            this.deadCodes.add(code);
            this.saveDeadCodes();
          }
          i++;
          requestIdx++;
          burstCount++;
        }

        // Adaptive pacing between attempts
        if (i < orderedCodes.length) {
          if (burstCount < 7 * tokens.length) {
            await sleep(180);
          } else {
            const delay = Math.max(300, Math.floor(3500 / tokens.length));
            await sleep(delay);
          }
        }
      }

      return {
        success: !!claimedResult,
        claimed: claimedResult,
        totalExtracted: extracted.length,
        testedCount: i,
        filteredDead: filteredDeadCount
      };
    } finally {
      this.isRunning = false;
    }
  }
}

module.exports = {
  RedeemerEngine,
  extractCodesFromText,
  orderCodes
};
