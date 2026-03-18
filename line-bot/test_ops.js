const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

async function testOperations() {
    const userDataDir = path.join(__dirname, 'line_ext_profile');
    const extensionId = 'ophjlpahpchlmihnnnihgmmeilfjmjjc';

    console.log('--- 操作テスト開始 ---');
    // クラッシュ防止のロックファイル削除
    const lockFile = path.join(userDataDir, 'SingletonLock');
    if (fs.existsSync(lockFile)) {
        try { fs.unlinkSync(lockFile); } catch (e) {}
    }

    let browserContext;
    try {
        browserContext = await chromium.launchPersistentContext(userDataDir, {
            channel: 'chrome',
            headless: false,
            ignoreDefaultArgs: ["--enable-automation", "--disable-extensions"],
            args: ["--disable-blink-features=AutomationControlled", "--window-size=800,1000"]
        });
    } catch (launchError) {
        console.error('❌ ブラウザの起動に失敗しました。Chromeが別のウィンドウで開いていませんか？');
        console.error('Error:', launchError.message);
        return;
    }

    const page = browserContext.pages()[0] || await browserContext.newPage();
    
    try {
        await page.goto(`chrome-extension://${extensionId}/index.html`);
        await new Promise(r => setTimeout(r, 5000));

        console.log('1. 連絡先リスト (Friends) への遷移テスト');
        const friendsIcon = page.locator('a[href*="#/friends"], .sidebar__item:has(.icon-user)');
        if (await friendsIcon.isVisible()) {
            await friendsIcon.click();
            console.log('✅ 連絡先リストアイコンをクリックしました。');
            await new Promise(r => setTimeout(r, 2000));
            // スクロールテスト
            await page.mouse.wheel(0, 500);
            console.log('✅ 連絡先リストをスクロールしました。');
        } else {
            console.log('⚠️ 連絡先アイコンが見つかりません。URLで直接遷移します。');
            await page.goto(`chrome-extension://${extensionId}/index.html#/friends`);
        }

        await new Promise(r => setTimeout(r, 2000));

        console.log('2. チャットリスト (Chats) への遷移テスト');
        const chatsIcon = page.locator('a[href*="#/chats"], .sidebar__item:has(.icon-chat)');
        if (await chatsIcon.isVisible()) {
            await chatsIcon.click();
            console.log('✅ チャットリストアイコンをクリックしました。');
            await new Promise(r => setTimeout(r, 2000));
            // スクロールテスト
            await page.mouse.wheel(0, 500);
            console.log('✅ チャットリストをスクロールしました。');
        } else {
            console.log('⚠️ チャットアイコンが見つかりません。URLで直接遷移します。');
            await page.goto(`chrome-extension://${extensionId}/index.html#/chats`);
        }

        console.log('--- 操作テスト完了 ---');
        console.log('3秒後にブラウザを閉じます。内容を確認してください。');
        await new Promise(r => setTimeout(r, 3000));

    } catch (e) {
        console.error('テスト中にエラーが発生しました:', e);
    } finally {
        await browserContext.close();
    }
}

testOperations();
