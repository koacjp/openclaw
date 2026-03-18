const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

async function debugDom() {
    console.log(`--- LINE Extension DOM Debugger ---`);

    const userDataDir = path.join(__dirname, 'line_ext_profile');
    if (!fs.existsSync(userDataDir)) {
        console.error('[ERROR] line_ext_profile not found.');
        return;
    }

    const executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

    const lockFile = path.join(userDataDir, 'SingletonLock');
    if (fs.existsSync(lockFile)) {
        try { fs.unlinkSync(lockFile); } catch (e) {}
    }

    console.log('Launching browser...');
    const browserContext = await chromium.launchPersistentContext(userDataDir, {
        channel: 'chrome',
        headless: false,
        ignoreDefaultArgs: ["--enable-automation", "--disable-extensions"]
    });

    await new Promise(r => setTimeout(r, 3000));

    let extensionId = 'ophjlpahpchlmihnnnihgmmeilfjmjjc';

    const page = browserContext.pages()[0] || await browserContext.newPage();
    console.log('Navigating to extension...');
    await page.goto(`chrome-extension://${extensionId}/index.html`);

    console.log('Waiting for content to load (20 seconds)...');
    console.log('👉👉👉 PLEASE SEND A MESSAGE FROM YOUR PHONE NOW TO TRIGGER THE UI 👈👈👈');
    await new Promise(r => setTimeout(r, 20000));

    // Screenshot
    const screenshotPath = path.join(__dirname, 'debug_screenshot.png');
    await page.screenshot({ path: screenshotPath });
    console.log(`Screenshot saved to ${screenshotPath}`);

    // Dump DOM
    const html = await page.evaluate(() => document.body.outerHTML);
    const dumpPath = path.join(__dirname, 'debug_dom.html');
    fs.writeFileSync(dumpPath, html, 'utf8');
    console.log(`DOM dumped to ${dumpPath}`);

    console.log('Closing browser...');
    await browserContext.close();
}

debugDom().catch(console.error);
