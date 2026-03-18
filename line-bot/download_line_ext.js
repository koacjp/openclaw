/**
 * download_line_ext.js
 * LINEのChrome拡張機能をダウンロードして解凍するスクリプト
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const EXTENSION_ID = 'ophjlpahpchlmihnnnihgmmeilfjmjjc';
// Chrome バージョン120を偽装してダウンロード用URLを生成
const DOWNLOAD_URL = `https://clients2.google.com/service/update2/crx?response=redirect&prodversion=120.0.0.0&acceptformat=crx2,crx3&x=id%3D${EXTENSION_ID}%26uc`;
const ZIP_PATH = path.join(__dirname, 'line_ext.zip');
const EXT_DIR = path.join(__dirname, 'line_ext');

console.log('LINE拡張機能のダウンロードを開始します...');

function downloadCrx(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const request = https.get(url, function(response) {
            // リダイレクト対応
            if (response.statusCode === 302 || response.statusCode === 301) {
                file.close();
                fs.unlinkSync(dest); // 古いファイルを削除
                resolve(downloadCrx(response.headers.location, dest));
                return;
            }
            
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }

            response.pipe(file);
            file.on('finish', function() {
                file.close(resolve);
            });
        }).on('error', function(err) {
            fs.unlink(dest, () => reject(err));
        });
    });
}

async function main() {
    try {
        if (!fs.existsSync(EXT_DIR)) {
            fs.mkdirSync(EXT_DIR);
        }

        console.log(`URL: ${DOWNLOAD_URL}`);
        await downloadCrx(DOWNLOAD_URL, ZIP_PATH);
        console.log('ダウンロード完了。ZIP(CRX)を展開します...');

        // PowerShellを使ってZIPを展開（CRXは実質ZIP）
        // CRX3形式の場合ヘッダがあるため単純な解凍ツールでは失敗することがあるが、
        // PowerShellのExpand-Archiveで試行する、またはtarを使う
        try {
            // Windows 10以降内蔵のtarコマンドでCRXを展開
            execSync(`tar -xf "${ZIP_PATH}" -C "${EXT_DIR}"`, { stdio: 'inherit' });
            console.log('✅ 拡張機能の展開に成功しました！');
            
            // _metadata フォルダがあるとChromeがエラーを出すことがあるためリネームまたは削除
            const metadataPath = path.join(EXT_DIR, '_metadata');
            if (fs.existsSync(metadataPath)) {
                fs.renameSync(metadataPath, path.join(EXT_DIR, 'metadata_backup'));
            }
            
        } catch (e) {
            console.error('展開エラー:', e.message);
            console.log('※CRX形式のため展開に失敗した可能性があります。');
        }

        // 不要なZIPを削除
        if (fs.existsSync(ZIP_PATH)) {
            fs.unlinkSync(ZIP_PATH);
        }

        console.log('\n準備完了！ `node test_extension.js` を実行してテストを行ってください。');

    } catch (err) {
        console.error('エラー発生:', err);
    }
}

main();
