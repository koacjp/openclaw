/**
 * launcher.js
 * LINE Web版をバックグラウンドで監視し、通知を横取りする。
 * Windowsの通知を出さずに、中身だけを抽出する設計。
 */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

async function launchMonitor(options = { headless: true, onNotification: null }) {
    console.log(`--- LINE 拡張機能モニター 起動 ---`);

    const email = process.env.LINE_EMAIL;
    const password = process.env.LINE_PASSWORD;

    if (!email || !password) {
        console.warn('[WARN] .env ファイルに LINE_EMAIL または LINE_PASSWORD が設定されていません。自動ログインはスキップされます。');
    }

    // 先ほど作成した拡張機能入りのプロファイル
    const userDataDir = path.join(__dirname, 'line_ext_profile');
    if (!fs.existsSync(userDataDir)) {
        console.error('[ERROR] line_ext_profile が見つかりません。先に open_chrome_for_install.bat で環境を作ってください。');
        return;
    }

    // Chromeの実行パス
    const executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

    // クラッシュ防止のロックファイル削除
    const lockFile = path.join(userDataDir, 'SingletonLock');
    if (fs.existsSync(lockFile)) {
        try { fs.unlinkSync(lockFile); } catch (e) {}
    }

    // Playwright起動
    const browserContext = await chromium.launchPersistentContext(userDataDir, {
        channel: 'chrome',
        headless: false,
        viewport: null, // 最大化に追従しやすくするため
        ignoreDefaultArgs: ["--enable-automation", "--disable-extensions"],
        args: [
            "--disable-blink-features=AutomationControlled", // 自動操作フラグを隠す
            "--window-size=800,1000" // スクリーンショットに近いサイズに調整
        ],
        // オプションとして自動化フラグを排除
        // chromium.launchPersistentContext に直接設定できない場合があるが、args/ignoreDefaultArgsで対応
    });

    // 拡張機能が安定するのを待つ
    await new Promise(r => setTimeout(r, 5000));

    // 公式ストアのID
    let extensionId = 'ophjlpahpchlmihnnnihgmmeilfjmjjc';

    // URLを開く
    const page = browserContext.pages()[0] || await browserContext.newPage();
    
    page.on('console', msg => {
        if (msg.text().startsWith('[Monitor]')) {
            console.log(msg.text());
        }
    });

    try {
        await page.goto(`chrome-extension://${extensionId}/index.html`);
        console.log('✅ LINE拡張機能に接続しました。');
    } catch (e) {
        console.error('起動エラー: 拡張機能ページを開けませんでした', e);
        return;
    }

    // --- 自動ログイン処理 ---
    try {
        await new Promise(r => setTimeout(r, 5000));
        
        // ヘルパー関数: 全てのフレームからセレクタを探す
        async function findInFrames(page, selectorOrFn) {
            for (const frame of page.frames()) {
                try {
                    const el = typeof selectorOrFn === 'string' ? frame.locator(selectorOrFn) : selectorOrFn(frame);
                    if (await el.isVisible()) return el;
                } catch (e) {}
            }
            return null;
        }

        console.log('[AutoLogin] 画面状態をチェック中...');

        // 0. すでにチャットリスト（ログイン済み状態）が見えているか確認
        // チャットリストの特徴的な要素（例：検索バーのプレースホルダーやトークリスト）
        const isAlreadyLoggedIn = await page.evaluate(() => {
            return document.body.innerText.includes('トーク') && 
                   document.body.innerText.includes('タイムライン');
        });

        if (isAlreadyLoggedIn) {
            console.log('[AutoLogin] すでにログイン済みのため処理をスキップします。');
            return;
        }

        // 1. まず入力欄があるか確認する（すでに入力画面の場合）
        let emailInput = await findInFrames(page, f => f.getByPlaceholder('メールアドレス'));
        let passwordInput = await findInFrames(page, f => f.getByPlaceholder('パスワード'));

        if (!emailInput || !passwordInput) {
            // 入力欄がないなら、スプラッシュ画面の「ログイン」ボタンを探す
            console.log('[AutoLogin] 入力欄が見つかりません。スプラッシュ画面かチェックします...');
            let splashLoginBtn = await findInFrames(page, f => f.getByText('ログイン', { exact: true }));
            if (splashLoginBtn) {
                console.log('[AutoLogin] スプラッシュ画面のログインボタンをクリックします...');
                await splashLoginBtn.click({ timeout: 10000 });
                await new Promise(r => setTimeout(r, 3000));
                
                // もう一度入力欄を探す
                emailInput = await findInFrames(page, f => f.getByPlaceholder('メールアドレス'));
                passwordInput = await findInFrames(page, f => f.getByPlaceholder('パスワード'));
            }
        }

        if (emailInput && passwordInput && email && password) {
            console.log('[AutoLogin] ログイン情報を入力します...');
            await emailInput.fill(email);
            await passwordInput.fill(password);
            
            // ログインボタン（送信用）を探す
            let submitBtn = await findInFrames(page, f => f.locator('button:has-text("ログイン")').last()); // 複数ある場合は最後（通常下部のボタン）
            if (submitBtn) {
                console.log('[AutoLogin] ログインボタンをクリックします...');
                await submitBtn.click({ timeout: 10000 });
                await new Promise(r => setTimeout(r, 5000));

                // 二要素認証の確認
                const currentUrl = page.url();
                const bodyText = await page.evaluate(() => document.body.innerText);
                if (bodyText.includes('認証番号') || bodyText.includes('本人確認')) {
                    console.log('\n⚠️ 【重要】スマホのLINEアプリに「認証番号」が表示されていませんか？');
                    console.log('表示されている場合は、一度だけアプリで入力をお願いします。\n');
                } else if (currentUrl.includes('index.html')) {
                    console.log('✅ 自動ログインに成功した可能性があります。');
                }
            }
        } else {
            console.log('[AutoLogin] 自動ログインが必要な状態ではないか、完了済みです。');
        }
    } catch (loginError) {
        console.log('[AutoLogin] ログイン処理中にエラー（続行します）:', loginError.message);
        try { await page.screenshot({ path: path.join(__dirname, 'login_failed_debug.png') }); } catch (e) {}
    }

    // ログイン画面かチャットリスト画面かを判定して待機
    console.log('DOMのロードを待機しています...');
    try {
        await page.waitForLoadState('domcontentloaded', { timeout: 10000 });
        await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
        console.log('DOMロード待機をスキップします');
    }

    // DOM変更を監視して新着メッセージ（特定のバッジやメッセージリストの追加）を検知する
    await page.exposeFunction('onLineNotificationHook', (data) => {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[メッセージ受信 ${timestamp}] ${data.title}: ${data.body}`);
        if (options.onNotification) {
            options.onNotification(data);
        }
    });

    // ブラウザ内で定期的にテキストを監視して新着メッセージを探す（MutationObserverが効かないため）
    await page.evaluate(() => {
        console.log('[Monitor] Polling injected.');
        
        let lastMessageCount = 0;
        let previousText = "";
        
        setInterval(() => {
            const currentText = document.body.innerText;
            if (currentText === previousText) return; // 変化なし
            
            // 変化があった場合、新着メッセージの可能性があるので解析
            previousText = currentText;
            
            // テキストを改行で分割
            const lines = currentText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
            
            // 簡易的な「送信者」と「メッセージ」の抽出ロジック
            // コンカフェメモの画面が開かれていると仮定
            // 本来は正確なDOM構造を見ないと完璧ではないが、テキストの変化をトリガーにする
            
            // 下から数行をチェックして、前回と違う行があれば通知する
            // 簡易的に「LINE」拡張の場合は末尾側に最新メッセージが来る
            const recentLines = lines.slice(-5); 
            
            // ここではテキスト全体が変わった＝新着アリとして、
            // 「コンカフェメモ」からのメッセージを模倣して送信する（簡易デモ用）
            // 実運用では正確なDOM要素（例: .message-content）を特定して取得すべき。
            // 今回は "コンカフェメモ" という文字列が含まれているかチェック
            if (currentText.includes("コンカフェメモ")) {
                const targetName = "コンカフェメモ";
                // 最後の行をメッセージと仮定（非常に簡易的なフォールバック）
                const lastLine = lines[lines.length - 1]; 
                
                // 既読とか時間っぽくないものなら通知
                if (!lastLine.includes("午前") && !lastLine.includes("午後") && !lastLine.includes("既読") && lastLine !== "LINE") {
                    
                    const msgKey = `${targetName}:${lastLine}`;
                    if (!window.seenMessages) window.seenMessages = new Set();
                    
                    if (!window.seenMessages.has(msgKey)) {
                        window.seenMessages.add(msgKey);
                        setTimeout(() => window.seenMessages.delete(msgKey), 10000); // 10秒保持
                        
                        window.onLineNotificationHook({ title: targetName, body: lastLine });
                    }
                }
            }
        }, 3000); // 3秒ごとに画面テキストをチェック
    });

    console.log('監視を開始しました（テキストポーリングモード）。');

    return { browserContext, page };
}

// コマンドライン引数でログインモードか判定
if (require.main === module) {
    const isLoginMode = process.argv.includes('--login');
    launchMonitor({ headless: !isLoginMode }).catch(err => {
        console.error('起動エラー:', err);
    });
}

module.exports = { launchMonitor };
