---
summary: "Run two Telegram bots (e.g. blog + LINE) with one shared workspace"
title: "Telegram: two bots, same workspace"
---

# Telegram: two bots, same workspace

Use two Telegram bots (e.g. **blog bot** and **LINE reply bot**) that share the same workspace so both agents see the same USER.md, skills, and data.

## Steps

### 1. Create the second Telegram bot

- In Telegram, open [@BotFather](https://t.me/BotFather).
- Create a new bot (e.g. **@line444_bot** for LINE replies).
- Copy the **API token** (you will add it in step 2).

### 2. Edit `~/.openclaw/openclaw.json`

Merge the following into your existing config. If you currently have a single bot via **top-level** `channels.telegram.botToken`, move that value into `channels.telegram.accounts.default.botToken` and remove the top-level `channels.telegram.botToken`.

**Snippet to add/merge:**

```json5
{
  "agents": {
    "list": [
      { "id": "main", "workspace": "C:\\Users\\user\\OneDrive\\openclaw", "default": true },
      { "id": "line-bot", "workspace": "C:\\Users\\user\\OneDrive\\openclaw" }
    ]
  },
  "bindings": [
    { "agentId": "main", "match": { "channel": "telegram", "accountId": "default" } },
    { "agentId": "line-bot", "match": { "channel": "telegram", "accountId": "line-notif" } }
  ],
  "channels": {
    "telegram": {
      "accounts": {
        "default": { "botToken": "YOUR_EXISTING_BOT_TOKEN" },
        "line-notif": { "botToken": "YOUR_NEW_LINE_BOT_TOKEN" }
      }
    }
  }
}
```

Replace:

- `YOUR_EXISTING_BOT_TOKEN` — token for @OpenClaw_KG44_bot (or move from existing `channels.telegram.botToken`).
- `YOUR_NEW_LINE_BOT_TOKEN` — token for @line444_bot from BotFather.

Keep any other existing keys (e.g. `tools`, `agents.defaults`, `tools.fs.allowedRoots`) and merge only the sections above.

### 3. Restart and verify

```bash
openclaw gateway restart
openclaw agents list --bindings
openclaw channels status --probe
```

Result:

- **@OpenClaw_KG44_bot** → agent `main` (blog).
- **@line444_bot** → agent `line-bot` (LINE).
- Both use workspace `C:\Users\user\OneDrive\openclaw`.

See [Multi-Agent Routing](/concepts/multi-agent#same-workspace-eg-blog-bot--line-bot) for more options (e.g. different workspaces, `dmPolicy` per account).
