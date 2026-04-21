import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SSOKTUBE — 유튜브 AI 요약',
    short_name: '쏙튜브',
    description: 'AI가 유튜브 영상을 자동 요약해 핵심만 저장',
    start_url: '/',
    display: 'standalone',
    background_color: '#1a1917',
    theme_color: '#1a1917',
    icons: [
      {
        src: '/favicon.ico',
        sizes: '48x48',
        type: 'image/x-icon',
      },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
    share_target: {
      action: '/share',
      method: 'GET',
      params: {
        url: 'url',
        text: 'text',
        title: 'title',
      },
    },
  }
}
