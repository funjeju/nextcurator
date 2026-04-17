import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const TYPE_LABEL: Record<string, string> = {
  bug:         '🐛 버그 신고',
  suggestion:  '💡 제안',
  partnership: '🤝 제휴 문의',
}

/** 카카오 나에게 보내기 — refresh token으로 access token 갱신 후 메시지 발송 */
async function sendKakaoMe(typeLabel: string, email: string, message: string) {
  const refreshToken = process.env.KAKAO_REFRESH_TOKEN
  const restApiKey   = process.env.KAKAO_REST_API_KEY
  if (!refreshToken || !restApiKey) return

  // 1. access token 갱신
  const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     restApiKey,
      refresh_token: refreshToken,
    }),
  })
  const tokenData = await tokenRes.json()
  const accessToken: string = tokenData.access_token
  if (!accessToken) return

  // 2. 나에게 보내기
  const text = `[SSOKTUBE 문의]\n유형: ${typeLabel}\n이메일: ${email || '미입력'}\n\n${message}`
  await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      template_object: JSON.stringify({
        object_type: 'text',
        text,
        link: { web_url: 'https://ssoktube.com', mobile_web_url: 'https://ssoktube.com' },
        button_title: 'SSOKTUBE 바로가기',
      }),
    }),
  })
}

export async function POST(req: NextRequest) {
  try {
    const { type, email, message } = await req.json()

    if (!type || !message?.trim()) {
      return NextResponse.json({ error: '필수 항목을 입력해주세요.' }, { status: 400 })
    }

    const typeLabel = TYPE_LABEL[type] ?? type
    const toEmail   = process.env.CONTACT_TO_EMAIL
    if (!toEmail) {
      return NextResponse.json({ error: '서버 설정 오류' }, { status: 500 })
    }

    // 이메일 발송
    await resend.emails.send({
      from:    'SSOKTUBE <onboarding@resend.dev>',
      to:      [toEmail],
      subject: `[SSOKTUBE] ${typeLabel}${email ? ` — ${email}` : ''}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
          <h2 style="color:#f97316;">${typeLabel}</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:6px 0;color:#888;width:80px;">보낸이</td><td style="padding:6px 0;color:#111;">${email || '미입력'}</td></tr>
            <tr><td style="padding:6px 0;color:#888;vertical-align:top;">내용</td><td style="padding:6px 0;color:#111;white-space:pre-wrap;">${message.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</td></tr>
          </table>
        </div>
      `,
    })

    // 카카오 알림 (실패해도 전체는 성공 처리)
    await sendKakaoMe(typeLabel, email || '미입력', message).catch(err =>
      console.warn('[Contact] Kakao 알림 실패:', err)
    )

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[Contact API]', e)
    return NextResponse.json({ error: '전송에 실패했습니다.' }, { status: 500 })
  }
}
