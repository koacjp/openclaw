const https = require('https');

const TELEGRAM_TOKEN = '7669528624:AAEIDM9oM6919pnd7v7w033YhQ_X3k_Qx-Y';
const CHAT_ID = '2033249555';

function sendToTelegram(sender, message) {
    const text = encodeURIComponent(`【LINE新着メッセージ】\n送信者: ${sender}\n内容: ${message}`);
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage?chat_id=${CHAT_ID}&text=${text}`;
    
    https.get(url, (res) => {
        console.log('Telegramへ転送しました。');
    }).on('error', (e) => {
        console.error('転送エラー:', e.message);
    });
}

const args = process.argv.slice(2);
if (args.length >= 2) {
    sendToTelegram(args[0], args[1]);
} else {
    console.log('--- LINE通知 転送サーバー起動 ---');
    console.log('監視を開始します...');
}
