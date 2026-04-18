import { NextRequest, NextResponse } from 'next/server'
import {
  getAllPostsForAdmin, publishCuratedPost, deleteCuratedPost,
  CurationSettings,
} from '@/lib/magazine'
import { getCurationSettings, saveCurationSettings } from '@/lib/magazine-server'
import { checkIsAdminByToken } from '@/lib/admin'

async function verifyAdmin(req: NextRequest): Promise<boolean> {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return false
  return checkIsAdminByToken(auth.slice(7))
}

export async function POST(req: NextRequest) {
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
        const settings = await getCurationSettings()
        return NextResponse.json(settings)
      }

      case 'saveSettings': {
        if (!body.settings) return NextResponse.json({ error: 'settings required' }, { status: 400 })
        await saveCurationSettings(body.settings)
        return NextResponse.json({ ok: true })
      }

      case 'listPosts': {
        const posts = await getAllPostsForAdmin()
        return NextResponse.json(posts)
      }

      case 'publish': {
        if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
        await publishCuratedPost(body.id)
        return NextResponse.json({ ok: true })
      }

      case 'delete': {
        if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 })
        await deleteCuratedPost(body.id)
        return NextResponse.json({ ok: true })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
