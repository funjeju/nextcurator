/**
 * 제주 스팟 스마트 선택 엔진
 *
 * 동작 흐름:
 * 1. 사용자 찜 스팟의 지역 감지
 * 2. 지역 간 이동 코리더(경로상 지역) 자동 계산
 * 3. 코리더 지역 Firestore 쿼리 (병렬)
 * 4. 좌표 기반 K-means 클러스터링으로 일수별 배분
 * 5. 품질 스코어 + 동선 근접성으로 최종 선발
 */

import { getFirestore } from 'firebase-admin/firestore'

export interface JejuSpot {
  place_id: string
  place_name: string
  categories: string[]
  categories_kr: string[]
  address: string
  region: string
  lat: number
  lng: number
  thumbnail: string
  description: string
  tags: string[]
  withKids: string
  withPets: string
  score: number
  isFromDB?: boolean
}

// ── 제주 지역 지리 그래프 (인접 지역 관계) ──────────────────────────
const REGION_GRAPH: Record<string, string[]> = {
  '제주시 동(洞) 지역':  ['애월읍', '조천읍'],
  '애월읍':             ['제주시 동(洞) 지역', '한림읍'],
  '한림읍':             ['애월읍', '한경면', '안덕면'],
  '한경면':             ['한림읍', '대정읍'],
  '대정읍':             ['한경면', '안덕면'],
  '안덕면':             ['대정읍', '한림읍', '서귀포시 동(洞) 지역'],
  '서귀포시 동(洞) 지역':['안덕면', '남원읍'],
  '남원읍':             ['서귀포시 동(洞) 지역', '성산읍', '구좌읍'],
  '성산읍':             ['남원읍', '구좌읍'],
  '구좌읍':             ['성산읍', '남원읍', '조천읍'],
  '조천읍':             ['구좌읍', '제주시 동(洞) 지역'],
}

// 공항은 제주시 동(洞) 지역에 포함
const AIRPORT_REGION = '제주시 동(洞) 지역'

// BFS로 두 지역 간 최단 경로 찾기
function findRegionPath(from: string, to: string): string[] {
  if (from === to) return [from]
  const visited = new Set<string>()
  const queue: { region: string; path: string[] }[] = [{ region: from, path: [from] }]
  while (queue.length > 0) {
    const { region, path } = queue.shift()!
    if (visited.has(region)) continue
    visited.add(region)
    for (const neighbor of (REGION_GRAPH[region] || [])) {
      const newPath = [...path, neighbor]
      if (neighbor === to) return newPath
      queue.push({ region: neighbor, path: newPath })
    }
  }
  return [from, to]
}

// 찜 스팟에서 통과할 전체 코리더 지역 계산
function getCorridorRegions(wishlistRegions: string[]): string[] {
  const regions = new Set<string>()
  // 공항 → 첫 스팟 → ... → 마지막 스팟 → 공항 경로
  const waypoints = [AIRPORT_REGION, ...wishlistRegions, AIRPORT_REGION]
  for (let i = 0; i < waypoints.length - 1; i++) {
    const path = findRegionPath(waypoints[i], waypoints[i + 1])
    path.forEach(r => regions.add(r))
  }
  return Array.from(regions)
}

// ── 좌표 기반 K-means 클러스터링 ──────────────────────────────────
function kmeansClusters(spots: JejuSpot[], k: number): JejuSpot[][] {
  if (spots.length === 0 || k <= 0) return []
  k = Math.min(k, spots.length)

  // 초기 중심: 경도 기준 정렬 후 균등 배분 (제주는 동서 이동이 주)
  const sorted = [...spots].sort((a, b) => a.lng - b.lng)
  let centroids = Array.from({ length: k }, (_, i) =>
    sorted[Math.floor(i * sorted.length / k)]
  )

  let clusters: JejuSpot[][] = []
  for (let iter = 0; iter < 10; iter++) {
    clusters = Array.from({ length: k }, () => [] as JejuSpot[])
    // 각 스팟을 가장 가까운 중심에 배정
    spots.forEach(spot => {
      let bestIdx = 0
      let bestDist = Infinity
      centroids.forEach((c, ci) => {
        const d = Math.hypot(spot.lat - c.lat, spot.lng - c.lng)
        if (d < bestDist) { bestDist = d; bestIdx = ci }
      })
      clusters[bestIdx].push(spot)
    })
    // 중심 재계산
    centroids = clusters.map(cluster => {
      if (cluster.length === 0) return centroids[0]
      return {
        lat: cluster.reduce((s, sp) => s + sp.lat, 0) / cluster.length,
        lng: cluster.reduce((s, sp) => s + sp.lng, 0) / cluster.length,
      } as JejuSpot
    })
  }
  return clusters
}

