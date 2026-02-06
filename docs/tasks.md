# 3Dフライトシミュレータ 実装タスク

## 現状課題（2026-02-07確認）
- [x] 描画データを `public/terrain/sample_tokyo_wireframe.json`（`source: plateau-13103-minato-ku-2023-v4-real`）へ更新し、PLATEAU由来の実データへ移行
- [ ] レイヤー別描画は実装済みだが、実PLATEAU東京都心データでの表示品質（道路密度・橋梁形状・河川連続性）の検証が未完了
- [x] GeoJSON/CityJSON入力の属性命名ゆらぎ（`type` / `class` / `layer`）に対する対象レイヤー定義を確定（`layer` 優先、LineString/MultiLineString対応）

### 解決タスク（優先）
- [x] PLATEAU入力データの対象レイヤーを確定（建物に加えて道路・橋梁・鉄道・水部を対象化）
- [x] `scripts/convert-plateau-to-wireframe.mjs` にインフラ種別の出力属性（例: layer/type）を追加
- [x] `TerrainModel` で属性付きデータを受け取り、描画用メッシュをレイヤー別に組み立て
- [x] `SceneView` でレイヤー別描画（視認性のための色/線種/表示切替）を実装
- [x] 東京都心の実データ変換結果でE2E動作確認を完了する（`http://localhost:3001` と `http://localhost:3001/?safeMode=1` を確認）

### 完了判定
- [x] ビルのみではなく、少なくとも道路または橋梁のいずれかが同時表示される
- [x] `public/terrain/sample_tokyo_wireframe.json` の `source` が実データ由来である
- [x] 失敗時のエラー表示と再試行導線が維持される

## Phase 0: 基盤準備
- [x] Next.js + TypeScript プロジェクト初期化
- [x] Three.js導入
- [x] lint/test/buildパイプライン整備（`npm run lint` / `npm run typecheck` / `npm run test` / `npm run build`）
- [ ] PLATEAUデータ取得手順の確定と出典表記文言の確定
- [x] 地形前処理スクリプト作成（JSONワイヤーフレーム形式）

## Phase 1: 最小飛行体験（MVP）
- [x] MVC骨格実装（Model/View/Controller分離）
- [x] ワイヤーフレーム地形の固定読み込み
- [x] キーボード操縦（ピッチ/ロール/ヨー/スロットル）
- [x] コックピット視点カメラ
- [x] HUD最低限表示（速度・高度・方位）

## Phase 2: プレイ継続性
- [x] 衝突判定とリスポーン
- [x] 一時停止/再開
- [x] 設定画面と永続化（localStorage）
- [x] エラーハンドリング（再試行/セーフモード）
- 再試行導線とセーフモード起動（`SAFE MODE` ボタン / `?safeMode=1`）は実装済み
- セーフモード時のE2E表示確認は完了（`?safeMode=1` でSAFE MODEバナー表示を確認）

## Phase 3: データ最適化
- [x] チャンク読み込み + IndexedDBキャッシュ
- [x] LOD制御と線分数上限
- [x] 初回ロード短縮（プリロード戦略）
- [x] ライセンス表示UIの最終化

## Phase 4: 品質保証・リリース
- [x] ユニットテスト（Model中心）
- [ ] API統合テスト
- [ ] E2Eテスト（起動/飛行/衝突/再開）
- [ ] Vercelデプロイ設定
- [ ] 運用手順書作成

## 完了条件
- [ ] Plan.mdのIn Scopeを全実装
- [ ] MVC境界違反がない
- [ ] TODO/仮実装/ダミーデータが残っていない
- [ ] 永続化、バリデーション、エラー処理が実装済み
