# 3Dフライトシミュレータ UI設計書

## 1. 画面一覧
- `FlightScreen`（メイン飛行画面）
- `PauseMenu`（一時停止メニュー）
- `SettingsPanel`（キー設定・感度設定・画質設定）
- `TerrainStatusOverlay`（地形読込状態・障害時オーバーレイ）
- `LicensePanel`（データ出典表示）

## 2. レイアウト
### FlightScreen
- 全画面: 3Dワイヤーフレーム表示
- 左上: 速度/高度/方位
- 右上: 姿勢/スロットル
- 中央: `PAUSED` / `COLLISION - RESPAWNED` 表示
- 中央下: 警告表示（`STALL RISK` / `GROUND PROXIMITY`）
- 下部中央: キーヘルプ表示
- 上部中央: 地形読込中バナー（`LOADING TERRAIN...`）

### TerrainStatusOverlay
- 地形読込失敗時に全画面オーバーレイ表示
- 表示内容: エラータイトル / エラーメッセージ / `RETRY` ボタン / `SAFE MODE` ボタン
- `RETRY` クリックでControllerの再試行処理を実行
- `SAFE MODE` クリックで地形なしテスト空間へ切替
- セーフモード中は上部バナーに `SAFE MODE: TERRAIN DISABLED` を表示し、`TRY TERRAIN MODE` で通常再試行

### PauseMenu
- `Esc` 押下で中央モーダル表示
- 項目: `RESUME` / `SETTINGS` / `LICENSE`
- `SETTINGS` 展開時:
  - 感度スライダ
  - 画質選択（Low/Medium/High）
  - キー割当テキスト入力
  - `RESET DEFAULTS`
- `LICENSE` 展開時: PLATEAU出典とリンク表示

### License Access（常設）
- 右下に常設 `LICENSE` ボタンを配置
- 飛行中でも `LICENSE` パネルを開閉できる（Pause不要）
- 表示内容: 出典文言 / PLATEAUリンク / ローカル利用アセットパス

## 3. 視覚デザイン
- 背景: 黒系
- 線色: シアン/グリーン基調（レトロCRT風）
- フォント: 等幅フォントを基本
- 警告は色+テキストで表示

## 4. UXポリシー
- 初回起動で操作説明を1行表示
- 難易度は固定（初心者向け）
- 失敗時は即時再開可能（衝突後3秒の通知表示）
- 地形読込失敗時は、画面遷移なしで同一画面から再試行できる

## 5. View責務境界
- Viewは受け取った表示データのみを描画
- 条件分岐はControllerで完了した状態を受け取る
- Model参照は禁止

## 6. アクセシビリティ
- 主要操作はキーボードのみで完結
- 色覚差対応のためHUD警告は色+テキストで表示
- PauseMenuは `role="dialog"` と `aria-modal="true"` を付与
