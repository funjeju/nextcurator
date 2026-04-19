export type PlanId = 'guest' | 'free' | 'pro1' | 'pro2' | 'pro3' | 'teacher'

export interface PlanLimits {
  dailySummary: number       // 일 요약 제한 (-1 = 무제한)
  monthlySummary: number     // 월 요약 제한 (-1 = 무제한)
  maxFolders: number         // 폴더 생성 제한 (-1 = 무제한)
  canSave: boolean
  canPdf: boolean
  canBlog: boolean
  canAiSchedule: boolean
  canTeacher: boolean
}

export const PLANS: Record<PlanId, PlanLimits> = {
  guest:   { dailySummary: 3,  monthlySummary: -1,  maxFolders: 0,  canSave: false, canPdf: false, canBlog: false, canAiSchedule: false, canTeacher: false },
  free:    { dailySummary: 3,  monthlySummary: 10,  maxFolders: 3,  canSave: true,  canPdf: false, canBlog: false, canAiSchedule: false, canTeacher: false },
  pro1:    { dailySummary: 5,  monthlySummary: 30,  maxFolders: 10, canSave: true,  canPdf: true,  canBlog: false, canAiSchedule: false, canTeacher: false },
  pro2:    { dailySummary: 10, monthlySummary: 50,  maxFolders: 30, canSave: true,  canPdf: true,  canBlog: true,  canAiSchedule: true,  canTeacher: false },
  pro3:    { dailySummary: 20, monthlySummary: 150, maxFolders: -1, canSave: true,  canPdf: true,  canBlog: true,  canAiSchedule: true,  canTeacher: false },
  teacher: { dailySummary: -1, monthlySummary: -1,  maxFolders: -1, canSave: true,  canPdf: true,  canBlog: true,  canAiSchedule: true,  canTeacher: true  },
}

// 요금제 ON/OFF — OFF면 모든 유저 무제한
export function isPricingEnabled(): boolean {
  return process.env.PRICING_ENABLED === 'true'
}

export function getLimits(planId: PlanId): PlanLimits {
  if (!isPricingEnabled()) {
    return { dailySummary: -1, monthlySummary: -1, maxFolders: -1, canSave: true, canPdf: true, canBlog: true, canAiSchedule: true, canTeacher: true }
  }
  return PLANS[planId] ?? PLANS.free
}

export function canSummarize(planId: PlanId, dailyCount: number, monthlyCount: number): { allowed: boolean; reason?: string } {
  const limits = getLimits(planId)
  if (limits.dailySummary !== -1 && dailyCount >= limits.dailySummary) {
    return { allowed: false, reason: `일일 요약 한도(${limits.dailySummary}회)를 초과했습니다.` }
  }
  if (limits.monthlySummary !== -1 && monthlyCount >= limits.monthlySummary) {
    return { allowed: false, reason: `월간 요약 한도(${limits.monthlySummary}회)를 초과했습니다.` }
  }
  return { allowed: true }
}

export function canCreateFolder(planId: PlanId, currentFolderCount: number): { allowed: boolean; reason?: string } {
  const limits = getLimits(planId)
  if (limits.maxFolders !== -1 && currentFolderCount >= limits.maxFolders) {
    return { allowed: false, reason: `폴더는 최대 ${limits.maxFolders}개까지 만들 수 있습니다.` }
  }
  return { allowed: true }
}
