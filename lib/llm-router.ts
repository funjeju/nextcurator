// Phase 2: LLM 라우팅 준비 (Free/Pro 분기)
export type UserTier = 'free' | 'pro'

export function getLLMModel(tier: UserTier): string {
  if (tier === 'pro') return 'claude-sonnet-4-20250514'
  return 'claude-haiku-4-5-20251001'
}
