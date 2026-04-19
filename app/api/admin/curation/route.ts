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
    action: 'getSettings' | 'saveSettings' | 'listPosts' | 'publish' | 'delete'
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

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
