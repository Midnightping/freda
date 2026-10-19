#!/usr/bin/env python3
"""
DataMart Free Data Auto-Redeemer Pro (Python CLI Edition v2.0)
Author: Antigravity
Site: beta.datamartgh.shop / api.datamartgh.shop
"""

import sys
import os
import json
import time
import re
import random
import urllib.request
import urllib.error

API_BASE = "https://api.datamartgh.shop"
BASE_DIR = os.path.dirname(__file__)
CONFIG_FILE = os.path.join(BASE_DIR, "config.json")
DEAD_CODES_FILE = os.path.join(BASE_DIR, "dead_codes.json")

# ANSI Colors
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
MAGENTA = "\033[95m"
BOLD = "\033[1m"
RESET = "\033[0m"

IGNORED_WORDS = {
    'THE', 'AND', 'FOR', 'FREE', 'DATA', 'DROP', 'CODES', 'CODE', 'FAST', 'GUYS', 
    'TRY', 'NOW', 'NEW', 'TODAY', 'ONLY', 'CLAIM', 'TELECEL', 'AIRTELTIGO',
    'GHANA', 'DATAMART', 'HTTP', 'HTTPS', 'WWW', 'SHOP', 'BETA', 'PLEASE', 'GIVEAWAY',
    'MTN', 'STATUS', 'REDEEM', 'ENJOY', 'QUICK', 'CHECK', 'LINK', 'GROUP', 'JOIN'
}

def beep():
    try:
        if os.name == 'nt':
            import winsound
            winsound.Beep(1000, 200)
            winsound.Beep(1300, 200)
            winsound.Beep(1600, 400)
        else:
            sys.stdout.write("\a")
            sys.stdout.flush()
    except Exception:
        pass

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {"phone": "", "authTokens": [], "order": "reverse", "filterDead": True}

def save_config(cfg):
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
    except Exception as e:
        print(f"{YELLOW}Warning: Could not save config: {e}{RESET}")

def load_dead_codes():
    if os.path.exists(DEAD_CODES_FILE):
        try:
            with open(DEAD_CODES_FILE, "r", encoding="utf-8") as f:
                return set(json.load(f))
        except Exception:
            pass
    return set()

def save_dead_codes(dead_set):
    try:
        arr = list(dead_set)[-3000:]
        with open(DEAD_CODES_FILE, "w", encoding="utf-8") as f:
            json.dump(arr, f, indent=2)
    except Exception:
        pass

def extract_codes_from_text(text):
    if not text:
        return []
    words = re.findall(r'[a-zA-Z0-9_\-]+', text)
    codes = []
    seen = set()
    for w in words:
        clean = re.sub(r'[^A-Z0-9]', '', w.upper())
        if 3 <= len(clean) <= 30 and clean not in IGNORED_WORDS and clean not in seen:
            seen.add(clean)
            codes.append(clean)
    return codes

def order_codes(codes, order_type):
    lst = list(codes)
    if order_type == 'reverse':
        return lst[::-1]
    elif order_type == 'shuffle':
        random.shuffle(lst)
        return lst
    elif order_type == 'middle':
        mid = len(lst) // 2
        return sorted(lst, key=lambda c: abs(codes.index(c) - mid))
    return lst

def check_claim_status():
    url = f"{API_BASE}/api/promo-codes/claim-status"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            return data.get("data", {})
    except Exception as e:
        return {"error": str(e)}

def claim_code(code, phone, token):
    url = f"{API_BASE}/api/promo-codes/claim"
    payload = json.dumps({"code": code, "phone": phone}).encode('utf-8')
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Authorization": f"Bearer {token}",
        "x-auth-token": token,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    }
    req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = resp.read().decode('utf-8')
            return resp.status, json.loads(body)
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"message": body or e.reason}
    except Exception as e:
        return 0, {"message": str(e)}

