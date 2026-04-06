import { NextResponse } from 'next/server'
import { classifyFolder } from '@/lib/claude'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { videoTitle, tags, existingFolders } = body

    if (!videoTitle || !Array.isArray(tags) || !Array.isArray(existingFolders)) {
      return NextResponse.json({ error: 'Invalid input parameters' }, { status: 400 })
    }

    const classification = await classifyFolder(videoTitle, tags, existingFolders)
    
    return NextResponse.json(classification)
  } catch (err: any) {
    console.error('Folder Classification Error:', err)
    return NextResponse.json({ error: 'Failed to classify folder' }, { status: 500 })
  }
}
