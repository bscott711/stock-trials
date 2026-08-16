// Register a DuckDNS subdomain and point it at a fixed IP.
//
// DuckDNS has no password login - it is OAuth only (Google/GitHub/Reddit/X) -
// and its HTTP API can only update an EXISTING domain's IP, never create one.
// So this drives a real browser. The profile is persistent, so the login only
// has to happen once.
//
//   node tools/duckdns_setup.mjs --inspect
//   node tools/duckdns_setup.mjs --add stocktrials --ip 170.9.244.50
//
// The script never handles credentials: if you are not signed in, it waits for
// you to do it in the window it opened.

import { chromium } from 'playwright';
import path from 'node:path';
import os from 'node:os';

const args = process.argv.slice(2);
const flag = (name, def = null) => {
    const i = args.indexOf(`--${name}`);
    return i === -1 ? def : (args[i + 1]?.startsWith('--') ? true : args[i + 1] ?? true);
};

const INSPECT = args.includes('--inspect');
const SUB = flag('add');
const IP = flag('ip');
const PROFILE = flag('profile', path.join(os.homedir(), '.cache', 'duckdns-playwright-profile'));
const LOGIN_TIMEOUT_MS = 8 * 60 * 1000;

const ctx = await chromium.launchPersistentContext(PROFILE, {
    headless: false,
    viewport: { width: 1400, height: 950 },
    args: ['--disable-blink-features=AutomationControlled'],
});
const page = ctx.pages()[0] ?? await ctx.newPage();

await page.goto('https://www.duckdns.org', { waitUntil: 'domcontentloaded' });

// The signed-in page exposes the account token and a domain table; the signed
// out page does not. Poll for that rather than for any particular OAuth flow.
const signedIn = async () =>
    await page.locator('text=/token/i').first().isVisible().catch(() => false);

if (!(await signedIn())) {
    console.log('\n>>> Not signed in. Complete the OAuth login in the browser window.');
    console.log('>>> Waiting up to 8 minutes...\n');
    const deadline = Date.now() + LOGIN_TIMEOUT_MS;
    while (Date.now() < deadline) {
        if (await signedIn()) break;
        await page.waitForTimeout(2000);
    }
    if (!(await signedIn())) {
        console.error('Timed out waiting for login.');
        await ctx.close();
        process.exit(1);
    }
}
console.log('Signed in.\n');
await page.waitForTimeout(1500);

const dump = async () => {
    const shot = '/private/tmp/claude-501/-Users-minesbioimaging-dev-stock-trials/6d5c766c-65f4-4e82-8852-8f88ff974bdc/scratchpad/duckdns.png';
    await page.screenshot({ path: shot, fullPage: true });

    const struct = await page.evaluate(() => {
        const vis = el => el.offsetParent !== null || el.getClientRects().length > 0;
        return {
            inputs: [...document.querySelectorAll('input,select,textarea')].filter(vis).map(e => ({
                tag: e.tagName, type: e.type, id: e.id, name: e.name,
                placeholder: e.placeholder, value: (e.value || '').slice(0, 60),
                cls: e.className,
            })),
            clickables: [...document.querySelectorAll('button,a,input[type=button],input[type=submit],[onclick]')]
                .filter(vis)
                .map(e => ({ tag: e.tagName, id: e.id, cls: e.className, text: (e.innerText || e.value || '').trim().slice(0, 60) }))
                .filter(e => e.text),
            domainRows: [...document.querySelectorAll('tr')].filter(vis)
                .map(tr => (tr.innerText || '').replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 60),
        };
    });
    console.log(JSON.stringify(struct, null, 2));
    console.log(`\nscreenshot: ${shot}`);
};

if (INSPECT || !SUB) {
    await dump();
    console.log('\nInspect mode - leaving browser open 60s.');
    await page.waitForTimeout(60000);
    await ctx.close();
    process.exit(0);
}

// --- add the domain -------------------------------------------------------
console.log(`Adding "${SUB}" ...`);
const addBox = page.locator('input#domainbox, input[name=domainbox], input[placeholder*="domain" i]').first();
await addBox.waitFor({ timeout: 15000 });
await addBox.fill(String(SUB));
await page.locator('text=/add domain/i').first().click();
await page.waitForTimeout(4000);

if (IP) {
    console.log(`Setting IP to ${IP} ...`);
    const row = page.locator('tr', { hasText: String(SUB) }).first();
    const ipBox = row.locator('input[type=text]').first();
    if (await ipBox.count()) {
        await ipBox.fill(String(IP));
        const upd = row.locator('text=/update ip/i').first();
        if (await upd.count()) await upd.click();
        await page.waitForTimeout(3000);
    } else {
        console.log('(no per-row IP field found - dumping structure)');
    }
}

await dump();
console.log('\nDone. Verify with: dig +short ' + SUB + '.duckdns.org @1.1.1.1');
await page.waitForTimeout(20000);
await ctx.close();