def main():
    print(f"\n{BOLD}{CYAN}======================================================={RESET}")
    print(f"{BOLD}{CYAN}      DataMart Free Data Auto-Redeemer Pro v2.0        {RESET}")
    print(f"{BOLD}{CYAN}======================================================={RESET}\n")

    cfg = load_config()
    dead_codes = load_dead_codes()

    # Check status
    status = check_claim_status()
    if status.get("enabled"):
        print(f"{GREEN}✓ Giveaway is currently ACTIVE on DataMart!{RESET}")
    else:
        print(f"{YELLOW}ℹ Giveaway status: {status}. Ready to run.{RESET}")

    # Phone configuration
    phone = cfg.get("phone", "")
    if not phone:
        phone = input(f"{BOLD}Enter target phone number (e.g. 0244123456): {RESET}").strip()
        cfg["phone"] = phone
        save_config(cfg)
    else:
        print(f"Target phone: {BOLD}{phone}{RESET}")

    # Tokens configuration
    tokens = cfg.get("authTokens", [])
    if isinstance(tokens, str):
        tokens = [tokens] if tokens else []
    if "authToken" in cfg and cfg["authToken"] and cfg["authToken"] not in tokens:
        tokens.append(cfg["authToken"])

    if not tokens:
        print(f"\n{YELLOW}No authToken found. Paste your DataMart session token below:{RESET}")
        print("  (In Chrome on beta.datamartgh.shop -> F12 Console -> localStorage.getItem('authToken'))")
        t = input(f"{BOLD}Paste authToken: {RESET}").strip().strip('"').strip("'")
        if t:
            tokens.append(t)
            cfg["authTokens"] = tokens
            save_config(cfg)

    print(f"{GREEN}✓ Active accounts/tokens in pool: {len(tokens)}{RESET}")

    # Ask for Scan Strategy
    order_type = cfg.get("order", "reverse")
    print(f"\nScan Strategy: [1] Reverse / Bottom-Up (Recommended), [2] Random Shuffle, [3] Middle-Out, [4] Top-to-Bottom")
    choice = input(f"Select strategy [current: {order_type}]: ").strip()
    if choice == "1":
        order_type = "reverse"
    elif choice == "2":
        order_type = "shuffle"
    elif choice == "3":
        order_type = "middle"
    elif choice == "4":
        order_type = "top"
    cfg["order"] = order_type
    save_config(cfg)

    # Input promo codes
    print(f"\n{BOLD}Paste codes or full chat drop (press Enter then Ctrl+Z / Ctrl+D to submit):{RESET}")
    raw_lines = sys.stdin.read()
    raw_codes = extract_codes_from_text(raw_lines)

    if not raw_codes:
        print(f"{RED}No valid codes found! Exiting.{RESET}")
        return

    # Filter dead codes
    codes_to_run = []
    filtered = 0
    for c in raw_codes:
        if c in dead_codes:
            filtered += 1
        else:
            codes_to_run.append(c)

    print(f"\n{CYAN}--- Queue Analysis ---{RESET}")
    print(f"Total codes extracted: {len(raw_codes)}")
    if filtered > 0:
        print(f"{YELLOW}Filtered out {filtered} known dead/expired codes from memory.{RESET}")
    print(f"{GREEN}Ready to test {len(codes_to_run)} code(s) in [{order_type.upper()}] order.{RESET}")

    if not codes_to_run:
        print(f"{YELLOW}All pasted codes are already recorded in memory as dead. Nothing new to test.{RESET}")
        return

    # Apply ordering
    ordered_codes = order_codes(codes_to_run, order_type)
    input(f"\nPress Enter to begin auto-redemption...")

    print(f"\n{CYAN}--- Starting Anti-429 Zero-Loss Runner ---{RESET}\n")

    claimed = False
    i = 0
    request_idx = 0
    burst_count = 0

    while i < len(ordered_codes):
        code = ordered_codes[i]
        token = tokens[request_idx % len(tokens)]
        acct_label = f" [Acct {(request_idx % len(tokens)) + 1}]" if len(tokens) > 1 else ""

        print(f"[{i + 1}/{len(ordered_codes)}]{acct_label} Testing: {BOLD}{code}{RESET}...", end=" ", flush=True)
        status_code, resp = claim_code(code, phone, token)

        if status_code == 200 and resp.get("success"):
            print(f"\n{BOLD}{GREEN}🎉🎉 SUCCESS! Promo code HIT! 🎉🎉{RESET}")
            msg = resp.get("message", "Claimed successfully!")
            reward = resp.get("data", {}).get("rewardValue", "")
            deliv = resp.get("data", {}).get("deliveryPhone", phone)
            print(f"{GREEN}Message: {msg}{RESET}")
            if reward:
                print(f"{GREEN}Reward: {reward}GB sent to {deliv}{RESET}")
            beep()
            claimed = True
            break
        elif status_code == 429:
            backoff = 2.5 if len(tokens) > 1 else 4.5
            print(f"\n{YELLOW}⚠️  Rate limit (429) hit! Cooling down {backoff}s before retrying {code}...{RESET}")
            time.sleep(backoff)
            request_idx += 1
            burst_count = 0
            # Do NOT increment i! Retry same code
            continue
        elif status_code == 401:
            print(f"\n{RED}Auth token expired or invalid (401). Skipping token.{RESET}")
            if len(tokens) > 1:
                request_idx += 1
                continue
            else:
                break
        elif status_code >= 500 or re.search(r"unreachable|server error|database|gateway|backup|try again", str(resp.get("message", "")), re.IGNORECASE):
            print(f"\n{YELLOW}⚠️  Server Overloaded / Offline: {resp.get('message')}. Waiting 3.5s before retrying {code}...{RESET}")
            time.sleep(3.5)
            request_idx += 1
            continue
        else:
            err = resp.get("message", "Invalid or already claimed")
            print(f"{RED}FAILED ({err}){RESET}")
            if re.search(r"already|expired|invalid|not found", str(err), re.IGNORECASE):
                dead_codes.add(code)
                save_dead_codes(dead_codes)
            i += 1
            request_idx += 1
            burst_count += 1

        # Adaptive pacing
        if i < len(ordered_codes):
            if burst_count < 7 * len(tokens):
                time.sleep(0.18)
            else:
                time.sleep(max(0.3, 3.5 / len(tokens)))

    if not claimed:
        print(f"\n{YELLOW}Queue finished. None of the codes were successful.{RESET}\n")
    else:
        print(f"\n{BOLD}{GREEN}Done! You claimed free data.{RESET}\n")

if __name__ == "__main__":
    main()
