# ワークスペースを一か所にまとめる（推奨構成）

`~/.openclaw/skills` をリポジトリの `.openclaw` に移したあと、**設定 1 本**と**マニュアル推奨のフォルダ**にまとめる手順です。

## 推奨する最終形

- **設定**: `~/.openclaw/openclaw.json` のみ（1 ファイル）
- **ワークスペース**: `agents.defaults.workspace` で指定する 1 フォルダ（例: リポジトリルート）
- **ブートストラップ**（USER.md, AGENTS.md, SOUL.md, TOOLS.md など）: そのワークスペースの**直下**
- **Skills**: そのワークスペースの **`skills/`**（`<workspace>/skills`）

ドキュメント: [Agent Workspace](https://docs.openclaw.ai/concepts/agent-workspace)、[Skills](https://docs.openclaw.ai/tools/skills)。

## パスの対応

| 用途           | 推奨パス（workspace = リポジトリルート） |
|----------------|------------------------------------------|
| USER.md など   | `C:\Users\user\OneDrive\openclaw\USER.md` |
| AGENTS.md      | `C:\Users\user\OneDrive\openclaw\AGENTS.md` |
| SOUL.md        | `C:\Users\user\OneDrive\openclaw\SOUL.md` |
| TOOLS.md       | `C:\Users\user\OneDrive\openclaw\TOOLS.md` |
| memory/        | `C:\Users\user\OneDrive\openclaw\memory\` |
| skills/        | `C:\Users\user\OneDrive\openclaw\skills\` |
| 設定           | `C:\Users\user\.openclaw\openclaw.json`   |

## 手順 1: スクリプトで「新しい方」を採用して配置

次のスクリプトは、

- `C:\Users\user\.openclaw\workspace\`
- `C:\Users\user\OneDrive\openclaw\.openclaw\workspace\`
- `C:\Users\user\OneDrive\openclaw\`（既にある場合）

の 3 か所の USER.md / AGENTS.md / SOUL.md / TOOLS.md 等を **更新日時が新しい方** で比較し、  
**ワークスペースルート**（`C:\Users\user\OneDrive\openclaw\`）に 1 セットだけコピーします。  
**重複時**: すでにワークスペースルートに同名ファイルがあり、かつ別場所の方が新しい場合は、  
いったん既存ファイルを **`USER_B.md` のように末尾 `_B` 付きでリネーム**してから新しい方をコピーします。  
中身を比べて手動でマージするときは、`*_B.md` を参照してください。  
Skills は `.openclaw\skills` を `<workspace>\skills` にマージします。

```powershell
# 実行例（リポジトリルートで）
cd C:\Users\user\OneDrive\openclaw
.\scripts\consolidate-workspace.ps1 -WorkspaceRoot "C:\Users\user\OneDrive\openclaw" -WhatIf
# 問題なければ -WhatIf を外して実行
.\scripts\consolidate-workspace.ps1 -WorkspaceRoot "C:\Users\user\OneDrive\openclaw"
```

## 手順 2: 設定を 1 本にする

- 使用する設定ファイルは **`~/.openclaw/openclaw.json`** のみにします（マニュアル推奨の場所）。
- その中でワークスペースをリポジトリに合わせます。

```json5
{
  "agents": {
    "defaults": {
      "workspace": "C:\\Users\\user\\OneDrive\\openclaw"
    }
  },
  "tools": {
    "fs": {
      "allowedRoots": [
        "C:\\Users\\user\\.openclaw",
        "C:\\Users\\user\\OneDrive\\openclaw"
      ]
    }
  }
}
```

- リポジトリ内の `.openclaw\openclaw.json` は、**この 1 本の設定のバックアップ**として使うか、  
  本番では使わず `OPENCLAW_CONFIG_PATH` を未設定のまま `~/.openclaw\openclaw.json` だけを参照する形にします。

## 手順 3: 内容を手で選びたい場合

「新しい方」ではなく **内容の精度で選びたい** 場合は、スクリプト実行後に次を手動で編集します。

- ワークスペースルートの `USER.md`, `AGENTS.md`, `SOUL.md`, `TOOLS.md` 等を開く。
- 旧場所（`~\.openclaw\workspace\` や `.openclaw\workspace\`）の同名ファイルと比較し、  
  残したい方をワークスペースルートのファイルに上書き保存。

## まとめ

- **設定**: `~/.openclaw/openclaw.json` のみ。`agents.defaults.workspace` でリポジトリルートを指定。
- **ブートストラップ・Skills**: 上記スクリプトで「新しい方」をワークスペースルートと `<workspace>/skills` に集約。
- 必要なら手順 3 で内容を手動で調整。

これで「設定 1 ファイル」と「マニュアル推奨のフォルダ（ワークスペース直下 + skills）」に揃えられます。