// ── Firestore 쿼리 ──────────────────────────────────────────────
export async function queryJejuSpots({
  corridorRegions,
  excludePlaceIds = [],
  withKids = false,
  withPets = false,
  categories,
}: {
  corridorRegions: string[]
  excludePlaceIds?: string[]
  withKids?: boolean
  withPets?: boolean
  categories?: string[]
}): Promise<JejuSpot[]> {
  const db = getFirestore()
  const excludeSet = new Set(excludePlaceIds)

  // 지역별 병렬 쿼리
  const queries = corridorRegions.map(async region => {
    let q = db.collection('jeju_spots')
      .where('region', '==', region)
      .where('score', '>=', 5)          // 품질 하한선
      .orderBy('score', 'desc')
      .limit(40)                         // 지역당 최대 40개

    const snap = await q.get()
    return snap.docs.map(d => d.data() as JejuSpot)
  })

  const results = await Promise.all(queries)
  let spots = results.flat()

  // 중복 제거 + 찜 목록 제외
  const seen = new Set<string>()
  spots = spots.filter(s => {
    if (excludeSet.has(s.place_id)) return false
    if (seen.has(s.place_id)) return false
    seen.add(s.place_id)
    return true
  })

  // 옵션 필터
  if (withKids) spots = spots.filter(s => s.withKids !== '불가')
  if (withPets) spots = spots.filter(s => s.withPets !== '불가')

  // 카테고리 필터 (지정된 경우)
  if (categories && categories.length > 0) {
    spots = spots.filter(s => s.categories.some(c => categories.includes(c)))
  }

  // 숙소는 기본 제외 (일정 스팟에서 제외, 숙소 추천은 AI가 텍스트로)
  spots = spots.filter(s => !s.categories.includes('Accommodation'))

  return spots
}

// ── 메인: 일정용 스팟 선발 ────────────────────────────────────────
export interface SpotSelectionResult {
  spotsByDay: JejuSpot[][]   // [day1spots, day2spots, ...]
  totalSelected: number
  corridorRegions: string[]
}

export async function selectSpotsForItinerary({
  wishlistSpots,
  numDays,
  withKids = false,
  withPets = false,
}: {
  wishlistSpots: { place_id?: string; name: string; address?: string; region?: string; lat?: number; lng?: number }[]
  numDays: number
  withKids?: boolean
  withPets?: boolean
}): Promise<SpotSelectionResult> {

  // 1. 찜 스팟 지역 감지
  const wishlistRegions = [...new Set(
    wishlistSpots
      .map(s => s.region || detectRegionFromAddress(s.address || ''))
      .filter(Boolean) as string[]
  )]

  // 2. 코리더 지역 계산
  const corridorRegions = wishlistRegions.length > 0
    ? getCorridorRegions(wishlistRegions)
    : Object.keys(REGION_GRAPH)  // 지역 모름 → 전체

  // 3. Firestore 병렬 쿼리
  const dbSpots = await queryJejuSpots({
    corridorRegions,
    excludePlaceIds: wishlistSpots.map(s => s.place_id || '').filter(Boolean),
    withKids,
    withPets,
  })

  // 4. 하루당 적정 DB 스팟 수 계산 (찜 스팟 제외 나머지 슬롯 채우기)
  const spotsPerDay = 12
  const wishlistPerDay = Math.ceil(wishlistSpots.length / numDays)
  const dbSpotsPerDay = Math.max(spotsPerDay - wishlistPerDay, 4)
  const totalDbSpots = dbSpotsPerDay * numDays

  // 5. 스코어 정렬 후 상위 N개 선발
  const topDbSpots = dbSpots
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, Math.min(totalDbSpots, 80))
    .map(s => ({ ...s, isFromDB: true }))

  // 6. K-means 클러스터링으로 일수별 배분
  const clusters = kmeansClusters(topDbSpots, numDays)

  // 7. 찜 스팟도 지리적으로 클러스터에 배정
  const wishlistFull = wishlistSpots.map(s => ({
    place_id: s.place_id || '',
    place_name: s.name,
    address: s.address || '',
    region: s.region || detectRegionFromAddress(s.address || ''),
    lat: s.lat || 0,
    lng: s.lng || 0,
    categories: [],
    categories_kr: [],
    thumbnail: '',
    description: '',
    tags: [],
    withKids: '',
    withPets: '',
    score: 10,   // 찜 스팟은 최우선
    isFromDB: false,
  } as JejuSpot))

  wishlistFull.forEach(ws => {
    if (ws.lat === 0) { clusters[0]?.unshift(ws); return }
    let bestCluster = 0
    let bestDist = Infinity
    clusters.forEach((cluster, ci) => {
      if (cluster.length === 0) return
      const cx = cluster.reduce((s, sp) => s + sp.lat, 0) / cluster.length
      const cy = cluster.reduce((s, sp) => s + sp.lng, 0) / cluster.length
      const d = Math.hypot(ws.lat - cx, ws.lng - cy)
      if (d < bestDist) { bestDist = d; bestCluster = ci }
    })
    clusters[bestCluster] = [ws, ...clusters[bestCluster]]
  })

  // 8. 각 클러스터에서 일수별 최종 슬롯 수 맞추기
  const spotsByDay = clusters.map(cluster =>
    cluster.slice(0, spotsPerDay)
  )

  return {
    spotsByDay,
    totalSelected: spotsByDay.reduce((s, d) => s + d.length, 0),
    corridorRegions,
  }
}

// 주소에서 지역 추출 (fallback)
function detectRegionFromAddress(address: string): string {
  const regionMap: [string, string][] = [
    ['성산읍', '성산읍'], ['구좌읍', '구좌읍'], ['조천읍', '조천읍'],
    ['애월읍', '애월읍'], ['한림읍', '한림읍'], ['한경면', '한경면'],
    ['대정읍', '대정읍'], ['안덕면', '안덕면'], ['남원읍', '남원읍'],
    ['서귀포시', '서귀포시 동(洞) 지역'],
    ['제주시', '제주시 동(洞) 지역'],
  ]
  for (const [keyword, region] of regionMap) {
    if (address.includes(keyword)) return region
  }
  return ''
}
