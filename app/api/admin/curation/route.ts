import { NextRequest, NextResponse } from 'next/server'
import { CurationSettings } from '@/lib/magazine'
import {
  getCurationSettings, saveCurationSettings,
  listCuratedPostsAdmin, publishCuratedPostAdmin,
} from '@/lib/magazine-server'
import { initAdminApp } from '@/lib/firebase-admin'
import { checkIsAdminByToken } from '@/lib/admin'

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return false
  return checkIsAdminByToken(auth.slice(7))
}

export async function POST(req: NextRequest) {
  const idToken = req.headers.get('authorization')?.replace('Bearer ', '')
  const isAdmin = await verifyAdmin(req)
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({})) as {
    action: 'getSettings' | 'saveSettings' | 'listPosts' | 'publish' | 'delete' | 'getLogs' | 'getPipelineSlots'
    settings?: Partial<CurationSettings>
    id?: string
  }

  try {
    switch (body.action) {
      case 'getSettings': {
        const settings = await getCurationSettings(idToken)
        return NextResponse.json(settings)
      }

      case 'saveSettings': {
        if (!body.settings) return NextResponse.json({ error: 'settings required' }, { status: 400 })
        await saveCurationSettings(body.settings, idToken)
        return NextResponse.json({ ok: true })
      }

      case 'listPosts': {
        const posts = await listCuratedPostsAdmin()
        return NextResponse.json(posts)
      }

      case 'publish': {
        if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
        await publishCuratedPostAdmin(body.id)
        return NextResponse.json({ ok: true })
      }

      case 'delete': {
        if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
        initAdminApp()
        const { getFirestore } = await import('firebase-admin/firestore')
        await getFirestore().collection('curated_posts').doc(body.id).delete()
        return NextResponse.json({ ok: true })
      }

      case 'getLogs': {
        initAdminApp()
        const { getFirestore: getFS2 } = await import('firebase-admin/firestore')
        const snap = await getFS2().collection('magazine_logs')
          .orderBy('createdAt', 'desc').limit(50).get()
        const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        return NextResponse.json(logs)
      }

      case 'getPipelineSlots': {
        initAdminApp()
        const { getFirestore: getFS3 } = await import('firebase-admin/firestore')
        const db = getFS3()
        const [newsSnap, toolsSnap, usecasesSnap, scoutNews, scoutTools, scoutUsecases] = await Promise.all([
          db.collection('ai_pipeline').doc('news_slot').get(),
          db.collection('ai_pipeline').doc('tools_slot').get(),
          db.collection('ai_pipeline').doc('usecases_slot').get(),
          db.collection('ai_scout_queue').doc('news').get(),
          db.collection('ai_scout_queue').doc('tools').get(),
          db.collection('ai_scout_queue').doc('usecases').get(),
        ])
        const toScoutInfo = (snap: any) => {
          if (!snap.exists) return null
          const d = snap.data()
          return {
            status: d.status,
            savedAt: d.savedAt,
            count: (d.items ?? []).length,
            titles: (d.items ?? []).slice(0, 3).map((i: any) => i.title?.slice(0, 50)),
          }
        }
        return NextResponse.json({
          news:     newsSnap.exists     ? newsSnap.data()     : null,
          tools:    toolsSnap.exists    ? toolsSnap.data()    : null,
          usecases: usecasesSnap.exists ? usecasesSnap.data() : null,
          scoutQueue: {
            news:     toScoutInfo(scoutNews),
            tools:    toScoutInfo(scoutTools),
            usecases: toScoutInfo(scoutUsecases),
          },
        })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
