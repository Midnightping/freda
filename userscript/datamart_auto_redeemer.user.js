// ==UserScript==
// @name         DataMart Free Data Auto-Redeemer Pro
// @namespace    https://datamartgh.shop/
// @version      2.1.0
// @description  Ultimate high-speed auto-redeemer bot for beta.datamartgh.shop: Anti-429 zero-loss retries, server crash auto-recovery, multi-token rotation, reverse/shuffle queues, and dead-code memory.
// @author       Antigravity
// @match        https://beta.datamartgh.shop/*
// @match        https://datamartgh.shop/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const existing = document.getElementById('dm-bot-container');
  if (existing) existing.remove();

  console.log('[DataMart Auto-Redeemer Pro v2.1] Loaded.');

  // Storage Keys
  const STORAGE_KEY_PHONE = 'dm_bot_phone';
  const STORAGE_KEY_DELAY = 'dm_bot_delay';
  const STORAGE_KEY_ORDER = 'dm_bot_order';
  const STORAGE_KEY_FILTER_DEAD = 'dm_bot_filter_dead';
  const STORAGE_KEY_DEAD_CODES = 'dm_dead_codes_cache';
  const STORAGE_KEY_EXTRA_TOKENS = 'dm_bot_extra_tokens';

  // Sound generator using Web Audio API
  function playSuccessSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5, E5, G5, C6, E6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.2, ctx.currentTime + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.1 + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.1);
        osc.stop(ctx.currentTime + i * 0.1 + 0.45);
      });
    } catch (e) {
      console.warn('Audio playback failed', e);
    }
  }

  const sleep = ms => new Promise(res => setTimeout(res, ms));

  // Dead Code Memory Cache
  function getDeadCodes() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DEAD_CODES);
      return new Set(raw ? JSON.parse(raw) : []);
    } catch (e) {
      return new Set();
    }
  }

  function addDeadCode(code) {
    try {
      const set = getDeadCodes();
      set.add(code.toUpperCase());
      const arr = Array.from(set);
      if (arr.length > 2500) arr.splice(0, arr.length - 2500);
      localStorage.setItem(STORAGE_KEY_DEAD_CODES, JSON.stringify(arr));
    } catch (e) {}
  }

  function clearDeadCodes() {
    localStorage.removeItem(STORAGE_KEY_DEAD_CODES);
  }

  // Extract promo codes
  function extractCodes(text) {
    if (!text || !text.trim()) return [];
    const lines = text.split(/[\r\n,;]+/);
    const codes = [];
    const seen = new Set();

    const ignoredWords = new Set([
      'THE', 'AND', 'FOR', 'FREE', 'DATA', 'DROP', 'CODES', 'CODE', 'FAST', 'GUYS', 
      'TRY', 'NOW', 'NEW', 'TODAY', 'ONLY', 'CLAIM', 'TELECEL', 'AIRTELTIGO',
      'GHANA', 'DATAMART', 'HTTP', 'HTTPS', 'WWW', 'SHOP', 'BETA', 'PLEASE', 'GIVEAWAY',
      'MTN', 'STATUS', 'REDEEM', 'ENJOY', 'QUICK', 'CHECK', 'LINK', 'GROUP', 'JOIN'
    ]);

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      const words = line.match(/[a-zA-Z0-9_\-]+/g) || [];
      for (let word of words) {
        const clean = word.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (clean.length >= 3 && clean.length <= 30 && !ignoredWords.has(clean)) {
          if (!seen.has(clean)) {
            seen.add(clean);
            codes.push(clean);
          }
        }
      }
    }
    return codes;
  }

  // Ordering strategies
  function orderCodes(codes, orderType) {
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
      return list.sort((a, b) => {
        const distA = Math.abs(codes.indexOf(a) - mid);
        const distB = Math.abs(codes.indexOf(b) - mid);
        return distA - distB;
      });
    }
    return list;
  }

  const container = document.createElement('div');
  container.id = 'dm-bot-container';
  container.innerHTML = `
    <style>
      #dm-bot-container {
        position: fixed;
        bottom: 18px;
        right: 18px;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      #dm-bot-card {
        width: 375px;
        background: #111827;
        color: #f3f4f6;
        border: 1px solid #374151;
        border-radius: 16px;
        box-shadow: 0 16px 40px rgba(0,0,0,0.6);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transition: transform 0.2s ease, opacity 0.2s ease;
      }
      #dm-bot-header {
        background: linear-gradient(135deg, #ea580c 0%, #f97316 100%);
        color: #ffffff;
        padding: 10px 14px;
        font-weight: 700;
        font-size: 13px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        cursor: pointer;
        user-select: none;
      }
      .dm-badge {
        background: rgba(255, 255, 255, 0.25);
        padding: 2px 7px;
        border-radius: 9999px;
        font-size: 10px;
        letter-spacing: 0.5px;
      }
      #dm-bot-body {
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        font-size: 12px;
      }
      .dm-row {
        display: flex;
        flex-direction: column;
        gap: 3px;
      }
      .dm-row label {
        color: #9ca3af;
        font-weight: 600;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .dm-input, .dm-textarea, .dm-select {
        background: #0b0f17;
        border: 1px solid #374151;
        border-radius: 8px;
        color: #f9fafb;
        padding: 7px 10px;
        font-size: 12px;
        outline: none;
        transition: border-color 0.15s ease;
        box-sizing: border-box;
        width: 100%;
      }
      .dm-input:focus, .dm-textarea:focus, .dm-select:focus {
        border-color: #f97316;
      }
      .dm-textarea {
        resize: vertical;
        min-height: 55px;
        font-family: monospace;
      }
      .dm-options-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 11px;
        color: #9ca3af;
        margin-top: 2px;
      }
      .dm-checkbox-label {
        display: flex;
        align-items: center;
        gap: 5px;
        cursor: pointer;
      }
      .dm-collapsible-btn {
        background: none;
        border: none;
        color: #f97316;
        cursor: pointer;
        font-size: 11px;
        font-weight: 600;
        padding: 0;
        text-align: left;
      }
      .dm-collapsible-content {
        display: none;
        background: #0b0f17;
        border: 1px dashed #374151;
        border-radius: 8px;
        padding: 8px 10px;
        gap: 6px;
        flex-direction: column;
      }
      .dm-btn-group {
        display: flex;
        gap: 8px;
        margin-top: 4px;
      }
      .dm-btn {
        flex: 1;
        padding: 9px 12px;
        border: none;
        border-radius: 8px;
        font-weight: 700;
        font-size: 12px;
        cursor: pointer;
        transition: opacity 0.15s, transform 0.05s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }
      .dm-btn:active {
        transform: scale(0.98);
      }
      .dm-btn-primary {
        background: #f97316;
        color: #fff;
      }
      .dm-btn-primary:hover {
        background: #ea580c;
      }
      .dm-btn-stop {
        background: #ef4444;
        color: #fff;
        display: none;
      }
      .dm-btn-stop:hover {
        background: #dc2626;
      }
      #dm-bot-log {
        background: #070a10;
        border: 1px solid #1f2937;
        border-radius: 8px;
        padding: 8px;
        max-height: 115px;
        overflow-y: auto;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 11px;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .log-entry {
        line-height: 1.35;
        word-break: break-all;
      }
      .log-info { color: #9ca3af; }
      .log-success { color: #22c55e; font-weight: bold; }
      .log-error { color: #ef4444; }
      .log-warning { color: #f59e0b; }
      .log-accent { color: #38bdf8; font-weight: 600; }
      #dm-bot-toggle-btn {
        display: none;
        background: #f97316;
        color: #fff;
        border: none;
        border-radius: 9999px;
        padding: 9px 15px;
        font-weight: 700;
        box-shadow: 0 4px 14px rgba(249, 115, 22, 0.4);
        cursor: pointer;
        font-size: 12px;
      }
    </style>

    <button id="dm-bot-toggle-btn">⚡ Auto-Redeemer Pro</button>

    <div id="dm-bot-card">
      <div id="dm-bot-header">
        <span>⚡ DataMart Auto-Redeemer Pro</span>
        <div style="display:flex; align-items:center; gap:6px;">
          <span class="dm-badge" id="dm-token-badge">Checking Auth...</span>
          <span id="dm-bot-min-btn" style="cursor:pointer; font-size:16px;">−</span>
        </div>
      </div>

      <div id="dm-bot-body">
        <div class="dm-row">
          <label>Target Phone Number</label>
          <input type="tel" id="dm-phone" class="dm-input" placeholder="e.g. 0244123456" />
        </div>

        <div class="dm-row">
          <label>
            <span>Promo Codes or Full Chat Message</span>
            <span id="dm-dead-count-badge" style="color:#f97316; font-size:10px; cursor:pointer;" title="Click to clear dead code memory">🗑️ 0 dead remembered</span>
          </label>
          <textarea id="dm-codes-input" class="dm-textarea" placeholder="Paste codes here (separated by spaces, newlines, or entire WhatsApp drop)..."></textarea>
          <div style="font-size: 10px; color: #9ca3af;" id="dm-parsed-count">0 codes detected</div>
        </div>

        <div style="display:flex; gap:8px;">
          <div class="dm-row" style="flex:1;">
            <label>Scan Order (Strategy)</label>
            <select id="dm-order" class="dm-select">
              <option value="reverse">⬆️ Bottom-Up / Reverse (Beats Crowd!)</option>
              <option value="shuffle">🔀 Random Shuffle (Unpredictable)</option>
              <option value="middle">🎯 Middle-Out (Skips Top Rush)</option>
              <option value="top">⬇️ Top-to-Bottom (Default)</option>
            </select>
          </div>
          <div class="dm-row" style="width: 110px;">
            <label>Base Delay</label>
            <select id="dm-delay" class="dm-select">
              <option value="adaptive">⚡ Smart Adaptive</option>
              <option value="200">200ms (Fast)</option>
              <option value="400">400ms (Normal)</option>
              <option value="1000">1.0s (Safe)</option>
            </select>
          </div>
        </div>

        <div class="dm-options-bar">
          <label class="dm-checkbox-label">
            <input type="checkbox" id="dm-filter-dead" checked />
            <span>Skip known dead/expired codes</span>
          </label>
          <button type="button" id="dm-toggle-advanced" class="dm-collapsible-btn">⚙️ Multi-Account ▼</button>
        </div>

        <div id="dm-advanced-panel" class="dm-collapsible-content">
          <div style="font-size: 10px; color: #94a3b8; line-height: 1.3;">
            <strong>Multi-Token Pool (Round-Robin):</strong><br/>
            Current browser session is automatically Token 1. Add extra DataMart auth tokens below to multiply your rate limit capacity by 2x or 3x!
          </div>
          <textarea id="dm-extra-tokens" class="dm-textarea" style="min-height:40px; font-size:10px;" placeholder="Paste extra authToken(s), one per line..."></textarea>
          <div id="dm-pool-summary" style="font-size: 10px; color: #38bdf8;">Token pool: 1 active account</div>
        </div>

        <div class="dm-btn-group">
          <button id="dm-start-btn" class="dm-btn dm-btn-primary">▶ Start Auto-Redeem</button>
          <button id="dm-stop-btn" class="dm-btn dm-btn-stop">■ Stop</button>
        </div>

        <div class="dm-row">
          <label>Status & Log</label>
          <div id="dm-bot-log">
            <div class="log-entry log-info">Ready. Paste codes and click Start.</div>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(container);

  const card = document.getElementById('dm-bot-card');
  const toggleBtn = document.getElementById('dm-bot-toggle-btn');
  const minBtn = document.getElementById('dm-bot-min-btn');
  const phoneInput = document.getElementById('dm-phone');
  const codesInput = document.getElementById('dm-codes-input');
  const parsedCount = document.getElementById('dm-parsed-count');
  const deadCountBadge = document.getElementById('dm-dead-count-badge');
  const orderSelect = document.getElementById('dm-order');
  const delaySelect = document.getElementById('dm-delay');
  const filterDeadCb = document.getElementById('dm-filter-dead');
  const toggleAdvancedBtn = document.getElementById('dm-toggle-advanced');
  const advancedPanel = document.getElementById('dm-advanced-panel');
  const extraTokensInput = document.getElementById('dm-extra-tokens');
  const poolSummary = document.getElementById('dm-pool-summary');
  const startBtn = document.getElementById('dm-start-btn');
  const stopBtn = document.getElementById('dm-stop-btn');
  const logBox = document.getElementById('dm-bot-log');
  const tokenBadge = document.getElementById('dm-token-badge');

  let isRunning = false;

  function log(msg, type = 'info') {
    const time = new Date().toLocaleTimeString().split(' ')[0];
    const el = document.createElement('div');
    el.className = `log-entry log-${type}`;
    el.innerHTML = `[${time}] ${msg}`;
    logBox.appendChild(el);
    logBox.scrollTop = logBox.scrollHeight;
  }

  function updateDeadBadge() {
    const count = getDeadCodes().size;
    deadCountBadge.textContent = `🗑️ ${count} dead remembered`;
  }
  updateDeadBadge();

  deadCountBadge.addEventListener('click', () => {
    if (confirm('Clear the dead codes memory cache?')) {
      clearDeadCodes();
      updateDeadBadge();
      updateParsedDisplay();
      log('Cleared dead codes memory cache.', 'info');
    }
  });

  phoneInput.value = localStorage.getItem(STORAGE_KEY_PHONE) || '';
  delaySelect.value = localStorage.getItem(STORAGE_KEY_DELAY) || 'adaptive';
  orderSelect.value = localStorage.getItem(STORAGE_KEY_ORDER) || 'reverse';
  filterDeadCb.checked = localStorage.getItem(STORAGE_KEY_FILTER_DEAD) !== 'false';
  extraTokensInput.value = localStorage.getItem(STORAGE_KEY_EXTRA_TOKENS) || '';

  phoneInput.addEventListener('change', () => localStorage.setItem(STORAGE_KEY_PHONE, phoneInput.value.trim()));
  delaySelect.addEventListener('change', () => localStorage.setItem(STORAGE_KEY_DELAY, delaySelect.value));
  orderSelect.addEventListener('change', () => localStorage.setItem(STORAGE_KEY_ORDER, orderSelect.value));
  filterDeadCb.addEventListener('change', () => {
    localStorage.setItem(STORAGE_KEY_FILTER_DEAD, filterDeadCb.checked);
    updateParsedDisplay();
  });
  extraTokensInput.addEventListener('change', () => {
    localStorage.setItem(STORAGE_KEY_EXTRA_TOKENS, extraTokensInput.value.trim());
    updateTokenPool();
  });

  toggleAdvancedBtn.addEventListener('click', () => {
    const isShown = advancedPanel.style.display === 'flex';
    advancedPanel.style.display = isShown ? 'none' : 'flex';
    toggleAdvancedBtn.textContent = isShown ? '⚙️ Multi-Account ▼' : '⚙️ Multi-Account ▲';
  });

  minBtn.addEventListener('click', () => {
    card.style.display = 'none';
    toggleBtn.style.display = 'block';
  });
  toggleBtn.addEventListener('click', () => {
    card.style.display = 'flex';
    toggleBtn.style.display = 'none';
  });

  function getPrimaryToken() {
    return localStorage.getItem('authToken');
  }

  function checkAuth() {
    const token = getPrimaryToken();
    if (token) {
      tokenBadge.textContent = 'Logged In';
      tokenBadge.style.background = 'rgba(34, 197, 94, 0.3)';
      tokenBadge.style.color = '#86efac';
      return token;
    } else {
      tokenBadge.textContent = 'Not Logged In';
      tokenBadge.style.background = 'rgba(239, 68, 68, 0.3)';
      tokenBadge.style.color = '#fca5a5';
      return null;
    }
  }
  setInterval(checkAuth, 3000);
  checkAuth();

  function getTokenPool() {
    const primary = getPrimaryToken();
    const extras = extraTokensInput.value
      .split('\n')
      .map(t => t.trim().replace(/['"]/g, ''))
      .filter(t => t.length > 20);

    const pool = [];
    if (primary) pool.push(primary);
    for (let t of extras) {
      if (!pool.includes(t)) pool.push(t);
    }
    return pool;
  }

  function updateTokenPool() {
    const pool = getTokenPool();
    poolSummary.textContent = `Token pool: ${pool.length} active account${pool.length === 1 ? '' : 's'} (${pool.length}x capacity)`;
  }
  extraTokensInput.addEventListener('input', updateTokenPool);
  updateTokenPool();

  function updateParsedDisplay() {
    const raw = extractCodes(codesInput.value);
    const deadSet = getDeadCodes();
    let deadFiltered = 0;
    const finalCodes = [];

    for (let c of raw) {
      if (filterDeadCb.checked && deadSet.has(c)) {
        deadFiltered++;
      } else {
        finalCodes.push(c);
      }
    }

    if (!raw.length) {
      parsedCount.textContent = '0 codes detected';
    } else {
      parsedCount.textContent = `${finalCodes.length} active code${finalCodes.length === 1 ? '' : 's'} to test` +
        (deadFiltered > 0 ? ` (${deadFiltered} known dead filtered out)` : '');
    }
  }
  codesInput.addEventListener('input', updateParsedDisplay);

  startBtn.addEventListener('click', async () => {
    if (isRunning) return;

    const phone = phoneInput.value.trim();
    if (!phone) {
      alert('Please enter your target phone number!');
      phoneInput.focus();
      return;
    }

    const rawCodes = extractCodes(codesInput.value);
    if (!rawCodes.length) {
      alert('Please paste at least one promo code!');
      codesInput.focus();
      return;
    }

    const tokenPool = getTokenPool();
    if (!tokenPool.length) {
      alert('You are not logged in! Please log in to DataMart first so the bot can use your account session.');
      return;
    }

    const deadSet = getDeadCodes();
    let codesToRun = [];
    let filteredCount = 0;

    for (let c of rawCodes) {
      if (filterDeadCb.checked && deadSet.has(c)) {
        filteredCount++;
      } else {
        codesToRun.push(c);
      }
    }

    if (!codesToRun.length) {
      alert('All pasted codes are already recorded in memory as dead/expired! If you still want to re-test them, uncheck "Skip known dead codes" or click the trash icon.');
      return;
    }

    const orderType = orderSelect.value;
    codesToRun = orderCodes(codesToRun, orderType);

    isRunning = true;
    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-flex';
    logBox.innerHTML = '';

    log(`🚀 Starting queue with <strong>${codesToRun.length}</strong> code(s) | Order: [<strong>${orderType.toUpperCase()}</strong>] | Accounts: <strong>${tokenPool.length}</strong>`, 'accent');
    if (filteredCount > 0) {
      log(`⚡ Filtered out ${filteredCount} known dead code(s) from memory.`, 'info');
    }

    let claimedSuccess = false;
    let requestIdx = 0;
    let burstCount = 0;

    let i = 0;
    while (i < codesToRun.length) {
      if (!isRunning) {
        log('Stopped by user.', 'warning');
        break;
      }

      const code = codesToRun[i];
      const token = tokenPool[requestIdx % tokenPool.length];
      const accountLabel = tokenPool.length > 1 ? ` [Acct ${(requestIdx % tokenPool.length) + 1}]` : '';

      log(`(${i + 1}/${codesToRun.length})${accountLabel} Testing: <strong>${code}</strong>...`, 'info');

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        let res;
        try {
          res = await fetch('https://api.datamartgh.shop/api/promo-codes/claim', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `Bearer ${token}`,
              'x-auth-token': token
            },
            body: JSON.stringify({ code: code, phone: phone }),
            signal: controller.signal
          });
        } finally {
          clearTimeout(timeoutId);
        }

        const data = await res.json().catch(() => ({ message: res.statusText }));
        const msg = String(data?.message || data?.error || res.statusText || `HTTP ${res.status}`);

        if (res.ok && data.success) {
          log(`🎉🎉 <strong>SUCCESS! HIT!</strong> Claimed ${data.data?.rewardValue || ''}GB for ${data.data?.deliveryPhone || phone}!`, 'success');
          playSuccessSound();
          claimedSuccess = true;
          alert(`🎉 SUCCESS! Promo code ${code} hit!\n${data.message || 'Free data claimed!'}`);
          break;
        } else if (res.status === 429) {
          const backoff = tokenPool.length > 1 ? 2500 : 4500;
          log(`⚠️ <strong>Rate Limit (429) hit!</strong> Code saved. Cooling down for ${(backoff/1000).toFixed(1)}s before retrying...`, 'warning');
          await sleep(backoff);

          requestIdx++;
          burstCount = 0;
          continue;
        } else if (res.status >= 500 || /temporarily unreachable|server error|database|gateway|backup|try again shortly/i.test(msg)) {
          log(`⚠️ <strong>Server Overloaded / Offline:</strong> ${msg}. Waiting 3.5s for server to recover before retrying ${code}...`, 'warning');
          await sleep(3500);
          requestIdx++;
          continue;
        } else {
          log(`❌ Failed: ${msg}`, 'error');

          if (/already (been )?claimed|expired|invalid|not found/i.test(msg)) {
            addDeadCode(code);
            updateDeadBadge();
          }

          i++;
          requestIdx++;
          burstCount++;
        }
      } catch (err) {
        const isTimeout = err.name === 'AbortError';
        const errMsg = isTimeout ? 'Request timed out (Server lagged)' : err.message;
        log(`⚠️ ${errMsg} on ${code}. Waiting 3s before retrying...`, 'warning');
        await sleep(3000);
        continue;
      }

      if (i < codesToRun.length && isRunning) {
        const modeDelay = delaySelect.value;
        let sleepTime = 250;

        if (modeDelay === 'adaptive') {
          if (burstCount < 7 * tokenPool.length) {
            sleepTime = 180;
          } else {
            sleepTime = Math.max(300, Math.floor(3500 / tokenPool.length));
          }
        } else {
          sleepTime = parseInt(modeDelay, 10) || 300;
        }

        await sleep(sleepTime);
      }
    }

    if (!claimedSuccess && isRunning) {
      log('🏁 Finished checking all codes. None succeeded.', 'warning');
    }

    isRunning = false;
    startBtn.style.display = 'inline-flex';
    stopBtn.style.display = 'none';
  });

  stopBtn.addEventListener('click', () => {
    isRunning = false;
    log('Stopping bot...', 'warning');
  });

})();
