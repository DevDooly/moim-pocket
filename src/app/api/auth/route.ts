import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, pin } = body;

    const groupPin = process.env.GROUP_PIN || '1234';
    const adminPin = process.env.ADMIN_PIN || '9999';

    if (action === 'verify_group') {
      if (String(pin).trim() === String(groupPin).trim()) {
        return NextResponse.json({ ok: true, token: 'gyemoim-group-verified' });
      }
      return NextResponse.json(
        { ok: false, message: '모임 입장 코드(PIN)가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    if (action === 'verify_admin') {
      if (String(pin).trim() === String(adminPin).trim()) {
        return NextResponse.json({ ok: true, isAdmin: true });
      }
      return NextResponse.json(
        { ok: false, message: '총무 인증 코드(ADMIN_PIN)가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    return NextResponse.json({ ok: false, message: '잘못된 요청입니다.' }, { status: 400 });
  } catch (error) {
    console.error('Auth API Error:', error);
    return NextResponse.json({ ok: false, message: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
