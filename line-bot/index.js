const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

(async () => {
    console.log('--- LINE 超精密・通知キャッチモード起動 ---');

    const userDataDir = path.join(__dirname, 'line_profile');
    if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir);

    const extensionBase = path.join(process.env.LOCALAPPDATA, 'Google/Chrome/User Data/Profile 2/Extensions/ophjlpahpchlmihnnnihgmmeilfjmjjc');
    let versionDir;
    try {
        const dirs = fs.readdirSync(extensionBase);
        versionDir = path.join(extensionBase, dirs[dirs.length - 1]);
    } catch (e) {
        console.log('エラー: LINE拡張機能が見つかりません。');
        process.exit(1);
    }

    const browser = await puppeteer.launch({
        headless: false,
        userDataDir: userDataDir,
        args: [
            `--disable-extensions-except=${versionDir}`,
            `--load-extension=${versionDir}`,
            '--no-sandbox',
            '--window-size=1000,900'
        ]
    });

    const page = await browser.newPage();
    
    // 通知を直接インターセプトする
    await page.exposeFunction('onLineNotification', (data) => {
        console.log('\n====================================');
        console.log(`🚀 【新着メッセージ検知！】`);
        console.log(`👤 送信者: ${data.title}`);
        console.log(`💬 内容  : ${data.body}`);
        console.log('====================================\n');
    });

    // ページ読み込みのたびに通知機能をフックする
    await page.evaluateOnNewDocument(() => {
        const NativeNotification = window.Notification;
        window.Notification = function(title, options) {
            window.onLineNotification({ title, body: options.body });
            return new NativeNotification(title, options);
        };
        Object.assign(window.Notification, NativeNotification);
        
        // Console.logもフックしてデバッグ情報を拾う
        const nativeLog = console.log;
        console.log = function(...args) {
            if (args[0] && typeof args[0] === 'string' && (args[0].includes('message') || args[0].includes('receive'))) {
                window.onLineNotification({ title: 'System', body: args.join(' ') });
            }
            nativeLog.apply(console, args);
        };
    });

    console.log('LINE拡張機能を開いています...');
    await page.goto('chrome-extension://ophjlpahpchlmihnnnihgmmeilfjmjjc/index.html', { waitUntil: 'networkidle2' }).catch(() => {
        console.log('手動でLINEを開いてください。');
    });

    console.log('--- 監視中 ---');
    console.log('メッセージを受信し、右下に通知が出た瞬間にここに表示されます。');

    // 予備のDOM監視（通知が鳴らない場合用）
    setInterval(async () => {
        try {
            const hasUnread = await page.evaluate(() => {
                const unread = document.querySelector('.unread, .count, [class*="unread"]');
                return unread ? unread.innerText : null;
            });
            if (hasUnread) {
                // console.log(`（未読バッジあり: ${hasUnread}）`);
            }
        } catch (e) {}
    }, 5000);

})();
