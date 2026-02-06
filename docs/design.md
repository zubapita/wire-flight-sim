# 3Dフライトシミュレータ 設計書

## 1. 設計方針
- 最小構成を先に完成させ、機能追加は段階実施
- MVCを厳密に分離
- モジュール間は狭いインターフェースで接続

## 2. アーキテクチャ概要
- フロントエンド: Next.js App Router + Three.js
- サーバーサイド: Next.js Route Handlers（地形マニフェスト配信のみ）
- データ変換: オフライン前処理スクリプトでPLATEAUデータを軽量化

## 3. MVC構成
### Model層
- `FlightModel`: 姿勢、速度、位置、失速判定、衝突前状態
- `TerrainModel`: 地形チャンクメタ情報、読み込み状態、キャッシュ参照
- `SessionModel`: ポーズ状態、リスポーン、警告状態
- `SettingsModel`: キーバインド、感度、描画設定、永続化入出力

### View層
- `SceneView`: Three.jsシーン構築・ワイヤーフレーム描画のみ
- `HudView`: 計器と警告表示
- `MenuView`: 設定UI、エラーUI、ライセンス表示

### Controller層
- `InputController`: キーボード入力を正規化してModelへ委譲
- `SimulationController`: tickごとのModel更新をオーケストレーション
- `AppController`: 起動、リソース読込、エラー復旧、View更新トリガー

## 4. 主要シーケンス
1. 起動
- `AppController`が設定をロード
- 地形マニフェスト取得
- `SceneView`初期化
- 初期スポーン位置で開始

2. 毎フレーム
- `InputController`が入力状態を更新
- `SimulationController`が`FlightModel`を更新
- `TerrainModel`が必要チャンクを解決
- `SceneView`/`HudView`へ描画データを渡す

3. 衝突時
- `FlightModel`が衝突フラグを返す
- `SessionModel`でリスポーン座標を決定
- `AppController`が警告表示と再開処理

## 5. FlightModel パラメータ
- `cruiseSpeedMs = 55`
- `stallSpeedMs = 24`
- `maxBankDeg = 60`
- `maxPitchDeg = 30`
- `throttleResponsePerSec = 0.35`
- `autoStabilityGain = 0.12`（初心者向けの弱い自動安定）
- `gravityMs2 = 9.80665`（簡略式で利用）

## 6. エラー設計
- `E_TERRAIN_FETCH`: 地形取得失敗（再試行導線）
- `E_TERRAIN_PARSE`: 変換済みデータ不正（セーフモード導線）
- `E_RENDER_INIT`: WebGL初期化失敗（対応ブラウザ案内）
- `E_SETTINGS_INVALID`: 保存設定不正（デフォルト復帰）

## 7. パフォーマンス設計
- チャンク単位の地形読み込み（半径ベース）
- 画面外/遠景LODの頂点間引き
- 固定タイムステップ（例: 60Hz）+ 描画補間
- 線分数の上限設定（画質プリセット）

## 8. セキュリティ/運用
- API入力をzodでバリデーション
- ルートハンドラは読み取り専用
- エラーログは匿名化し個人情報を保持しない

## 9. 依存関係
- `three`
- `zod`
- `zustand`（状態保持）
- `idb`（IndexedDBアクセス）

## 10. 地形変換パイプライン実装
- 実装スクリプト: `scripts/convert-plateau-to-wireframe.mjs`
- 入力対応:
  - GeoJSON `FeatureCollection` (`Polygon` / `MultiPolygon`)
  - CityJSON (`MultiSurface` / `Solid`)
- 出力:
  - `schemaVersion`
  - `vertexCount` / `edgeCount`
  - `vertices: number[][]`
  - `edges: number[][]`
- 変換規則:
  - 頂点は小数桁丸め（`--decimals`）後に重複排除
  - エッジは無向辺として正規化し重複排除
  - CityObjectはキー昇順で処理し再現性を確保
- 終了コード:
  - `2` 引数不正
  - `3` 入力読込失敗
  - `4` JSONパース失敗
  - `5` 変換失敗
  - `6` 出力書込失敗
