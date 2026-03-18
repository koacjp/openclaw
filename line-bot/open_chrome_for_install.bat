@echo off
echo =======================================================
echo LINE拡張機能 手動インストール用Chrome起動スクリプト
echo =======================================================
echo.
echo Playwright（自動化ツール）経由だとGoogleのセキュリティにより
echo 拡張機能ストアが開けないため、このバッチファイルを使って
echo 通常のChromeからプロファイルに拡張機能をインストールします。
echo.
echo [手順]
echo 1. 開いたChrome画面で「Chromeに追加」をクリックしてLINEをインストールしてください。
echo 2. （必要であれば）LINEのアイコンをクリックしてログインを済ませてください。
echo 3. 終わったら、開いたChromeをすべて「×ボタン」で閉じてください。
echo 4. その後、コマンドプロンプトに戻り `node test_extension.js` を実行してください。
echo.
pause

"C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="%~dp0line_ext_profile" "https://chromewebstore.google.com/detail/line/ophjlpahpchlmihnnnihgmmeilfjmjjc?hl=ja&utm_source=ext_sidebar"

exit
