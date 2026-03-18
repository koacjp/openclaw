from linepy import *
import sys

try:
    print("--- LINE プロトコル解析ログイン開始 ---")
    # QRコードログインを試行
    client = LINE() 
    
    print("\n[ログイン成功]")
    print(f"Auth Token: {client.authToken}")
    
    # トークンをファイルに保存
    with open("line_token.txt", "w") as f:
        f.write(client.authToken)
    
    print("\nトークンを line_token.txt に保存しました。")
    print("これ以降は、このトークンを使ってバックグラウンドで通信可能です。")

except Exception as e:
    print(f"\n[エラー] ログインに失敗しました: {e}")
    sys.exit(1)
