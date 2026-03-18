/**
 * test_extension.js
 * LINEのChrome拡張機能を手動インストールし、
 * プロファイルに保存して次回以降も使えるようにする証明用スクリプト
 */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

async function testLineExtension() {
    console.log('--- LINE Chrome拡張機能 プロファイル永続化テスト ---');

    // プロファイルを保存するディレクトリ
    const userDataDir = path.join(__dirname, 'line_ext_profile');
    if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir);
    }

    // Chromeの実行パス（Windows標準）
    const executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

    // 以前のクラッシュで残ったロックファイルを削除（これが原因ですぐ閉じる現象を防ぐ）
    const lockFile = path.join(userDataDir, 'SingletonLock');
    if (fs.existsSync(lockFile)) {
        try { fs.unlinkSync(lockFile); } catch (e) {}
    }

    console.log('ブラウザを起動します...');
    
    // Playwrightで拡張機能のインストールを許可するには headless: false にします。
    // 今回は `--load-extension` などのローカル読み込み引数は使いません。
    // （Chromeウェブストアから正規インストールされたものを永続化するため）
    let browserContext;
    try {
        browserContext = await chromium.launchPersistentContext(userDataDir, {
            channel: 'chrome',
            headless: false,
            ignoreDefaultArgs: ["--enable-automation", "--disable-extensions"],
            args: ["--start-maximized"]
        });
    } catch (e) {
        console.error('Playwright起動エラー:', e.message);
        return;
    }

    console.log('✅ 起動成功。ここでLINE拡張機能がインストールされているか確認します。');
    
    // ユーザー提供の公式ウェブストアID
    const extensionId = 'ophjlpahpchlmihnnnihgmmeilfjmjjc';

    // いきなりLINE拡張機能の画面（index.html）を開いてみる
    const page = await browserContext.newPage();
    try {
        const response = await page.goto(`chrome-extension://${extensionId}/index.html`, { timeout: 5000 });
        if (response || page.url().includes('chrome-extension://')) {
            console.log('\n🌟 成功！LINE拡張機能は既にインストールされており、プロファイルから正常にロードされました！');
            console.log('✅ このままLINEのログイン操作などがプログラム上で操作可能です。');
            
            // 少し待機して閉じる
            await new Promise(resolve => setTimeout(resolve, 10000));
            console.log('ブラウザを閉じます...');
            await browserContext.close();
            return;
        }
    } catch (e) {}

    // 読み込めなかった場合 = まだインストールされていない
    console.log('\n⚠️ LINE拡張機能がまだインストールされていない、またはプロファイルにありません。');
    console.log('👉 先に `open_chrome_for_install.bat` をダブルクリックして、通常のChromeからインストールを行ってください！');
    
    console.log('ブラウザを閉じます...');
    await browserContext.close();
}

testLineExtension();
