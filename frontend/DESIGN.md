# DESIGN.md — Housework フロントエンド デザイン規約（SP）

このファイルは、フロントエンドの見た目に関する唯一の基準です。UI を追加・変更する PR は、このファイルの値と禁止事項に従います。
迷ったら「端末標準の UI に近づける」を優先します（案B「標準UI」を採用）。

対象は SP（390px 幅）のアプリ画面です。LP（`/landing`）は対象外で、従来の暗色デザインのまま残します。

## 1. トーン

- ライトテーマ固定。ダークモードは提供しない
- 装飾ではなく「箱の分け方」「文字の太さ」「行の高さ」で情報を整理する
- 家族／個人は **箱とカードの色** で表す。周期（毎日・毎週火曜・9/22）は **カード内のチップ** で表す

## 2. カラートークン（Tailwind: `tailwind.config.js` の `theme.extend.colors`）

| トークン | 値 | 用途 |
| --- | --- | --- |
| `canvas` | `#F2F2F5` | 画面の背景 |
| `surface` | `#FFFFFF` | 箱・カード・入力欄・ナビの面 |
| `ink` | `#111114` | 本文 |
| `ink-muted` | `#5C5C66` | 補助文字（日付、時刻、件数） |
| `ink-soft` | `#3C3C44` | 非選択のボタン文字 |
| `line` | `#E5E5EA` | 区切り線 |
| `line-strong` | `#D8D8DE` | 入力欄の枠、ナビの上線 |
| `control` | `#E3E3E8` | セグメント切替の下地、未達の進捗バー |
| `accent` | `#1F7A4D` | 主ボタン、選択中タブ、リンク、進行中の輪、獲得 pt |
| `accent-strong` | `#175C3A` | 主ボタンの押下・ホバー |
| `family` | `#EDF5F0` | 家族タスクのカード背景 |
| `family-ink` | `#1F5C3A` | 家族タスクの強調文字（カレンダーのチップ文字） |
| `family-chip` | `#D9EBDF` | カレンダー上の家族タスクのチップ背景 |
| `personal` | `#E9EEF8` | 個人タスクのカード背景 |
| `personal-ink` | `#2B4C7E` | 個人タスクの強調文字 |
| `personal-chip` | `#DCE4F4` | カレンダー上の個人タスクのチップ背景 |
| `cycle` / `cycle-ink` | `#E1ECFA` / `#1D4E89` | 定期の周期チップ（毎日、平日毎日、毎週火曜） |
| `once` / `once-ink` | `#FDECD2` / `#8A4B08` | 単発の期日チップ（9/22） |
| `danger` | `#B42318` | 削除、担当者なしの注意文 |
| `placeholder` | `#8E8E96` | 入力欄のプレースホルダー |
| `icon-muted` | `#B0B0B8` | 行末の chevron |

- 文字と背景のコントラストは常に **4.5:1 以上**（24px 以上の見出しは 3:1 以上）。上の組み合わせは計算済み
- 白文字を載せてよい塗りは `accent` と `danger` のみ

## 3. タイポグラフィ

```
font-family: -apple-system, BlinkMacSystemFont, "Hiragino Sans",
             "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif;
```

- 端末フォントを最優先し、Noto Sans JP は Web フォントとしてフォールバック読込。Inter は使わない
- サイズと太さ（数字は `font-variant-numeric: tabular-nums`）

| 役割 | サイズ / 太さ |
| --- | --- |
| 大見出し（画面タイトル） | 34px / 700 |
| 小見出し（戻るボタン付きの画面） | 22px / 700 |
| 箱のタイトル | 15px / 700 |
| カードのタスク名 | 17px / 500 |
| 本文・ボタン | 15〜16px / 500〜700 |
| 補助（時刻、件数、担当者） | 13px / 400〜500 |
| チップ | 12px / 700 |
| 下タブのラベル | 10px / 500 |

## 4. 形と余白

| 要素 | 角丸 | 余白 |
| --- | --- | --- |
| 箱（家族のタスク／自分のタスク） | 14px | 内側 12px、箱同士 12px |
| カード（箱の中） | 10px | 内側 12px 14px、カード同士 8px |
| 単体のカード（進捗、プロフィール） | 12px | 内側 14〜16px |
| 入力欄・主ボタン | 10px | 高さ 50px |
| セグメント切替 | 外 10px / 内 8px | 高さ 44px（内側 38px） |
| チップ | 6px | 2px 8px |
| 丸ボタン（更新、追加） | 22px（円） | 44px |

- 画面の左右余白は 16px、箱の中の見出しの左右は 4px
- 影は使わない。面の差は背景色（`canvas` の上に `surface`）だけで出す

## 5. 部品の決まり

- **タップ領域は 44×44px 以上**。アイコンだけのボタンにも `aria-label` を付ける
- **進行中**は左端に「輪（2.5px の `accent`）＋中の丸」、未着手は薄いグレーの輪。文字で「進行中」とは書かない
- **担当者がいない**カードは補助行の右端に `danger` 色で「担当者がいません」
- **完了**は左端に `accent` のチェックアイコン、右端に `+10pt`
- **カレンダー**は日付の下にタスク名の先頭 4 文字を家族／個人の色で表示。当日は白地に `accent` の枠線、日付を `accent` の丸で囲む
- **下タブ**は `surface` 背景・上に `line-strong` の線・高さ 83px（セーフエリア込み）。選択中は `accent`

## 6. 禁止事項（PR レビューで機械的に落とす）

- グラデーション（背景、文字、枠）
- `backdrop-blur`、`blur-*` の光る装飾、ネオン風の発光枠
- `hover:scale-*` などホバー時の拡大（SP にホバーは無い）
- 絵文字を UI の記号として使うこと（メダル、星など）。アイコンは lucide-react の線アイコン
- 「カードの中にカード」を装飾目的で重ねること（家族／個人の箱は情報構造のためなので可）
- 全要素に同じ角丸を付けること（上の表に従う）
- Inter / Roboto / Arial の指定
- 44px 未満のタップ領域、4.5:1 未満の文字コントラスト
- ダークモード用のクラス（`dark:`）の追加

## 7. 参照

- 認識合わせのキャンバス（案B 各画面）: https://claude.ai/artifact/PSuKGRV4KPcvnpTC5Gtxqr
- WCAG 2.2 1.4.3 Contrast (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html
- Apple Human Interface Guidelines, Accessibility（iOS の既定コントロールサイズ 44×44pt）: https://developer.apple.com/design/human-interface-guidelines/accessibility
- Refactoring UI（開発者向けの視覚設計の考え方）: https://www.refactoringui.com/
