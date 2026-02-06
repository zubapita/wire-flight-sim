# 3Dフライトシミュレータ 実行計画（同期版）

## 1. 目的
- 8bit風ワイヤーフレーム表現のコックピット視点フライトシミュレータをWebで提供する。
- 初心者向けにキーボードのみで気軽に飛行できる体験を実現する。

## 2. スコープ要約
- In Scope
  - 3Dワイヤーフレーム描画（地形・建物・機体）
  - コックピット視点、キーボード操縦
  - PLATEAU由来データを用いた東京都心飛行
  - 地形読込失敗時の再試行導線
- Out of Scope（現時点）
  - フォトリアル描画、VR、マルチプレイ、ATC/ミッション

## 3. 現在ステータス（2026-02-07時点）
- 完了
  - MVC骨格（Model/View/Controller分離）
  - キーボード操縦、HUD、コックピット視点
  - レイヤー別描画（`building/road/bridge/railway/water`）
  - 実データ由来地形への切替
    - `public/terrain/sample_tokyo_wireframe.json`
    - `source: plateau-13103-minato-ku-2023-v4-real`
  - 地形読込エラーUIと再試行導線
- 未完了
  - `npm run dev` での実表示E2E品質確認（道路密度・橋梁形状・河川連続性）
  - セーフモード起動（地形なしテスト空間）
  - 衝突判定/リスポーン、設定永続化、テスト整備、デプロイ整備

## 4. 実データ運用フロー
1. `npm run build:plateau:feature-collection`
2. `npm run convert:terrain -- --input docs/data/minato_plateau_feature_collection.json --output public/terrain/sample_tokyo_wireframe.json --decimals 4 --source plateau-13103-minato-ku-2023-v4-real`
3. `npm run dev` で目視検証

## 5. 次アクション
1. 実表示E2E確認を実施し、品質観点（道路/橋梁/河川）を記録する。
2. 必要なら地物抽出対象を調整して再生成する。
3. FR-07未完了分（セーフモード）を実装する。
4. `docs/tasks.md` のPhase 2を更新する。
