const https = require('https');
const fs = require('fs');
const path = require('path');

const TELEGRAM_TOKEN = '7669528624:AAEIDM9oM6919pnd7v7w033YhQ_X3k_Qx-Y';
const CHAT_ID = '2033249555';

function sendToTelegram(sender, message) {
    const text = encodeURIComponent(`【LINE DB検知】\n👤 ${sender}\n💬 ${message}`);
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${text}`;
    https.get(url, () => console.log(`[${new Date().toLocaleTimeString()}] 転送完了`));
}

// LINEのDBファイル（.edb は SQLite または LevelDB の派生である場合が多い）
// ここではファイル更新（タイムスタンプ）を監視し、中身が書き換わった瞬間に
// 「何かが届いた」と判断する究極の非通知監視を試みます。

const dbDir = path.join(process.env.LOCALAPPDATA, 'LINE/Data/db');
const dbFiles = fs.readdirSync(dbDir).filter(f => f.endsWith('.edb'));

console.log('--- LINE データベース直接監視（完全無音モード）開始 ---');
console.log('監視対象:', dbFiles.join(', '));

dbFiles.forEach(file => {
    const filePath = path.join(dbDir, file);
    fs.watchFile(filePath, { interval: 1000 }, (curr, prev) => {
        if (curr.mtime > prev.mtime) {
            console.log(`[${new Date().toLocaleTimeString()}] データベースの更新を検知しました。`);
            // ここで本来はDBを読み取りますが、まずは「更新された」という事実だけをTelegramに飛ばします
            sendToTelegram('システム', `データベース(${file})が更新されました。メッセージが届いた可能性があります。`);
        }
    });
});

sendToTelegram('システム', 'データベース監視モードを起動しました。通知をオフにしても反応するはずです。');
