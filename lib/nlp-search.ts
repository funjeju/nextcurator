/**
 * 한국어 자연어 검색 유틸
 * - 조사/어미 제거 (형태소 단순화)
 * - 공백·특수문자 토큰화
 * - 2~3글자 n-gram 생성 (부분 매칭)
 * - 필드별 가중치 점수 계산
 */

// 자주 쓰이는 한국어 조사 / 접미사 (길이 내림차순 → 먼저 매칭)
const PARTICLES = [
  '에서의', '로부터', '에서는', '이라는', '라는', '이라고', '라고',
  '에서', '으로', '부터', '까지', '이랑', '한테', '에게', '께서',
  '이라', '이나', '이고', '이며', '이서',
  '에도', '으로도', '에만', '으로만',
  '를', '을', '이', '가', '은', '는', '의', '로', '와', '과', '도',
  '만', '나', '랑', '서', '고', '며',
]

/** 토큰 끝 조사 제거 */
function stripParticle(word: string): string {
  for (const p of PARTICLES) {
    if (word.endsWith(p) && word.length > p.length + 1) {
      return word.slice(0, word.length - p.length)
    }
  }
  return word
}

/** 텍스트 → 토큰 배열 (원형 + 조사 제거형 중복 제거) */
export function tokenize(text: string): string[] {
  const raw = text
    .toLowerCase()
    .split(/[\s,.\-_\/\[\]()\|·•·]+/)
    .map(t => t.trim())
    .filter(t => t.length >= 1)

  const result = new Set<string>()
  for (const t of raw) {
    result.add(t)
    const stripped = stripParticle(t)
    if (stripped !== t) result.add(stripped)
  }
  return [...result]
}

/** 문자열 → n-gram 배열 */
function ngrams(text: string, n: number): string[] {
  const out: string[] = []
  for (let i = 0; i <= text.length - n; i++) out.push(text.slice(i, i + n))
  return out
}

/** n-gram 기반 부분 매칭 점수 (0~1) */
function ngramSimilarity(query: string, target: string): number {
  if (!query || !target) return 0
  const n = Math.min(2, query.length)
  const qg = new Set(ngrams(query, n))
  const tg = new Set(ngrams(target, n))
  let hit = 0
  for (const g of qg) if (tg.has(g)) hit++
  return hit / qg.size
}

export interface SearchItem {
  id: string
  title: string
  category: string
  categoryLabel?: string
  tags?: string[]
  topicCluster?: string
  contextSummary?: string
}

/**
 * 자연어 검색 점수 계산
 * 반환값: 0 이상이면 관련있음 (높을수록 관련도 높음)
 */
export function scoreItem(item: SearchItem, tokens: string[]): number {
  let score = 0
  const title   = item.title.toLowerCase()
  const tags    = (item.tags ?? []).join(' ').toLowerCase()
  const cat     = (item.categoryLabel ?? item.category).toLowerCase()
  const context = (item.contextSummary ?? '').toLowerCase()
  const topic   = (item.topicCluster ?? '').toLowerCase()

  for (const token of tokens) {
    if (token.length < 1) continue

    // ── 완전 포함 매칭 ──
    if (title.includes(token))   score += token.length >= 2 ? 10 : 4
    if (tags.includes(token))    score += 6
    if (topic.includes(token))   score += 5
    if (cat.includes(token))     score += 4
    if (context.includes(token)) score += 3

    // ── n-gram 부분 매칭 (2글자 이상 토큰만) ──
    if (token.length >= 2) {
      const titleSim   = ngramSimilarity(token, title)
      const tagsSim    = ngramSimilarity(token, tags)
      const contextSim = ngramSimilarity(token, context)
      score += titleSim   * 5
      score += tagsSim    * 3
      score += contextSim * 1.5
    }
  }

  return score
}

/**
 * 검색 실행 — 점수 내림차순 정렬, 임계값 이상만 반환
 */
export function naturalSearch<T extends SearchItem>(
  items: T[],
  query: string,
  threshold = 3,
): T[] {
  if (!query.trim()) return items
  const tokens = tokenize(query)
  return items
    .map(item => ({ item, score: scoreItem(item, tokens) }))
    .filter(({ score }) => score >= threshold)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
}
