# 在庫管理アプリ（フロントのみ）

HTML / CSS / JavaScript だけで作った、シンプルな在庫管理画面です。  
Supabase の `materials` テーブルから **一覧取得** と **新規登録** を行います。

## できること

- 在庫一覧を表示（`symbol, diameter, thickness, coating-type, quantity, updated-at`）
- 新規行を追加（ダイアログ入力 → SupabaseへINSERT → 再読み込み）

## ファイル構成

- `index.html`: HTML構造
- `style.css`: 見た目（Excelライクなテーブル、固定ヘッダ）
- `main.js`: UI操作（取得・描画・登録）
- `supabase.js`: Supabase接続（URL / anon key を変数で定義）
- `.gitignore`: git管理対象外

## セットアップ

1) Supabaseで `materials` テーブルを用意します（例）

- `symbol` (text)
- `diameter` (numeric)
- `thickness` (numeric)
- `coating_type` (text, null可)
- `quantity` (int)
- `updated_at` (timestamptz)  
  - `updated_at` はトリガーで自動更新にしておくのがおすすめです

2) `supabase.js` の値を自分のプロジェクトに置き換えます

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

3) ブラウザで `index.html` を開きます

## 注意（よくあるハマり）

- RLS（Row Level Security）が有効な場合、`SELECT/INSERT` のポリシーが必要です。
- `coating-type` は画面の表示名で、DB列名は `coating_type` を想定しています。
- `updated-at` はDB列 `updated_at` をそのまま表示しています（ローカル表示に変換）。
