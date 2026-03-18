const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

async function checkLineMessages() {
    console.log(`--- LINE メッセージ取得テスト ---`);

    const userDataDir = path.join(__dirname, 'line_ext_profile');
    const executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

    // ロックファイル削除
    const lockFile = path.join(userDataDir, 'SingletonLock');
    if (fs.existsSync(lockFile)) {
        try { fs.unlinkSync(lockFile); } catch (e) {}
    }

    console.log('ブラウザに接続しています...');
    const browserContext = await chromium.launchPersistentContext(userDataDir, {
        channel: 'chrome',
        headless: false,
        ignoreDefaultArgs: ["--enable-automation", "--disable-extensions"]
    });

    try {
        const extensionId = 'ophjlpahpchlmihnnnihgmmeilfjmjjc';
        const page = browserContext.pages()[0] || await browserContext.newPage();
        
        console.log('LINE拡張機能を開いています...');
        await page.goto(`chrome-extension://${extensionId}/index.html`);

        console.log('\n=========================================');
        console.log('⏳ ログインのための待機時間です（60秒間）');
        console.log('この間にQRコードリーダー等でログインし、');
        console.log('「コンカフェメモ」のトーク画面を開いてください！');
        console.log('=========================================\n');
        
        // 60秒待機
        await new Promise(r => setTimeout(r, 60000));

        // スクリーンショット保存
        const screenshotPath = path.join(__dirname, 'current_line_view.png');
        await page.screenshot({ path: screenshotPath });
        console.log(`現在の画面を保存しました: ${screenshotPath}`);

        // 画面内のテキストをすべて抽出してコンソールに出す
        console.log('\n--- 画面内のテキスト内容 ---');
        const textContent = await page.evaluate(() => document.body.innerText);
        console.log(textContent);
        
        console.log('----------------------------\n');

    } catch (e) {
        console.error('エラー:', e);
    } finally {
        await browserContext.close();
    }
}

checkLineMessages();
