# 3Dフライトシミュレータ API設計書

## 1. 方針
- 初期リリースAPIは読み取り中心
- Route HandlerはController層として薄く保ち、バリデーションとModel呼び出しのみ実施

## 2. エンドポイント

## 2.1 `GET /api/terrain/manifest`
用途: 利用可能チャンク一覧の取得

Response 200:
```json
{
  "version": "2026-02-07",
  "city": "tokyo",
  "chunks": [
    {
      "chunkId": "tokyo_central_12_3456_7890",
      "lod": 2,
      "bbox": { "minX": 0, "minY": 0, "minZ": 0, "maxX": 0, "maxY": 0, "maxZ": 0 },
      "url": "/terrain/tokyo_central_12_3456_7890.json"
    }
  ]
}
```

Errors:
- 500 `E_MANIFEST_LOAD`

## 2.2 `GET /api/terrain/chunk/:chunkId`
用途: 単一チャンクの配信（必要ならCDN静的配信へ切替）

Path Params:
- `chunkId: string` (^[a-z0-9_]+$)

Response 200:
```json
{
  "chunkId": "tokyo_central_12_3456_7890",
  "lod": 2,
  "vertices": [0, 0, 0],
  "indices": [0, 1, 2],
  "edges": [[0, 1], [1, 2], [2, 0]]
}
```

Errors:
- 400 `E_INVALID_CHUNK_ID`
- 404 `E_CHUNK_NOT_FOUND`
- 500 `E_CHUNK_LOAD`

## 2.3 `POST /api/telemetry/error` (任意)
用途: クライアント障害ログ送信（匿名）

Request:
```json
{
  "code": "E_RENDER_INIT",
  "message": "webgl not available",
  "context": { "userAgent": "...", "build": "..." }
}
```

Response 202:
```json
{ "accepted": true }
```

Errors:
- 400 `E_INVALID_PAYLOAD`

## 3. バリデーション
- 全入力をzodで検証
- 不正入力は400で返却
- エラー本文はユーザー向け短文 + 機械可読コード

## 4. バージョニング
- 破壊的変更時は`/api/v2/...`を新設
