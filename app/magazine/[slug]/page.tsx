import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPostBySlug, incrementPostView } from '@/lib/magazine'
import MagazinePostClient from './MagazinePostClient'

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post) return { title: 'SSOKTUBE 매거진' }

  return {
    title: post.title,
    description: post.seoDescription,
    keywords: [...post.seoKeywords, ...post.tags, 'SSOKTUBE', '유튜브 큐레이션'],
    alternates: { canonical: `https://ssoktube.com/magazine/${slug}` },
    openGraph: {
      title: post.title,
      description: post.seoDescription,
      type: 'article',
      url: `https://ssoktube.com/magazine/${slug}`,
      siteName: 'SSOKTUBE',
      publishedTime: post.publishedAt,
      ...(post.heroThumbnail && !post.heroThumbnail.startsWith('data:') ? {
        images: [{ url: post.heroThumbnail, width: 1280, height: 720, alt: post.title }],
      } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.seoDescription,
    },
  }
}

export default async function MagazinePage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  if (!post || post.status !== 'published') notFound()

  // JSON-LD: Article + ItemList for included videos
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.seoDescription,
    author: { '@type': 'Organization', name: 'SSOKTUBE 에디터', url: 'https://ssoktube.com' },
    publisher: {
      '@type': 'Organization',
      name: 'SSOKTUBE',
      url: 'https://ssoktube.com',
      logo: { '@type': 'ImageObject', url: 'https://ssoktube.com/icon.png' },
    },
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    url: `https://ssoktube.com/magazine/${slug}`,
    keywords: post.seoKeywords.join(', '),
    ...(post.heroThumbnail && !post.heroThumbnail.startsWith('data:')
      ? { image: post.heroThumbnail }
      : {}),
    mainEntity: {
      '@type': 'ItemList',
      name: post.title,
      numberOfItems: post.videoTitles.length,
      itemListElement: post.videoTitles.map((title, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: title,
        url: `https://ssoktube.com/result/${post.summaryIds[i]}`,
      })),
    },
  }

  // Async view increment (fire-and-forget, don't block render)
  incrementPostView(post.id).catch(() => {})

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MagazinePostClient post={post} />
    </>
  )
}
