/**
 * sandbox_monitor.js
 * Sandboxie環境下でLINEの通知ウィンドウをスキャンし、
 * 「DETECTED|送信者|||内容」フォーマットでstdoutに出力する。
 * agent.js から child_process として起動される。
 */
const { spawn } = require('child_process');

// PowerShell スクリプト: ウィンドウタイトルを高速スキャン
const psScript = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Collections.Generic;

public class Scanner {
    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    public static void Run() {
        var seen = new HashSet<string>();
        while(true) {
            EnumWindows((hWnd, lParam) => {
                StringBuilder sb = new StringBuilder(1024);
                GetWindowText(hWnd, sb, sb.Capacity);
                string t = sb.ToString();

                // LINEの通知ウィンドウ: "送信者名 : メッセージ内容" の形式
                // 例: "田中 : 今夜空いてる？"
                if (!string.IsNullOrEmpty(t) && t.Contains(" : ") && !t.Equals("LINE") && !t.StartsWith("http")) {
                    if (!seen.Contains(t)) {
                        seen.Add(t);

                        // 「送信者 : 内容」を分割してパース
                        int idx = t.IndexOf(" : ");
                        string sender = t.Substring(0, idx).Trim();
                        string body   = t.Substring(idx + 3).Trim();

                        // 重複防止のため seen は100件でリセット
                        Console.WriteLine("DETECTED|" + sender + "|||" + body);
                        Console.Out.Flush();

                        // ★重要: 通知ウィンドウを即座に非表示にして既読回避
                        ShowWindow(hWnd, 0);
                    }
                }
                return true;
            }, IntPtr.Zero);

            System.Threading.Thread.Sleep(20); // 0.02秒間隔で超高速スキャン
            if (seen.Count > 200) seen.Clear();
        }
    }
}
"@

[Scanner]::Run()
`;

// agent.js から直接 require して使えるようにする
function startMonitor(onDetect) {
    console.log('[monitor] LINE通知スキャン開始...');
    const child = spawn('powershell', ['-Command', psScript], {
        stdio: ['pipe', 'pipe', 'inherit'],
    });

    child.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('DETECTED|')) {
                const parts = trimmed.slice('DETECTED|'.length).split('|||');
                const sender = parts[0] || '不明';
                const body   = parts[1] || '';
                if (sender && body) {
                    onDetect({ sender, body, receivedAt: new Date() });
                }
            }
        }
    });

    child.on('exit', (code) => {
        console.log(`[monitor] スキャン終了 (code=${code})。5秒後に再起動します...`);
        setTimeout(() => startMonitor(onDetect), 5000);
    });

    return child;
}

// 単独起動時のデバッグ用
if (require.main === module) {
    startMonitor(({ sender, body }) => {
        console.log(`[検知] ${sender}: ${body}`);
    });
}

module.exports = { startMonitor };
