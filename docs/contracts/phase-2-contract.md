# Implementation Contract

## 1. Purpose (1-2 sentences)
継続して遊べる品質を確立するため、衝突復帰・設定保存・障害時復旧の機能を追加する。

## 2. Absolute Constraints
- MUST: 地面/建物の衝突判定を実装すること
- MUST: 衝突後にリスポーンし再開できること
- MUST: 設定（感度、キー割当、画質）を永続化すること
- MUST: 地形読込失敗時に再試行可能なUIを提供すること
- MUST NOT: 永続化でサーバー依存を必須化しないこと
- Technical constraints: localStorage + zod検証、エラーコード統一

## 3. Prohibited Actions
- エラー握り潰しをしない
- 例外時に白画面で停止させない
- 設定変更を即時保存せず破棄する実装にしない

## 4. Future Extension Points (NOT NOW)
- クラウド同期設定
- リプレイ共有
- 詳細難易度設定

## 5. Implementation Notes
- 永続化データはバージョンキーを持つこと
- 破損設定検出時はデフォルト復元し通知すること
- テスト境界: 保存データ破損、衝突連続発生、再試行連打
