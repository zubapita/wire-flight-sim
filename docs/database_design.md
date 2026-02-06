# 3Dフライトシミュレータ データベース設計書

## 1. 方針
本プロジェクトの永続化はクライアント中心とする。サーバーDBはPhase 1では使用しない。

## 2. 永続化レイヤ
- `localStorage`: 軽量設定値
- `IndexedDB`: 地形チャンクキャッシュ、フライトリプレイ

## 3. localStorage設計
### Key: `fsim.settings.v1`
```json
{
  "controlSensitivity": 1,
  "invertPitch": false,
  "wireDensity": "medium",
  "keymap": {
    "pitchUp": "ArrowUp",
    "pitchDown": "ArrowDown",
    "rollLeft": "KeyA",
    "rollRight": "KeyD",
    "yawLeft": "KeyQ",
    "yawRight": "KeyE",
    "throttleUp": "KeyW",
    "throttleDown": "KeyS",
    "pause": "Escape"
  }
}
```

## 4. IndexedDB設計
### DB名
- `fsim_db`
- version: `1`

### Store: `terrain_chunks`
- keyPath: `chunkId`
- fields:
  - `chunkId: string`
  - `lod: number`
  - `vertices: Float32Array(serialize)`
  - `indices: Uint32Array(serialize)`
  - `bbox: { minX, minY, minZ, maxX, maxY, maxZ }`
  - `updatedAt: number`
- index:
  - `updatedAt`

### Store: `flight_replays`
- keyPath: `replayId`
- fields:
  - `replayId: string`
  - `createdAt: number`
  - `durationSec: number`
  - `samples: Array<{ t, x, y, z, pitch, roll, yaw, throttle }>`

## 5. バリデーション
- localStorage復元時にzodで検証
- 不正値は破棄してデフォルトへフォールバック
- IndexedDB読み出し失敗時はキャッシュ無効として再取得

## 6. データライフサイクル
- 地形チャンクはLRU方針で上限200MBまで
- 上限超過時は`updatedAt`の古い順で削除
- リプレイはユーザー手動削除を基本とする

## 7. 将来拡張
- サーバー側ランキング導入時は`Vercel Postgres`追加
- その場合は`pilot_profiles`/`flight_scores`を新設
