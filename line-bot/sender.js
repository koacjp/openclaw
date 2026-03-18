/**
 * sender.js
 * LINE PC版（Sandboxie内）のウィンドウを特定してメッセージを送信する。
 * puppeteer を使わず、Win32 APIでウィンドウ操作 + クリップボード貼り付けで実現。
 * これにより既読タイミングを「送信の瞬間のみ」に制御できる。
 */
const { execSync, spawn } = require('child_process');

/**
 * LINE PC版のウィンドウを探して指定の相手にメッセージを送信する。
 * @param {string} targetSender - 送信先の名前（LINE上の表示名）
 * @param {string} message - 送信するメッセージテキスト
 */
async function sendLineMessage(targetSender, message) {
    console.log(`[sender] "${targetSender}" へメッセージ送信: ${message}`);

    // PowerShell スクリプトでLINEウィンドウを操作
    const ps = `
Add-Type -AssemblyName System.Windows.Forms

# クリップボードにメッセージをセット
[System.Windows.Forms.Clipboard]::SetText(@"
${message.replace(/"/g, '""')}
"@.Trim())

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public class WinApi {
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    public static IntPtr FindWindow(string keyword) {
        IntPtr found = IntPtr.Zero;
        EnumWindows((hWnd, lParam) => {
            StringBuilder sb = new StringBuilder(256);
            GetWindowText(hWnd, sb, sb.Capacity);
            if (IsWindowVisible(hWnd) && sb.ToString().Contains(keyword)) {
                found = hWnd;
                return false;
            }
            return true;
        }, IntPtr.Zero);
        return found;
    }
}
"@

# LINEのメインウィンドウを探す（タイトルに "LINE" を含むウィンドウ）
$lineHwnd = [WinApi]::FindWindow("LINE")

if ($lineHwnd -eq [IntPtr]::Zero) {
    Write-Error "LINEウィンドウが見つかりませんでした。"
    exit 1
}

# ウィンドウを前面に出す（最小限の時間だけ）
[WinApi]::ShowWindow($lineHwnd, 9) | Out-Null   # SW_RESTORE
[WinApi]::SetForegroundWindow($lineHwnd) | Out-Null
Start-Sleep -Milliseconds 400

# Ctrl+F で検索 → 送信者名を入力
[System.Windows.Forms.SendKeys]::SendWait("^f")
Start-Sleep -Milliseconds 300
[System.Windows.Forms.SendKeys]::SendWait("${targetSender.replace(/[+^%~(){}]/g, '{$&}')}")
Start-Sleep -Milliseconds 500
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Milliseconds 400

# チャット入力欄にフォーカス（Tab で移動）
[System.Windows.Forms.SendKeys]::SendWait("{TAB}")
Start-Sleep -Milliseconds 200

# クリップボードから貼り付け (Ctrl+V)
[System.Windows.Forms.SendKeys]::SendWait("^v")
Start-Sleep -Milliseconds 200

# Enter で送信
[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")
Start-Sleep -Milliseconds 200

# ウィンドウを最小化（既読制御: 送信直後に隠す）
[WinApi]::ShowWindow($lineHwnd, 6) | Out-Null   # SW_MINIMIZE

Write-Output "SENT_OK"
`;

    return new Promise((resolve, reject) => {
        const child = spawn('powershell', ['-Command', ps], { stdio: ['pipe', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', d => stdout += d.toString());
        child.stderr.on('data', d => stderr += d.toString());
        child.on('close', (code) => {
            if (stdout.includes('SENT_OK')) {
                console.log('[sender] 送信成功');
                resolve(true);
            } else {
                console.error('[sender] 送信失敗:', stderr || stdout);
                reject(new Error('送信失敗: ' + (stderr || '詳細不明')));
            }
        });
    });
}

module.exports = { sendLineMessage };
