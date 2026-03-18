const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

async function findExtensionId() {
    console.log(`--- LINE Extension ID 取得 ---`);

    const userDataDir = path.join(__dirname, 'line_temp_profile');
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
        // 全てのページ/ターゲットをチェックして拡張機能のベースURLからIDを特定
        const pages = browserContext.pages();
        console.log(`ページ数: ${pages.length}`);
        
        // service workerなどのバックグラウンドページからIDを探す
        const backgroundPages = browserContext.serviceWorkers();
        console.log(`Service Workers: ${backgroundPages.length}`);
        for (const sw of backgroundPages) {
            console.log(`SW URL: ${sw.url()}`);
            const match = sw.url().match(/chrome-extension:\/\/([a-z]+)\//);
            if (match) {
                console.log(`発見したExtension ID: ${match[1]}`);
            }
        }

        // ページからも探す
        for (const p of pages) {
            console.log(`Page URL: ${p.url()}`);
        }

    } catch (e) {
        console.error('エラー:', e);
    } finally {
        await browserContext.close();
    }
}

findExtensionId();
