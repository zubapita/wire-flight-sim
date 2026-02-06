# Implementation Contract

## 1. Purpose (1-2 sentences)
最小飛行体験(MVP)を実現し、ユーザーが起動直後に東京都心上空を飛行できる状態にする。

## 2. Absolute Constraints
- MUST: MVC分離を守り、Controllerにビジネスロジックを置かないこと
- MUST: コックピット視点のワイヤーフレーム描画を行うこと
- MUST: キーボードでピッチ/ロール/ヨー/スロットル操作可能にすること
- MUST: HUDに速度・高度・方位を表示すること
- MUST NOT: 離陸/着陸機能を追加しないこと
- Technical constraints: 描画はThree.js、状態更新は固定タイムステップ

## 3. Prohibited Actions
- ViewからModelを直接参照しない
- HUDに業務ロジック（判定）を持たせない
- マウス/ゲームパッド操作を追加しない

## 4. Future Extension Points (NOT NOW)
- 機体切替
- 外部視点カメラ
- 高度な空力パラメータ

## 5. Implementation Notes
- 初期スポーンは安全高度を確保すること
- 操作入力の同時押し競合ルールを明文化すること
- テスト境界: キー押下連打、低FPS環境、極端な姿勢角
