# PLATEAU地形変換 実行手順

## 1. 目的
`PLATEAU`由来データを、描画用ワイヤーフレームJSONへ変換する。

## 2. 実装
- スクリプト: `scripts/convert-plateau-to-wireframe.mjs`
- npm script: `npm run convert:terrain -- --input <input.json> --output <output.json> [--decimals 3]`

## 3. 実行例
```bash
npm run convert:terrain -- \
  --input docs/data/sample_tokyo_plateau_feature_collection.json \
  --output public/terrain/sample_tokyo_wireframe.json
```

## 4. 入力仕様
- GeoJSON FeatureCollection
- CityJSON

## 5. 出力仕様
```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-02-07T00:00:00.000Z",
  "vertexCount": 4,
  "edgeCount": 4,
  "vertices": [[0, 0, 0]],
  "edges": [[0, 1]]
}
```

## 6. 再現性保証
- 丸め桁を固定した場合、同一入力は同一頂点/辺構造を生成する。
- `generatedAt`はタイムスタンプのため値のみ変動する。
