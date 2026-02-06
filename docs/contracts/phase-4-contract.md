# Implementation Contract

## 1. Purpose (1-2 sentences)
品質保証とリリース体制を完成させ、再現性ある検証と安全なデプロイを可能にする。

## 2. Absolute Constraints
- MUST: Model層ユニットテストを実装すること
- MUST: API統合テストを実装すること
- MUST: 起動・飛行・衝突・再開を含むE2Eテストを実装すること
- MUST: Vercel本番デプロイ手順を文書化すること
- MUST NOT: 手動確認のみで完了判定しないこと
- Technical constraints: CIでtest/lint/buildを必須化

## 3. Prohibited Actions
- 失敗テストをskipで隠さない
- 本番専用手順を未文書のままにしない
- 環境依存設定をコードへ直書きしない

## 4. Future Extension Points (NOT NOW)
- 負荷試験の自動化
- エラー監視の外部SaaS連携
- ABテスト基盤

## 5. Implementation Notes
- テストは再現性を優先し乱数seedを固定すること
- E2Eは最短シナリオを安定実行できること
- テスト境界: WebGL非対応、API 500、アセット未配置
