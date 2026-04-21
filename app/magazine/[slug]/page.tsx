import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getPostBySlugAdmin, incrementPostViewAdmin, getRelatedPostsAdmin } from '@/lib/magazine-server'
import MagazinePostClient from './MagazinePostClient'

const TOPIC_META: Record<string, { label: string; url: string }> = {
  'ai-news':     { label: 'AI 소식',  url: '/magazine/topic/ai-news'     },
  'ai-tools':    { label: 'AI 도구',  url: '/magazine/topic/ai-tools'    },
  'ai-usecases': { label: 'AI 활용',  url: '/magazine/topic/ai-usecases' },
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostBySlugAdmin(slug)
  if (!post) return { title: 'SSOKTUBE AI 매거진' }

  const topicMeta = TOPIC_META[post.topicCluster]
  const aiKeywords = ['AI', 'AI 매거진', '인공지능', topicMeta?.label ?? 'AI 활용']

  return {
    title: `${post.title} | SSOKTUBE AI 매거진`,
    description: post.seoDescription,
    keywords: [...aiKeywords, ...post.seoKeywords, ...post.tags, 'SSOKTUBE'],
    alternates: { canonical: `https://ssoktube.com/magazine/${slug}` },
    openGraph: {
      title: post.title,
      description: post.seoDescription,
      type: 'article',
      url: `https://ssoktube.com/magazine/${slug}`,
      siteName: 'SSOKTUBE AI 매거진',
      publishedTime: post.publishedAt,
      section: topicMeta?.label,
      tags: post.tags,
      ...(post.heroThumbnail && !post.heroThumbnail.startsWith('data:') ? {
        images: [{ url: post.heroThumbnail, width: 1280, height: 720, alt: post.title }],
      } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: `${post.title} | SSOKTUBE AI 매거진`,
      description: post.seoDescription,
    },
  }
}

export default async function MagazinePage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const post = await getPostBySlugAdmin(slug)
  if (!post || post.status !== 'published') notFound()

  const relatedPosts = await getRelatedPostsAdmin(post.category, post.id).catch(() => [])

  const topicMeta = TOPIC_META[post.topicCluster]

  // JSON-LD: Article (with articleSection + about)
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.seoDescription,
    articleSection: topicMeta?.label ?? 'AI',
    about: post.seoKeywords.slice(0, 5).map(k => ({ '@type': 'Thing', name: k })),
    keywords: post.seoKeywords.join(', '),
    author: {
      '@type': 'Organization',
      name: 'SSOKTUBE AI 에디터',
      url: 'https://ssoktube.com',
    },
    publisher: {
      '@type': 'Organization',
      name: 'SSOKTUBE',
      url: 'https://ssoktube.com',
      logo: { '@type': 'ImageObject', url: 'https://ssoktube.com/icon.png' },
    },
    datePublished: post.publishedAt,
    dateModified: post.publishedAt,
    url: `https://ssoktube.com/magazine/${slug}`,
    isPartOf: {
      '@type': 'Blog',
      name: 'SSOKTUBE AI 매거진',
      url: 'https://ssoktube.com/magazine',
    },
    ...(post.heroThumbnail && !post.heroThumbnail.startsWith('data:')
      ? { image: { '@type': 'ImageObject', url: post.heroThumbnail, width: 1280, height: 720 } }
      : {}),
    mainEntity: post.videoTitles.length > 0 ? {
      '@type': 'ItemList',
      name: post.title,
      numberOfItems: post.videoTitles.length,
      itemListElement: post.videoTitles.map((title, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: title,
        url: `https://ssoktube.com/result/${post.summaryIds[i]}`,
      })),
    } : undefined,
  }

  // JSON-LD: BreadcrumbList
  const breadcrumbItems: { '@type': 'ListItem'; position: number; name: string; item: string }[] = [
    { '@type': 'ListItem', position: 1, name: '홈', item: 'https://ssoktube.com' },
    { '@type': 'ListItem', position: 2, name: 'AI 매거진', item: 'https://ssoktube.com/magazine' },
  ]
  if (topicMeta) {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 3,
      name: topicMeta.label,
      item: `https://ssoktube.com${topicMeta.url}`,
    })
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 4,
      name: post.title,
      item: `https://ssoktube.com/magazine/${slug}`,
    })
  } else {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 3,
      name: post.title,
      item: `https://ssoktube.com/magazine/${slug}`,
    })
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbItems,
  }

  // FAQ JSON-LD (if exists)
  const faqLd = post.faq && post.faq.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: post.faq.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: { '@type': 'Answer', text: item.answer },
    })),
  } : null

  incrementPostViewAdmin(post.id).catch(() => {})

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {faqLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      )}
      <MagazinePostClient post={post} relatedPosts={relatedPosts} />
    </>
  )
}
