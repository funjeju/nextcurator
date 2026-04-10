import { SummarizeResponse } from '@/types/summary'
import {
  RecipeSummary, EnglishSummary, LearningSummary,
  NewsSummary, SelfDevSummary, TravelSummary, StorySummary,
} from '@/types/summary'

interface Props {
  data: SummarizeResponse
  qrDataUrl?: string
}

const CATEGORY_META: Record<string, { label: string; icon: string; color: string; bg: string; border: string }> = {
  recipe:  { label: '요리',    icon: '🍳', color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
  english: { label: '영어학습', icon: '🔤', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  learning:{ label: '학습',    icon: '📐', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
  news:    { label: '뉴스',    icon: '🗞️', color: '#374151', bg: '#f9fafb', border: '#e5e7eb' },
  selfdev: { label: '자기계발', icon: '💪', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
  travel:  { label: '여행',    icon: '🧳', color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
  story:   { label: '스토리',  icon: '🍿', color: '#db2777', bg: '#fdf2f8', border: '#f9a8d4' },
}

// ─── 섹션 헤더 ───
function SectionHeader({ title, color, bg, border }: { title: string; color: string; bg: string; border: string }) {
  return (
    <div style={{
      background: bg,
      borderLeft: `4px solid ${color}`,
      borderRadius: '0 8px 8px 0',
      padding: '8px 14px',
      marginBottom: 12,
      marginTop: 0,
    }}>
      <h3 style={{ fontSize: 13, fontWeight: 700, color, margin: 0 }}>{title}</h3>
    </div>
  )
}

// ─── 보고서형 마크다운 렌더러 ───
function ReportSection({ markdown, color, bg, border }: { markdown: string; color: string; bg: string; border: string }) {
  const lines = markdown.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) { key++; continue }

    if (trimmed.startsWith('## ')) {
      const title = trimmed.replace(/^## /, '')
      elements.push(
        <div key={key++} style={{ marginTop: elements.length === 0 ? 0 : 20 }}>
          <SectionHeader title={title} color={color} bg={bg} border={border} />
        </div>
      )
    } else if (trimmed.startsWith('**') && trimmed.endsWith('**') && !trimmed.slice(2, -2).includes('**')) {
      elements.push(
        <p key={key++} style={{ fontSize: 12, fontWeight: 700, color: '#1f2937', margin: '6px 0 3px' }}>
          {trimmed.slice(2, -2)}
        </p>
      )
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
      elements.push(
        <div key={key++} style={{ display: 'flex', gap: 6, marginBottom: 4, paddingLeft: 4 }}>
          <span style={{ color, fontWeight: 700, flexShrink: 0 }}>•</span>
          <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.65 }}>
            {trimmed.replace(/^[-•] /, '')}
          </p>
        </div>
      )
    } else {
      // 인라인 bold (**text**) 처리
      const parts = trimmed.split(/(\*\*[^*]+\*\*)/)
      elements.push(
        <p key={key++} style={{ fontSize: 12, color: '#374151', margin: '0 0 6px', lineHeight: 1.75 }}>
          {parts.map((part, i) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={i} style={{ color: '#111827' }}>{part.slice(2, -2)}</strong>
              : part
          )}
        </p>
      )
    }
  }

  return <div>{elements}</div>
}

// ─────────────────────────────────────────
// 카테고리별 구조화 요약 (축약형)
// ─────────────────────────────────────────

function RecipeContent({ data, color, bg, border }: { data: RecipeSummary; color: string; bg: string; border: string }) {
  const groups = data.ingredient_groups ?? (data.ingredients ? [{ group: '재료', items: data.ingredients }] : [])
  return (
    <>
      <div style={{ marginBottom: 20 }}>
        <SectionHeader title="재료" color={color} bg={bg} border={border} />
        <div style={{ display: 'grid', gridTemplateColumns: groups.length > 1 ? '1fr 1fr' : '1fr', gap: 10 }}>
          {groups.map((grp, gi) => (
            <div key={gi} style={{ background: '#f9fafb', borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
              {groups.length > 1 && (
                <div style={{ background: '#e5e7eb', padding: '4px 10px', fontSize: 10, fontWeight: 700, color: '#374151' }}>{grp.group}</div>
              )}
              <div style={{ padding: '8px 10px' }}>
                {grp.items.map((ing, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0', borderBottom: i < grp.items.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <span style={{ color: '#1f2937' }}>{ing.name}</span>
                    <span style={{ color: '#6b7280' }}>{ing.amount}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginBottom: 20 }}>
        <SectionHeader title="만드는 법" color={color} bg={bg} border={border} />
        {data.steps.map(step => (
          <div key={step.step} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 8 }}>
            <span style={{ width: 22, height: 22, borderRadius: '50%', background: color, color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{step.step}</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, color: '#1f2937', margin: 0, lineHeight: 1.6 }}>{step.desc}</p>
              {step.tip && <p style={{ fontSize: 11, color: '#059669', margin: '3px 0 0' }}>💡 {step.tip}</p>}
            </div>
          </div>
        ))}
      </div>
      {data.key_tips.length > 0 && (
        <div>
          <SectionHeader title="💡 핵심 팁" color={color} bg={bg} border={border} />
          {data.key_tips.map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <span style={{ color, fontWeight: 700 }}>•</span>
              <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.6 }}>{tip}</p>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function StructuredContent({ data, category, color, bg, border }: { data: any; category: string; color: string; bg: string; border: string }) {
  if (category === 'recipe') return <RecipeContent data={data as RecipeSummary} color={color} bg={bg} border={border} />

  if (category === 'english') {
    const d = data as EnglishSummary
    return (
      <>
        {d.expressions.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <SectionHeader title="핵심 표현" color={color} bg={bg} border={border} />
            {d.expressions.map((e, i) => (
              <div key={i} style={{ background: bg, borderRadius: 8, padding: '8px 12px', marginBottom: 8, borderLeft: `3px solid ${color}` }}>
                <p style={{ fontSize: 13, fontWeight: 700, color, margin: '0 0 3px' }}>{e.text}</p>
                <p style={{ fontSize: 12, color: '#374151', margin: '0 0 2px' }}>{e.meaning}</p>
                {e.note && <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>{e.note}</p>}
              </div>
            ))}
          </div>
        )}
        {d.vocabulary.length > 0 && (
          <div>
            <SectionHeader title="주요 단어" color={color} bg={bg} border={border} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {d.vocabulary.map((v, i) => (
                <div key={i} style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 10px', border: '1px solid #e5e7eb' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color }}>{v.word}</div>
                  <div style={{ fontSize: 10, color: '#6b7280' }}>{v.pronunciation}</div>
                  <div style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>{v.meaning}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    )
  }

  if (category === 'learning') {
    const d = data as LearningSummary
    return (
      <>
        <div style={{ marginBottom: 20 }}>
          <SectionHeader title="핵심 개념" color={color} bg={bg} border={border} />
          {d.concepts.map((c, i) => (
            <div key={i} style={{ marginBottom: 10, paddingLeft: 10, borderLeft: `3px solid ${color}` }}>
              <p style={{ fontSize: 13, fontWeight: 700, color, margin: '0 0 3px' }}>{c.name}</p>
              <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.6 }}>{c.desc}</p>
            </div>
          ))}
        </div>
        <div>
          <SectionHeader title="핵심 포인트" color={color} bg={bg} border={border} />
          {d.key_points.map((kp, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <span style={{ color, fontWeight: 700 }}>✓</span>
              <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.6 }}>{kp.point}</p>
            </div>
          ))}
        </div>
      </>
    )
  }

  if (category === 'news') {
    const d = data as NewsSummary
    const w = d.five_w
    return (
      <>
        <div style={{ background: '#f9fafb', borderRadius: 10, padding: '12px 14px', marginBottom: 20, border: `1px solid ${border}`, borderLeft: `4px solid ${color}` }}>
          <p style={{ fontSize: 13, color: '#1f2937', margin: 0, lineHeight: 1.7 }}>{d.three_line_summary}</p>
        </div>
        <div style={{ marginBottom: 20 }}>
          <SectionHeader title="육하원칙" color={color} bg={bg} border={border} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[{label:'누가',value:w.who},{label:'언제',value:w.when},{label:'어디서',value:w.where},{label:'무엇을',value:w.what},{label:'어떻게',value:w.how},{label:'왜',value:w.why}].map(item => (
              <div key={item.label} style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 10px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, marginBottom: 2 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: '#1f2937', lineHeight: 1.5 }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
        {d.implications.length > 0 && (
          <div>
            <SectionHeader title="시사점" color={color} bg={bg} border={border} />
            {d.implications.map((imp, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <span style={{ color, fontWeight: 700 }}>→</span>
                <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.6 }}>{imp.point}</p>
              </div>
            ))}
          </div>
        )}
      </>
    )
  }

  if (category === 'selfdev') {
    const d = data as SelfDevSummary
    return (
      <>
        <div style={{ background: bg, borderRadius: 10, padding: '14px 16px', marginBottom: 20, border: `1px solid ${border}` }}>
          <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px', fontWeight: 600 }}>핵심 메시지</p>
          <p style={{ fontSize: 14, fontWeight: 700, color, margin: 0, lineHeight: 1.6 }}>"{d.core_message.text}"</p>
        </div>
        <div style={{ marginBottom: 20 }}>
          <SectionHeader title="주요 인사이트" color={color} bg={bg} border={border} />
          {d.insights.map((ins, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', background: color, color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
              <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.6 }}>{ins.point}</p>
            </div>
          ))}
        </div>
        {d.checklist.length > 0 && (
          <div>
            <SectionHeader title="실천 체크리스트" color={color} bg={bg} border={border} />
            {d.checklist.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
                <span style={{ width: 14, height: 14, border: `1.5px solid ${color}`, borderRadius: 3, flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 12, color: '#374151', margin: 0 }}>{item}</p>
              </div>
            ))}
          </div>
        )}
      </>
    )
  }

  if (category === 'travel') {
    const d = data as TravelSummary
    return (
      <>
        <div style={{ marginBottom: 20 }}>
          <SectionHeader title="추천 장소" color={color} bg={bg} border={border} />
          {d.places.map((place, i) => (
            <div key={i} style={{ background: bg, borderRadius: 10, padding: '10px 12px', marginBottom: 8, border: `1px solid ${border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color, margin: 0 }}>{place.name}</p>
                {place.price && <span style={{ fontSize: 10, color: '#6b7280' }}>{place.price}</span>}
              </div>
              <p style={{ fontSize: 12, color: '#374151', margin: '0 0 4px', lineHeight: 1.6 }}>{place.desc}</p>
              {place.tip && <p style={{ fontSize: 11, color, margin: 0 }}>💡 {place.tip}</p>}
            </div>
          ))}
        </div>
        {d.route && (
          <div style={{ marginBottom: 16 }}>
            <SectionHeader title="추천 동선" color={color} bg={bg} border={border} />
            <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.6, background: '#f9fafb', padding: '10px 12px', borderRadius: 8 }}>{d.route}</p>
          </div>
        )}
      </>
    )
  }

  if (category === 'story') {
    const d = data as StorySummary
    return (
      <>
        {d.characters.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <SectionHeader title="주요 인물" color={color} bg={bg} border={border} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {d.characters.map((char, i) => (
                <div key={i} style={{ background: bg, borderRadius: 8, padding: '8px 10px', border: `1px solid ${border}` }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color, margin: '0 0 3px' }}>{char.name}</p>
                  <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>{char.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{ marginBottom: 20 }}>
          <SectionHeader title="스토리 전개" color={color} bg={bg} border={border} />
          {d.timeline.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: color, color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</div>
              <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.6, flex: 1 }}>{item.event}</p>
            </div>
          ))}
        </div>
        {d.conclusion && (
          <div>
            <SectionHeader title="🎬 결말 / 핵심 요약" color={color} bg={bg} border={border} />
            <div style={{ background: bg, borderRadius: 10, padding: '12px 14px', border: `1px solid ${border}` }}>
              <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{d.conclusion}</p>
            </div>
          </div>
        )}
      </>
    )
  }

  return null
}

// ─────────────────────────────────────────
// 메인 템플릿
// ─────────────────────────────────────────
export default function SummaryPdfTemplate({ data, qrDataUrl }: Props) {
  const cat = CATEGORY_META[data.category] ?? CATEGORY_META.news
  const summary = data.summary as any
  const tags: string[] = summary?.square_meta?.tags ?? []
  const videoUrl = `https://www.youtube.com/watch?v=${data.videoId}`

  const formatDate = (iso?: string) => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  return (
    <div style={{
      width: 794,
      background: '#ffffff',
      fontFamily: '"Apple SD Gothic Neo", "Noto Sans KR", Arial, sans-serif',
      color: '#1f2937',
      padding: '40px 44px 36px',
      boxSizing: 'border-box',
    }}>

      {/* ── 헤더 상단 바 ── */}
      <div style={{ height: 5, background: `linear-gradient(90deg, ${cat.color}, ${cat.color}88)`, borderRadius: 99, marginBottom: 28 }} />

      {/* ── 썸네일 + 기본 정보 ── */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 24, alignItems: 'flex-start' }}>
        <div style={{ flexShrink: 0, width: 240, borderRadius: 12, overflow: 'hidden', border: `1px solid ${cat.border}` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/proxy-image?url=${encodeURIComponent(data.thumbnail)}`}
            alt={data.title}
            style={{ width: '100%', display: 'block', aspectRatio: '16/9', objectFit: 'cover' }}
            crossOrigin="anonymous"
          />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, color: cat.color, background: cat.bg, borderRadius: 99, padding: '3px 10px', marginBottom: 8, border: `1px solid ${cat.border}` }}>
            {cat.icon} {cat.label}
          </span>
          <h1 style={{ fontSize: 17, fontWeight: 800, color: '#111827', margin: '0 0 6px', lineHeight: 1.4 }}>
            {data.title}
          </h1>
          <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 10px' }}>{data.channel}</p>

          {/* 날짜 */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 10 }}>
            {data.videoPublishedAt && (
              <span style={{ fontSize: 10, color: '#9ca3af' }}>📅 업로드 {formatDate(data.videoPublishedAt)}</span>
            )}
            {data.summarizedAt && (
              <span style={{ fontSize: 10, color: '#9ca3af' }}>🤖 요약 {formatDate(data.summarizedAt)}</span>
            )}
          </div>

          {/* 태그 */}
          {tags.length > 0 && (
            <div>
              {tags.slice(0, 5).map((tag, i) => (
                <span key={i} style={{ display: 'inline-block', fontSize: 10, color: cat.color, background: cat.bg, borderRadius: 99, padding: '2px 8px', marginRight: 4, marginBottom: 4, fontWeight: 600, border: `1px solid ${cat.border}` }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 구분선 ── */}
      <div style={{ height: 1, background: '#e5e7eb', marginBottom: 28 }} />

      {/* ── 보고서형 서술 요약 ── */}
      {data.reportSummary ? (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ width: 4, height: 20, background: cat.color, borderRadius: 99 }} />
            <h2 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: 0 }}>영상 분석 보고서</h2>
          </div>
          <ReportSection markdown={data.reportSummary} color={cat.color} bg={cat.bg} border={cat.border} />
        </div>
      ) : null}

      {/* ── 구분선 ── */}
      <div style={{ height: 1, background: '#e5e7eb', marginBottom: 28 }} />

      {/* ── 카테고리별 구조화 요약 ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div style={{ width: 4, height: 20, background: cat.color, borderRadius: 99 }} />
          <h2 style={{ fontSize: 15, fontWeight: 800, color: '#111827', margin: 0 }}>상세 정리</h2>
        </div>
        <StructuredContent data={summary} category={data.category} color={cat.color} bg={cat.bg} border={cat.border} />
      </div>

      {/* ── 하단 브랜딩 + QR ── */}
      <div style={{ marginTop: 24, paddingTop: 16, borderTop: '2px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: cat.color, marginBottom: 4 }}>🎬 Next Curator</div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>nextcurator.vercel.app</div>
          <div style={{ fontSize: 10, color: '#9ca3af' }}>{videoUrl}</div>
        </div>
        {qrDataUrl && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt="QR" style={{ width: 72, height: 72, border: `1px solid ${cat.border}`, borderRadius: 8, padding: 4 }} />
            <span style={{ fontSize: 9, color: '#9ca3af' }}>원본 영상 보기</span>
          </div>
        )}
      </div>
    </div>
  )
}
