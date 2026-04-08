import { SummarizeResponse } from '@/types/summary'
import {
  RecipeSummary, EnglishSummary, LearningSummary,
  NewsSummary, SelfDevSummary, TravelSummary, StorySummary,
} from '@/types/summary'

interface Props {
  data: SummarizeResponse
}

const CATEGORY_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  recipe:  { label: '요리',    icon: '🍳', color: '#ea580c', bg: '#fff7ed' },
  english: { label: '영어학습', icon: '🔤', color: '#2563eb', bg: '#eff6ff' },
  learning:{ label: '학습',    icon: '📐', color: '#7c3aed', bg: '#f5f3ff' },
  news:    { label: '뉴스',    icon: '🗞️', color: '#374151', bg: '#f9fafb' },
  selfdev: { label: '자기계발', icon: '💪', color: '#059669', bg: '#ecfdf5' },
  travel:  { label: '여행',    icon: '🧳', color: '#0891b2', bg: '#ecfeff' },
  story:   { label: '스토리',  icon: '🍿', color: '#db2777', bg: '#fdf2f8' },
}

// ─── 섹션 제목 ───
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: 13, fontWeight: 700, color: '#111827', borderBottom: '1.5px solid #e5e7eb', paddingBottom: 6, marginBottom: 10, marginTop: 0 }}>
      {children}
    </h3>
  )
}

// ─── 태그 뱃지 ───
function Tag({ text, color = '#6b7280', bg = '#f3f4f6' }: { text: string; color?: string; bg?: string }) {
  return (
    <span style={{ display: 'inline-block', fontSize: 10, color, background: bg, borderRadius: 99, padding: '2px 8px', marginRight: 4, marginBottom: 4, fontWeight: 600 }}>
      {text}
    </span>
  )
}

// ─────────────────────────────────────────
// 카테고리별 콘텐츠
// ─────────────────────────────────────────

