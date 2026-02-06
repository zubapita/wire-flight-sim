# Implementation Contract

## 1. Purpose (1-2 sentences)
開発基盤と地形データ変換パイプラインを構築し、以降フェイズが実データを前提に進められる状態を作る。

## 2. Absolute Constraints
- MUST: Next.js + TypeScript + Three.jsの最小起動を確認すること
- MUST: PLATEAU由来の東京都心データ取得元とライセンス文言を文書化すること
- MUST: 地形変換スクリプトは再実行可能で同一入力から同一出力を生成すること
- MUST NOT: フライトロジックやUI機能を先行実装しないこと
- Technical constraints: Node.js LTS、App Router、変換出力はJSON

## 3. Prohibited Actions
- 本フェイズでゲームプレイ機能を追加しない
- 手作業で編集した地形データを成果物としない
- 出典不明データを混在させない

## 4. Future Extension Points (NOT NOW)
- 地形変換の並列化
- 複数都市対応
- 圧縮形式（Draco等）対応

## 5. Implementation Notes
- データ変換失敗時の終了コードとログを明示すること
- 以降フェイズの前提は「変換済み地形が一意に再生成可能」である
- テスト境界: 空ファイル入力、不正座標入力、巨大ファイル入力
