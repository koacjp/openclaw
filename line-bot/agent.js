/**
 * agent.js
 * LINE Bot オーケストレーター (Human-in-the-Loop強化版)
 */

const { sendLineMessage } = require('./sender');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { launchMonitor } = require('./launcher');

const LOG_FILE = path.join(__dirname, 'agent.log');

// openclaw.json に合わせた正規のトークン
const TELEGRAM_TOKEN = '8745565402:AAEo1oE-W5QhLVch2jLNV9rDGdsMJ3AhEVU';
const CHAT_ID = '2033249555';

function log(msg) {
    const timestamp = new Date().toLocaleString();
    const line = `[${timestamp}] ${msg}\n`;
    console.log(line.trim());
    try {
        fs.appendFileSync(LOG_FILE, line);
    } catch (e) {}
}

log('--- LINE Bot オーケストレーター 起動 ---');

function notifyTelegram(text) {
    const safeText = encodeURIComponent(text);
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${safeText}`;
    
    https.get(url, (res) => {
        log(`Telegram通知送信済み Status: ${res.statusCode}`);
    }).on('error', (e) => {
        log(`[ERROR] Telegram通知エラー: ${e.message}`);
    });
}

// 状態管理
const messageBuffer = {}; // { "sender": { text: [], timer: null } }
const pendingOptions = {}; // { "sender": ["Pattern 1", "Pattern 2", "Pattern 3"] }

// メッセージ蓄積用関数
function bufferMessage(sender, body) {
    // コンカフェメモ以外は一旦無視（安全のため）
    if (!sender.includes('コンカフェメモ')) {
        log(`対象外のユーザーからの通知: ${sender}`);
        return;
    }

    if (!messageBuffer[sender]) {
        messageBuffer[sender] = { text: [], timer: null };
    }

    messageBuffer[sender].text.push(body);

    // 既存のタイマーがあればリセット（連続メッセージをまとめるため）
    if (messageBuffer[sender].timer) {
        clearTimeout(messageBuffer[sender].timer);
    }

    log(`[Buffer] ${sender}からのメッセージを蓄積中... (10秒後に処理)`);
    // 10秒待機してバッチ処理
    messageBuffer[sender].timer = setTimeout(() => {
        processBufferedMessages(sender);
    }, 10000);
}

// AI生成とTelegram確認フロー
async function processBufferedMessages(sender) {
    const fullMessage = messageBuffer[sender].text.join('\n');
    delete messageBuffer[sender];

    log(`[AI処理開始] ${sender} のメッセージ:\n${fullMessage.replace(/\n/g, ' ')}`);
    notifyTelegram(`【LINE新着】👤 ${sender}\n💬\n${fullMessage}\n\n🤖 AIが返信候補を作成中です...`);

    const prompt = `以下の相手からのLINEメッセージに対して、返信候補を3パターン作成してください。
出力は必ず以下の形式にし、前置きや補足は不要です。各パターンの間には必ず「---」という行を挟んでください。

[パターン1の文章]
---
[パターン2の文章]
---
[パターン3の文章]

【相手からのメッセージ】
${fullMessage}`;

    try {
        log(`OpenClaw CLIを呼び出しています...`);
        const aiOutput = await askAI(prompt);
        log(`[AI生成完了]\n${aiOutput}`);

        // 「---」で分割して配列化
        const patterns = aiOutput.split('---').map(s => s.trim()).filter(s => s.length > 0);
        
        let telegramMsg = `【LINE返信候補】👤 ${sender}\n\n`;
        const validPatterns = [];
        
        for (let i = 0; i < Math.min(patterns.length, 3); i++) {
            telegramMsg += `${i + 1}. ${patterns[i]}\n\n`;
            validPatterns.push(patterns[i]);
        }
        
        telegramMsg += `送信したい番号を「${sender}: 1」のように返信してください。`;
        
        // メモリに保存
        pendingOptions[sender] = validPatterns;
        
        notifyTelegram(telegramMsg);

    } catch (e) {
        log(`[ERROR] AI生成エラー: ${e.message}`);
        notifyTelegram(`[ERROR] AI生成中にエラーが発生しました: ${e.message}`);
    }
}

// OpenClaw CLI呼び出し
function askAI(prompt) {
    return new Promise((resolve, reject) => {
        // Workspace root dir で pnpm openclaw agent を叩く
        const child = spawn('pnpm', ['openclaw', 'agent', '--agent', 'line-agent', '--message', prompt, '--thinking', 'low'], {
            cwd: path.join(__dirname, '..'),
            shell: true,
            windowsHide: true
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', d => stdout += d.toString());
        child.stderr.on('data', d => stderr += d.toString());

        child.on('close', code => {
            if (code === 0) {
                // pnpm のゴミ出力や、CLIのspinnerの残骸を整理できるが、とりあえずそのまま返す
                // \x1B等のエスケープシーケンスが含まれる懸念があるため正規表現で消す
                const cleanOut = stdout.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '').trim();
                resolve(cleanOut);
            } else {
                reject(new Error(`Exit ${code}: ${stderr}`));
            }
        });
        
        child.on('error', err => {
            reject(err);
        });
    });
}

// Telegramからの入力待ち受け
let lastUpdateId = 0;
function pollTelegram() {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/getUpdates?offset=${lastUpdateId + 1}&timeout=30`;
    
    const req = https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', async () => {
            try {
                if (res.statusCode !== 200) {
                    log(`[WARN] Telegram API Status: ${res.statusCode}`);
                    setTimeout(pollTelegram, 5000);
                    return;
                }
                const json = JSON.parse(data);
                if (json.ok && json.result.length > 0) {
                    for (const update of json.result) {
                        lastUpdateId = update.update_id;
                        if (update.message && update.message.text) {
                            const text = update.message.text;
                            log(`Telegram受信: ${text}`);
                            
                            if (text.includes(':')) {
                                const parts = text.split(':');
                                const target = parts[0].trim();
                                const replyContent = parts.slice(1).join(':').trim();
                                
                                // 数字の指定かチェック
                                const optionNum = parseInt(replyContent, 10);
                                if (!isNaN(optionNum) && pendingOptions[target] && optionNum >= 1 && optionNum <= pendingOptions[target].length) {
                                    // パターンから文章を取得
                                    const actualMessage = pendingOptions[target][optionNum - 1];
                                    try {
                                        await sendLineMessage(target, actualMessage);
                                        log(`LINEパターンの送信成功: ${target}`);
                                        notifyTelegram(`✅ 送信完了: ${target}\n「${actualMessage}」`);
                                        delete pendingOptions[target]; // 成功したらクリア
                                    } catch (err) {
                                        log(`[ERROR] LINEパターンの送信失敗: ${err.message}`);
                                        notifyTelegram(`[ERROR] LINE送信失敗: ${err.message}`);
                                    }
                                } else {
                                    // 数字以外なら、直接その文章を送るフォールバック（既存の機能）
                                    log(`直接送信を試行: ${target} -> ${replyContent}`);
                                    try {
                                        await sendLineMessage(target, replyContent);
                                        log(`LINE直接送信成功: ${target}`);
                                        notifyTelegram(`✅ 直接文字入力での送信完了: ${target}`);
                                    } catch (err) {
                                        log(`[ERROR] LINE直接送信失敗: ${err.message}`);
                                        notifyTelegram(`[ERROR] LINE文字入力送信失敗: ${err.message}`);
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                log(`[ERROR] JSON解析/処理エラー: ${e.message}`);
            }
            // 正常終了時も次のポーリングへ
            setImmediate(pollTelegram);
        });
    });

    req.on('error', (e) => {
        log(`[ERROR] ポーリングRequestエラー: ${e.message}`);
        setTimeout(pollTelegram, 5000);
    });

    req.on('timeout', () => {
        log(`[WARN] ポーリングTimeout`);
        req.destroy();
        setTimeout(pollTelegram, 1000);
    });

    req.setTimeout(60000); 
}

// エントリーポイント
async function main() {
    try {
        await launchMonitor({
            headless: false, // 拡張機能を動かすため必須
            onNotification: (data) => {
                bufferMessage(data.title, data.body);
            }
        });
        
        log('通知監視 (Chrome拡張機能版) を開始しました。');
    } catch (e) {
        log(`[CRITICAL] モニター起動失敗: ${e.message}`);
    }

    pollTelegram();
    log('返信待ち受け (polling) を開始しました。');
}

main();
