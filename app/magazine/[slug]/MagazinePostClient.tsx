'use client'

import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import { useState, useEffect, useRef } from 'react'
import Header from '@/components/common/Header'
import { CuratedPost } from '@/lib/magazine'
import type { MagazineComment } from '@/app/api/magazine/comments/route'

const CATEGORY_LABEL: Record<string, string> = {
  recipe: '🍳 요리', english: '🔤 영어', learning: '📐 학습', news: '🗞️ 뉴스',
  selfdev: '💪 자기계발', travel: '🧳 여행', story: '🍿 스토리', tips: '💡 팁',
}

function formatDate(iso: string) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(iso))
}

function CommentsSection({ postId }: { postId: string }) {
  const [comments, setComments] = useState<MagazineComment[]>([])
  const [author, setAuthor] = useState('')
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [liked, setLiked] = useState<Set<string>>(new Set())
  const mounted = useRef(false)

  useEffect(() => {
    if (mounted.current) return
    mounted.current = true
    fetch(`/api/magazine/comments?postId=${postId}`)
      .then(r => r.json())
      .then(data => Array.isArray(data) && setComments(data))
      .catch(() => {})
  }, [postId])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/magazine/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, author: author.trim() || '익명', text: text.trim() }),
      })
      if (res.ok) {
        const { id } = await res.json()
        setComments(prev => [{
          id, postId, author: author.trim() || '익명', text: text.trim(),
          createdAt: new Date().toISOString(), likeCount: 0,
        }, ...prev])
        setText('')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function like(id: string) {
    if (liked.has(id)) return
    setLiked(prev => new Set([...prev, id]))
    setComments(prev => prev.map(c => c.id === id ? { ...c, likeCount: c.likeCount + 1 } : c))
    await fetch('/api/magazine/comments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    }).catch(() => {})
  }

  function formatDate(iso: string) {
    return new Intl.DateTimeFormat('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  }

  return (
    <section className="mt-14">
      <h2 className="text-base font-black text-white mb-5 flex items-center gap-2">
        <span className="w-1 h-4 rounded-full bg-orange-500" />
        댓글 {comments.length > 0 && <span className="text-orange-400">{comments.length}</span>}
      </h2>

      {/* 작성 폼 */}
      <form onSubmit={submit} className="mb-6 p-4 rounded-xl bg-[#2a2826] border border-white/8">
        <input
          type="text"
          placeholder="닉네임 (선택)"
          value={author}
          onChange={e => setAuthor(e.target.value)}
          maxLength={30}
          className="w-full bg-transparent text-xs text-white placeholder-[#4a4845] outline-none mb-3 border-b border-white/8 pb-2"
        />
        <textarea
          placeholder="댓글을 남겨주세요..."
          value={text}
          onChange={e => setText(e.target.value)}
          maxLength={500}
          rows={3}
          className="w-full bg-transparent text-sm text-white placeholder-[#4a4845] outline-none resize-none"
        />
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/8">
          <span className="text-[10px] text-[#4a4845]">{text.length}/500</span>
          <button
            type="submit"
            disabled={!text.trim() || submitting}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? '등록 중...' : '등록'}
          </button>
        </div>
      </form>

      {/* 댓글 목록 */}
      {comments.length === 0 ? (
        <p className="text-center text-xs text-[#4a4845] py-8">첫 번째 댓글을 남겨보세요!</p>
      ) : (
        <div className="space-y-3">
          {comments.map(c => (
            <div key={c.id} className="p-4 rounded-xl bg-[#2a2826] border border-white/6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-[#c4c0bc]">{c.author}</span>
                <span className="text-[10px] text-[#4a4845]">{formatDate(c.createdAt)}</span>
              </div>
              <p className="text-sm text-[#a4a09c] leading-relaxed whitespace-pre-wrap">{c.text}</p>
              <button
                onClick={() => like(c.id)}
                className={`mt-2 flex items-center gap-1 text-[10px] transition-colors ${liked.has(c.id) ? 'text-orange-400' : 'text-[#4a4845] hover:text-orange-400'}`}
              >
                ♥ {c.likeCount > 0 && c.likeCount}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function MagazinePostClient({ post }: { post: CuratedPost }) {
  return (
    <div className="min-h-screen bg-[#252423]">
      <Header />

      <article className="max-w-3xl mx-auto px-4 pb-20">

        {/* 브레드크럼 */}
        <nav className="flex items-center gap-2 text-xs text-[#75716e] mb-6">
          <Link href="/square" className="hover:text-orange-400 transition-colors">SQUARE K</Link>
          <span>/</span>
          <Link href="/magazine" className="hover:text-orange-400 transition-colors">매거진</Link>
        </nav>

        {/* 히어로 */}
        {post.heroThumbnail && !post.heroThumbnail.startsWith('data:') && (
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden mb-8 bg-[#1c1a18]">
            <img
              src={post.heroThumbnail}
              alt={post.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#252423]/80 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 text-white">
                ✍️ SSOKTUBE 매거진
              </span>
              {post.category && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-black/60 text-white border border-white/20">
                  {CATEGORY_LABEL[post.category] ?? post.category}
                </span>
              )}
            </div>
          </div>
        )}

        {/* 헤더 */}
        <header className="mb-10">
          {!post.heroThumbnail && (
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 text-white">
                ✍️ SSOKTUBE 매거진
              </span>
              {post.category && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#32302e] text-[#a4a09c] border border-white/10">
                  {CATEGORY_LABEL[post.category] ?? post.category}
                </span>
              )}
            </div>
          )}

          <h1 className="text-2xl md:text-3xl font-black text-white leading-tight mb-3">
            {post.title}
          </h1>
          {post.subtitle && (
            <p className="text-lg text-[#a4a09c] font-medium mb-4">{post.subtitle}</p>
          )}

          <div className="flex items-center gap-3 text-xs text-[#75716e]">
            <span>SSOKTUBE 에디터</span>
            <span>·</span>
            <span>{formatDate(post.publishedAt)}</span>
            <span>·</span>
            <span>읽는 시간 {post.readTime}분</span>
            {post.viewCount > 0 && (
              <>
                <span>·</span>
                <span>👁 {post.viewCount}</span>
              </>
            )}
          </div>

          {/* 태그 */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-4">
              {post.tags.slice(0, 8).map(tag => (
                <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] bg-[#32302e] text-[#a4a09c] border border-white/8">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </header>

        {/* 본문 — 마크다운 렌더링 */}
        <div className="space-y-1">
          <ReactMarkdown
            components={{
              h2: ({ children }) => (
                <h2 className="text-xl font-black text-white mt-10 mb-4 pb-2 border-b border-white/10">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-base font-black text-orange-400 mt-6 mb-2">{children}</h3>
              ),
              h4: ({ children }) => (
                <h4 className="text-sm font-bold text-[#c4c0bc] mt-4 mb-1">{children}</h4>
              ),
              p: ({ children }) => (
                <p className="text-[#c4c0bc] leading-relaxed my-3 text-sm md:text-base">{children}</p>
              ),
              strong: ({ children }) => (
                <strong className="text-white font-bold">{children}</strong>
              ),
              em: ({ children }) => (
                <em className="text-[#a4a09c] italic">{children}</em>
              ),
              ul: ({ children }) => (
                <ul className="my-3 pl-5 space-y-1 list-disc marker:text-orange-500">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="my-3 pl-5 space-y-1 list-decimal marker:text-orange-500">{children}</ol>
              ),
              li: ({ children }) => (
                <li className="text-[#c4c0bc] text-sm md:text-base leading-relaxed">{children}</li>
              ),
              blockquote: ({ children }) => (
                <blockquote className="my-4 pl-4 border-l-4 border-orange-500 bg-[#2a2826] rounded-r-lg py-3 pr-3 text-[#a4a09c] italic">
                  {children}
                </blockquote>
              ),
              code: ({ children, className }) => {
                const isBlock = className?.includes('language-')
                return isBlock
                  ? <code className="block bg-[#1c1a18] text-orange-300 text-xs p-3 rounded-lg my-3 overflow-x-auto">{children}</code>
                  : <code className="bg-[#1c1a18] text-orange-300 text-xs px-1.5 py-0.5 rounded">{children}</code>
              },
              hr: () => <hr className="my-8 border-white/10" />,
              a: ({ href, children }) => (
                <a href={href} className="text-orange-400 hover:text-orange-300 underline underline-offset-2" target="_blank" rel="noopener noreferrer">{children}</a>
              ),
            }}
          >
            {post.body}
          </ReactMarkdown>
        </div>

        {/* 포함된 영상 목록 */}
        <section className="mt-14">
          <h2 className="text-base font-black text-white mb-4 flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-orange-500" />
            이 포스트에 포함된 영상 ({post.videoTitles.length}개)
          </h2>
          <div className="space-y-2">
            {post.videoTitles.map((title, i) => (
              <Link
                key={post.summaryIds[i]}
                href={`/result/${post.summaryIds[i]}`}
                className="flex items-center gap-3 p-3 rounded-xl bg-[#2a2826] border border-white/6 hover:border-orange-500/30 hover:bg-[#32302e] transition-all group"
              >
                <span className="shrink-0 w-5 h-5 rounded-full bg-orange-500/20 flex items-center justify-center text-[10px] font-black text-orange-400">
                  {i + 1}
                </span>
                <span className="text-sm text-[#c4c0bc] group-hover:text-white transition-colors line-clamp-1">
                  {title}
                </span>
                <svg className="shrink-0 ml-auto w-3.5 h-3.5 text-[#75716e] group-hover:text-orange-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </section>

        {/* 댓글 */}
        <CommentsSection postId={post.id} />

        {/* 하단 CTA */}
        <div className="mt-12 p-6 rounded-2xl bg-gradient-to-br from-orange-500/10 to-amber-500/5 border border-orange-500/20 text-center">
          <p className="text-white font-bold mb-1">더 많은 큐레이션이 궁금하다면?</p>
          <p className="text-[#a4a09c] text-sm mb-4">SQUARE K에서 다른 사람들의 요약을 둘러보세요.</p>
          <Link
            href="/square"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors"
          >
            SQUARE K 둘러보기 →
          </Link>
        </div>

      </article>
    </div>
  )
}