function RecipeContent({ data }: { data: RecipeSummary }) {
  const groups = data.ingredient_groups ?? (data.ingredients ? [{ group: '재료', items: data.ingredients }] : [])
  return (
    <>
      {/* 기본 정보 행 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: '난이도', value: data.difficulty },
          { label: '조리 시간', value: data.total_time },
          { label: '분량', value: data.servings },
        ].map(item => (
          <div key={item.label} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 14px', textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: '#9ca3af', marginBottom: 2 }}>{item.label}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* 재료 */}
      <div style={{ marginBottom: 20 }}>
        <SectionTitle>재료</SectionTitle>
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

      {/* 만드는 법 */}
      <div style={{ marginBottom: 20 }}>
        <SectionTitle>만드는 법</SectionTitle>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.steps.map(step => (
            <div key={step.step} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#ea580c', color: '#fff', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {step.step}
              </span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, color: '#1f2937', margin: 0, lineHeight: 1.6 }}>{step.desc}</p>
                {step.tip && (
                  <p style={{ fontSize: 11, color: '#059669', margin: '3px 0 0', fontStyle: 'italic' }}>💡 {step.tip}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 핵심 팁 */}
      {data.key_tips.length > 0 && (
        <div>
          <SectionTitle>💡 핵심 팁</SectionTitle>
          {data.key_tips.map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <span style={{ color: '#059669', fontWeight: 700, flexShrink: 0 }}>•</span>
              <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.6 }}>{tip}</p>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function EnglishContent({ data }: { data: EnglishSummary }) {
  return (
    <>
      {data.expressions.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SectionTitle>주요 표현</SectionTitle>
          {data.expressions.map((expr, i) => (
            <div key={i} style={{ background: '#eff6ff', borderRadius: 8, padding: '10px 12px', marginBottom: 8, borderLeft: '3px solid #2563eb' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', margin: '0 0 4px' }}>{expr.text}</p>
              <p style={{ fontSize: 12, color: '#1f2937', margin: '0 0 3px' }}>{expr.meaning}</p>
              {expr.note && <p style={{ fontSize: 11, color: '#6b7280', margin: 0, fontStyle: 'italic' }}>{expr.note}</p>}
            </div>
          ))}
        </div>
      )}
      {data.vocabulary.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SectionTitle>단어장</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {data.vocabulary.map((v, i) => (
              <div key={i} style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 10px', border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>{v.word}</div>
                <div style={{ fontSize: 10, color: '#6b7280' }}>{v.pronunciation}</div>
                <div style={{ fontSize: 11, color: '#374151', marginTop: 2 }}>{v.meaning}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.patterns.length > 0 && (
        <div>
          <SectionTitle>핵심 패턴</SectionTitle>
          {data.patterns.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
              <span style={{ color: '#2563eb', fontWeight: 700 }}>•</span>
              <p style={{ fontSize: 12, color: '#374151', margin: 0 }}>{p}</p>
            </div>
          ))}
        </div>
      )}
      {data.cultural_context && (
        <div style={{ marginTop: 16, background: '#f0fdf4', borderRadius: 8, padding: '10px 12px' }}>
          <p style={{ fontSize: 11, color: '#374151', margin: 0, fontStyle: 'italic' }}>🌍 {data.cultural_context}</p>
        </div>
      )}
    </>
  )
}

function LearningContent({ data }: { data: LearningSummary }) {
  return (
    <>
      {data.concepts.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SectionTitle>핵심 개념</SectionTitle>
          {data.concepts.map((c, i) => (
            <div key={i} style={{ marginBottom: 10, paddingLeft: 10, borderLeft: '3px solid #7c3aed' }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#4c1d95', margin: '0 0 3px' }}>{c.name}</p>
              <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.6 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      )}
      {data.key_points.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SectionTitle>핵심 포인트</SectionTitle>
          {data.key_points.map((kp, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <span style={{ color: '#7c3aed', fontWeight: 700, flexShrink: 0 }}>✓</span>
              <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.6 }}>{kp.point}</p>
            </div>
          ))}
        </div>
      )}
      {data.examples.length > 0 && (
        <div>
          <SectionTitle>예시</SectionTitle>
          {data.examples.map((ex, i) => (
            <div key={i} style={{ background: '#f5f3ff', borderRadius: 8, padding: '8px 12px', marginBottom: 6 }}>
              <p style={{ fontSize: 12, color: '#374151', margin: 0 }}>{ex.desc}</p>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function NewsContent({ data }: { data: NewsSummary }) {
  const w = data.five_w
  return (
    <>
      <div style={{ background: '#f9fafb', borderRadius: 10, padding: '12px 14px', marginBottom: 16, border: '1px solid #e5e7eb' }}>
        <p style={{ fontSize: 13, color: '#1f2937', margin: 0, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{data.three_line_summary}</p>
      </div>
      <div style={{ marginBottom: 20 }}>
        <SectionTitle>육하원칙</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[
            { label: '누가', value: w.who },
            { label: '언제', value: w.when },
            { label: '어디서', value: w.where },
            { label: '무엇을', value: w.what },
            { label: '어떻게', value: w.how },
            { label: '왜', value: w.why },
          ].map(item => (
            <div key={item.label} style={{ background: '#f9fafb', borderRadius: 8, padding: '8px 10px', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 9, color: '#9ca3af', fontWeight: 600, marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: 11, color: '#1f2937', lineHeight: 1.5 }}>{item.value}</div>
            </div>
          ))}
        </div>
      </div>
      {data.implications.length > 0 && (
        <div>
          <SectionTitle>시사점</SectionTitle>
          {data.implications.map((imp, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <span style={{ color: '#374151', fontWeight: 700 }}>→</span>
              <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.6 }}>{imp.point}</p>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function SelfDevContent({ data }: { data: SelfDevSummary }) {
  return (
    <>
      <div style={{ background: '#ecfdf5', borderRadius: 10, padding: '14px 16px', marginBottom: 20, border: '1px solid #a7f3d0' }}>
        <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px', fontWeight: 600 }}>핵심 메시지</p>
        <p style={{ fontSize: 14, fontWeight: 700, color: '#065f46', margin: 0, lineHeight: 1.6 }}>"{data.core_message.text}"</p>
      </div>
      {data.insights.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SectionTitle>인사이트</SectionTitle>
          {data.insights.map((ins, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#059669', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {i + 1}
              </span>
              <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.6 }}>{ins.point}</p>
            </div>
          ))}
        </div>
      )}
      {data.checklist.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SectionTitle>실천 체크리스트</SectionTitle>
          {data.checklist.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}>
              <span style={{ width: 14, height: 14, border: '1.5px solid #059669', borderRadius: 3, flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 12, color: '#374151', margin: 0 }}>{item}</p>
            </div>
          ))}
        </div>
      )}
      {data.quotes.length > 0 && (
        <div>
          <SectionTitle>인상 깊은 문구</SectionTitle>
          {data.quotes.map((q, i) => (
            <div key={i} style={{ background: '#f0fdf4', borderRadius: 8, padding: '10px 12px', marginBottom: 8, borderLeft: '3px solid #059669' }}>
              <p style={{ fontSize: 12, color: '#065f46', margin: 0, fontStyle: 'italic', lineHeight: 1.6 }}>"{q.text}"</p>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function TravelContent({ data }: { data: TravelSummary }) {
  return (
    <>
      {data.places.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SectionTitle>추천 장소</SectionTitle>
          {data.places.map((place, i) => (
            <div key={i} style={{ background: '#ecfeff', borderRadius: 10, padding: '10px 12px', marginBottom: 8, border: '1px solid #a5f3fc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#0e7490', margin: 0 }}>{place.name}</p>
                {place.price && <span style={{ fontSize: 10, color: '#6b7280', background: '#f0fdfe', padding: '1px 6px', borderRadius: 99 }}>{place.price}</span>}
              </div>
              <p style={{ fontSize: 12, color: '#374151', margin: '0 0 4px', lineHeight: 1.6 }}>{place.desc}</p>
              {place.tip && <p style={{ fontSize: 11, color: '#0891b2', margin: 0, fontStyle: 'italic' }}>💡 {place.tip}</p>}
            </div>
          ))}
        </div>
      )}
      {data.route && (
        <div style={{ marginBottom: 16 }}>
          <SectionTitle>추천 동선</SectionTitle>
          <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 12px' }}>
            <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.6 }}>{data.route}</p>
          </div>
        </div>
      )}
      {data.practical_info.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <SectionTitle>실용 정보</SectionTitle>
          {data.practical_info.map((info, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
              <span style={{ color: '#0891b2', fontWeight: 700 }}>•</span>
              <p style={{ fontSize: 12, color: '#374151', margin: 0 }}>{info}</p>
            </div>
          ))}
        </div>
      )}
      {data.warnings.length > 0 && (
        <div>
          <SectionTitle>⚠️ 주의사항</SectionTitle>
          {data.warnings.map((w, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
              <span style={{ color: '#dc2626', fontWeight: 700 }}>!</span>
              <p style={{ fontSize: 12, color: '#374151', margin: 0 }}>{w}</p>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function StoryContent({ data }: { data: StorySummary }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <span style={{ background: '#fce7f3', color: '#be185d', borderRadius: 99, padding: '3px 10px', fontSize: 11, fontWeight: 600 }}>{data.genre}</span>
      </div>
      {data.characters.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SectionTitle>주요 인물</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {data.characters.map((char, i) => (
              <div key={i} style={{ background: '#fdf2f8', borderRadius: 8, padding: '8px 10px', border: '1px solid #f9a8d4' }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#be185d', margin: '0 0 3px' }}>{char.name}</p>
                <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>{char.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {data.timeline.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <SectionTitle>스토리 타임라인</SectionTitle>
          {data.timeline.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#db2777', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {i + 1}
              </div>
              <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.6, flex: 1 }}>{item.event}</p>
            </div>
          ))}
        </div>
      )}
      {data.conclusion && (
        <div>
          <SectionTitle>🎬 결말 / 핵심 요약</SectionTitle>
          <div style={{ background: '#fdf2f8', borderRadius: 10, padding: '12px 14px', border: '1px solid #f9a8d4' }}>
            <p style={{ fontSize: 12, color: '#374151', margin: 0, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{data.conclusion}</p>
          </div>
        </div>
      )}
    </>
  )
}

// ─────────────────────────────────────────
// 메인 템플릿
// ─────────────────────────────────────────
export default function SummaryPdfTemplate({ data }: Props) {
  const cat = CATEGORY_META[data.category] ?? CATEGORY_META.news
  const summary = data.summary as any
  const tags: string[] = summary?.square_meta?.tags ?? []

  return (
    <div
      style={{
        width: 794,
        background: '#ffffff',
        fontFamily: '"Pretendard", "Apple SD Gothic Neo", "Noto Sans KR", Arial, sans-serif',
        color: '#1f2937',
        padding: '40px 44px 32px',
        boxSizing: 'border-box',
      }}
    >
      {/* ── 헤더: 썸네일 + 기본 정보 ── */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 28, alignItems: 'flex-start' }}>
        {/* 썸네일 */}
        <div style={{ flexShrink: 0, width: 260, borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/proxy-image?url=${encodeURIComponent(data.thumbnail)}`}
            alt={data.title}
            style={{ width: '100%', display: 'block', aspectRatio: '16/9', objectFit: 'cover' }}
            crossOrigin="anonymous"
          />
        </div>

        {/* 기본 정보 */}
        <div style={{ flex: 1, minWidth: 0, paddingTop: 4 }}>
          {/* 카테고리 뱃지 */}
          <span style={{
            display: 'inline-block', fontSize: 10, fontWeight: 700,
            color: cat.color, background: cat.bg,
            borderRadius: 99, padding: '3px 10px', marginBottom: 8,
          }}>
            {cat.icon} {cat.label}
          </span>

          {/* 제목 */}
          <h1 style={{ fontSize: 17, fontWeight: 800, color: '#111827', margin: '0 0 6px', lineHeight: 1.4 }}>
            {data.title}
          </h1>

          {/* 채널 */}
          <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 12px' }}>{data.channel}</p>

          {/* 태그 */}
          {tags.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              {tags.slice(0, 5).map((tag, i) => (
                <Tag key={i} text={`#${tag}`} color={cat.color} bg={cat.bg} />
              ))}
            </div>
          )}

          {/* topic / vibe */}
          {summary?.square_meta?.topic_cluster && (
            <p style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>
              {summary.square_meta.topic_cluster}
              {summary.square_meta.vibe ? ` · ${summary.square_meta.vibe}` : ''}
            </p>
          )}
        </div>
      </div>

      {/* ── 구분선 ── */}
      <div style={{ height: 1, background: '#e5e7eb', marginBottom: 24 }} />

      {/* ── 카테고리별 요약 콘텐츠 ── */}
      <div>
        {data.category === 'recipe'  && <RecipeContent  data={summary as RecipeSummary} />}
        {data.category === 'english' && <EnglishContent data={summary as EnglishSummary} />}
        {data.category === 'learning'&& <LearningContent data={summary as LearningSummary} />}
        {data.category === 'news'    && <NewsContent    data={summary as NewsSummary} />}
        {data.category === 'selfdev' && <SelfDevContent data={summary as SelfDevSummary} />}
        {data.category === 'travel'  && <TravelContent  data={summary as TravelSummary} />}
        {data.category === 'story'   && <StoryContent   data={summary as StorySummary} />}
      </div>

      {/* ── 하단 브랜딩 ── */}
      <div style={{ marginTop: 32, paddingTop: 14, borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#ea580c' }}>🎬 Next Curator</span>
        <span style={{ fontSize: 10, color: '#d1d5db' }}>nextcurator.vercel.app</span>
      </div>
    </div>
  )
}
