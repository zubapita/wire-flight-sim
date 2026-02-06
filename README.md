# Wireframe Flight Simulator (Tokyo)

Next.js + Three.js で作る、8bit風ワイヤーフレームのコックピット視点フライトシミュレータです。

## セットアップ
```bash
npm install
npm run dev
```

## 実装済み（今回）
- Next.js + TypeScript 初期化
- Three.js導入
- MVC骨格（Model / View / Controller 分離）
- 最小飛行ループ（キーボード操縦 + HUD）
- PLATEAUデータ変換CLI（GeoJSON/CityJSON -> wireframe JSON）

## 地形変換
```bash
npm run convert:terrain -- \
  --input docs/data/sample_tokyo_plateau_feature_collection.json \
  --output public/terrain/sample_tokyo_wireframe.json
```

詳細: `docs/terrain_conversion.md`
