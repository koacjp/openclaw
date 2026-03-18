const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

(async () => {
    console.log('--- LINE プロトコル解析：トークン抽出モード ---');

    const userDataDir = path.join(__dirname, 'line_profile');
    const extensionBase = path.join(process.env.LOCALAPPDATA, 'Google/Chrome/User Data/Profile 2/Extensions/ophjlpahpchlmihnnnihgmmeilfjmjjc');
    const dirs = fs.readdirSync(extensionBase);
    const versionDir = path.join(extensionBase, dirs[dirs.length - 1]);

    const browserContext = await chromium.launchPersistentContext(path.join(__dirname, 'temp_profile'), {
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: false,
        args: [
            `--disable-extensions-except=${versionDir}`,
            `--load-extension=${versionDir}`,
            '--no-sandbox'
        ]
    });

    const page = await browserContext.newPage();
    await page.goto('chrome-extension://ophjlpahpchlmihnnnihgmmeilfjmjjc/index.html');

    console.log('ログイン状態を確認中...');

    // ログインが完了するまで待機（トークンがlocalStorageに現れるのを待つ）
    const token = await page.evaluate(async () => {
        return new Promise((resolve) => {
            const check = () => {
                // LINE拡張機能がトークンを保存する可能性のある場所を全探索
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key.includes('token') || key.includes('AUTH')) {
                        return resolve({ key, value: localStorage.getItem(key) });
                    }
                }
                // IndexedDBもチェック
                setTimeout(check, 1000);
            };
            check();
        });
    });

    if (token) {
        console.log('\n[トークン抽出成功]');
        console.log(`Key: ${token.key}`);
        console.log(`Value: ${token.value}`);
        fs.writeFileSync('line_token.txt', JSON.stringify(token, null, 2));
    }

    await browserContext.close();
})();
