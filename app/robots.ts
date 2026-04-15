import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/square', '/result/'],
        disallow: ['/mypage', '/admin', '/api/', '/history', '/classroom'],
      },
    ],
    sitemap: 'https://ssoktube.com/sitemap.xml',
  }
}
