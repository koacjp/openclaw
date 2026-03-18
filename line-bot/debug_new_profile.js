const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

async function debugNewProfile() {
    console.log(`--- LINE 新規プロファイル デバッグ ---`);

    // テスト用の別プロファイル
    const userDataDir = path.join(__dirname, 'line_temp_profile');
    if (fs.existsSync(userDataDir)) {
        // 既存のテンポラリプロファイルを削除して常にクリーンにする
        fs.rmSync(userDataDir, { recursive: true, force: true });
    }

    const extensionPath = path.join(__dirname, 'line_ext');

    const browserContext = await chromium.launchPersistentContext(userDataDir, {
        channel: 'chrome',
        headless: false,
        args: [
            `--disable-extensions-except=${extensionPath}`,
            `--load-extension=${extensionPath}`,
        ],
        ignoreDefaultArgs: ["--enable-automation", "--disable-extensions"]
    });

    try {
        const extensionId = 'ophjlpahpchlmihnnnihgmmeilfjmjjc';
        const page = browserContext.pages()[0] || await browserContext.newPage();
        
        await page.goto(`chrome-extension://${extensionId}/index.html`);
        await new Promise(r => setTimeout(r, 10000)); 

        // 初期の「ログイン」ボタンがあれば押す
        const loginBtn = await page.getByText('ログイン', { exact: true }).first();
        if (await loginBtn.isVisible()) {
            console.log('「ログイン」ボタンをクリック...');
            await loginBtn.click();
            await new Promise(r => setTimeout(r, 5000));
        }

        const html = await page.content();
        fs.writeFileSync(path.join(__dirname, 'login_debug.html'), html);
        await page.screenshot({ path: path.join(__dirname, 'login_debug.png') });

        const inputs = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('input, button')).map(el => {
                return {
                    tag: el.tagName,
                    type: el.type,
                    placeholder: el.placeholder,
                    text: el.innerText,
                    outerHTML: el.outerHTML
                };
            });
        });
        console.log(JSON.stringify(inputs, null, 2));

    } catch (e) {
        console.error('エラー:', e);
    } finally {
        await browserContext.close();
    }
}

debugNewProfile();
