# LINE Reply Optimization Skill

## Logic
- 顧客からのメッセージ解析。
- 返信候補3案作成。
- 返信タイミングの算出（平均速度 * 1.2〜1.5、最低120分）。
- スケジュール送信（cron使用）。

## Command Format
- `A [番号]` : 指定した候補を推奨時刻に予約送信
- `A [番号] now` : 即時送信
- `A list` : 現在の未対応メッセージ一覧
