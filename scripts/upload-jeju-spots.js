/**
 * 제주 스팟 데이터 → Firestore jeju_spots 컬렉션 업로드
 * 실행: node scripts/upload-jeju-spots.js
 */
const admin = require('firebase-admin')
const fs = require('fs')
const path = require('path')

const serviceAccount = require('../nxtcu-657ab-firebase-adminsdk-fbsvc-1768cb458a.json')

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})
const db = admin.firestore()

function scoreSpot(spot) {
  let score = 0
  if (spot.address) score += 2
  if (spot.location?.latitude) score += 2
  if (spot.images?.length > 0) score += 1
  if (spot.description || spot.expert_tip_raw) score += 1
  if ((spot.tags || []).length > 3) score += 1
  const premium = ['Attraction', 'Beach', 'Cafe', 'Activity', 'Mountain', 'PhotoSpot', 'Forest', 'Waterfall', 'Sunset']
  if ((spot.categories || []).some(c => premium.includes(c))) score += 2
  return score
}

async function upload() {
  const raw = JSON.parse(fs.readFileSync(
    path.join(__dirname, '../k-lokal_filtered-spots_2026-04-16.json'), 'utf8'
  ))

  // 주소+좌표+이미지 없는 항목 필터링 (품질 최하위 제외)
  const spots = raw.filter(s => s.address && s.location?.latitude && s.images?.length > 0)
  console.log(`전체: ${raw.length}개 → 품질 필터 후: ${spots.length}개 업로드`)

  const BATCH_SIZE = 400
  let uploaded = 0

  for (let i = 0; i < spots.length; i += BATCH_SIZE) {
    const batch = db.batch()
    const chunk = spots.slice(i, i + BATCH_SIZE)

    chunk.forEach(spot => {
      const doc = db.collection('jeju_spots').doc(spot.place_id)
      batch.set(doc, {
        place_id:      spot.place_id,
        place_name:    spot.place_name,
        categories:    spot.categories || [],
        categories_kr: spot.categories_kr || [],
        address:       spot.address || '',
        region:        spot.region || '',
        lat:           spot.location.latitude,
        lng:           spot.location.longitude,
        thumbnail:     spot.images?.[0]?.url || '',
        description:   spot.description || spot.expert_tip_raw || '',
        tags:          (spot.tags || []).slice(0, 8),
        withKids:      spot.attributes?.withKids || '',
        withPets:      spot.attributes?.withPets || '',
        phone:         spot.public_info?.phone_number || '',
        website:       spot.public_info?.website_url || '',
        score:         scoreSpot(spot),
        uploadedAt:    admin.firestore.FieldValue.serverTimestamp(),
      })
    })

    await batch.commit()
    uploaded += chunk.length
    console.log(`  업로드: ${uploaded}/${spots.length}`)
  }

  console.log(`✅ 완료: ${uploaded}개 업로드`)
  process.exit(0)
}

upload().catch(e => { console.error(e); process.exit(1) })
