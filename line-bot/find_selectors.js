const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

async function findLoginSelectors() {
    console.log(`--- LINE ログインセレクタ探索 ---`);

    const userDataDir = path.join(__dirname, 'line_ext_profile');
    const lockFile = path.join(userDataDir, 'SingletonLock');
    if (fs.existsSync(lockFile)) {
        try { fs.unlinkSync(lockFile); } catch (e) {}
    }

    const browserContext = await chromium.launchPersistentContext(userDataDir, {
        channel: 'chrome',
        headless: false,
        ignoreDefaultArgs: ["--enable-automation", "--disable-extensions"]
    });

    try {
        const extensionId = 'ophjlpahpchlmihnnnihgmmeilfjmjjc';
        const page = browserContext.pages()[0] || await browserContext.newPage();
        
        await page.goto(`chrome-extension://${extensionId}/index.html`);
        await new Promise(r => setTimeout(r, 5000)); 

        console.log('ストレージをクリアしてログイン画面を強制します...');
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });
        await browserContext.clearCookies();
        
        await page.reload();
        await new Promise(r => setTimeout(r, 8000));

        // 「ログイン」ボタンがあればクリック
        const loginBtn = await page.getByText('ログイン', { exact: true }).first();
        if (await loginBtn.isVisible()) {
            console.log('「ログイン」ボタンをクリック...');
            await loginBtn.click();
            await new Promise(r => setTimeout(r, 5000));
        }

        console.log('--- 全てのフレームの入力要素を出力します ---');
        const allInputs = [];
        for (const frame of page.frames()) {
            console.log(`Frame: ${frame.url()}`);
            const inputs = await frame.evaluate(() => {
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
            allInputs.push({ url: frame.url(), inputs });
        }
        console.log(JSON.stringify(allInputs, null, 2));

    } catch (e) {
        console.error('エラー:', e);
    } finally {
        await browserContext.close();
    }
}

findLoginSelectors();
