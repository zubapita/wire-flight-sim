# Implementation Contract

## 1. Purpose (1-2 sentences)
実運用性能を満たすため、地形ストリーミングと描画最適化を導入してVercel配信に適合させる。

## 2. Absolute Constraints
- MUST: チャンク単位の遅延読み込みを実装すること
- MUST: IndexedDBキャッシュを導入し再訪時の読込を短縮すること
- MUST: LODまたは線分上限により描画負荷を制御すること
- MUST: 出典ライセンスUIを常時アクセス可能にすること
- MUST NOT: 画質優先で操作遅延を悪化させないこと
- Technical constraints: キャッシュ上限管理、API入力バリデーション

## 3. Prohibited Actions
- 無制限キャッシュ保存をしない
- チャンク識別子の非検証受け入れをしない
- 最適化と引き換えにMVC境界を崩さない

## 4. Future Extension Points (NOT NOW)
- CDNエッジ圧縮配信
- 動的天候
- 他都市のオンデマンド追加

## 5. Implementation Notes
- チャンク取得失敗時は近傍代替チャンクで継続を優先すること
- LOD切替閾値は設定可能定数化すること
- テスト境界: キャッシュ満杯、低速回線、チャンク欠損
