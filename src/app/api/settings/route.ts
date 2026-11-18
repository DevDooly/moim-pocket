import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureGroupSetting } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const setting = await ensureGroupSetting();
    const members = await prisma.member.findMany({
      orderBy: [{ isActive: 'desc' }, { joinedAt: 'asc' }],
    });

    return NextResponse.json({ setting, members });
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ error: '설정 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'update_setting') {
      const { groupName, bankAccount, monthlyFee, rulesMarkdown } = body;
      await ensureGroupSetting();

      const updated = await prisma.groupSetting.update({
        where: { id: 'default' },
        data: {
          groupName: groupName !== undefined ? String(groupName).trim() : undefined,
          bankAccount: bankAccount !== undefined ? String(bankAccount).trim() : undefined,
          monthlyFee: monthlyFee !== undefined ? Number(monthlyFee) : undefined,
          rulesMarkdown: rulesMarkdown !== undefined ? String(rulesMarkdown) : undefined,
        },
      });

      return NextResponse.json({ ok: true, setting: updated });
    }

    if (action === 'add_member') {
      const { name, role } = body;
      if (!name || !String(name).trim()) {
        return NextResponse.json({ error: '멤버 이름을 입력해주세요.' }, { status: 400 });
      }

      const member = await prisma.member.create({
        data: {
          name: String(name).trim(),
          role: role === 'ADMIN' ? 'ADMIN' : 'MEMBER',
          isActive: true,
        },
      });

      return NextResponse.json({ ok: true, member });
    }

    if (action === 'update_member') {
      const { id, name, role, isActive } = body;
      if (!id) {
        return NextResponse.json({ error: '멤버 ID가 필요합니다.' }, { status: 400 });
      }

      const member = await prisma.member.update({
        where: { id },
        data: {
          name: name !== undefined ? String(name).trim() : undefined,
          role: role !== undefined ? String(role) : undefined,
          isActive: isActive !== undefined ? Boolean(isActive) : undefined,
        },
      });

      return NextResponse.json({ ok: true, member });
    }

    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  } catch (error) {
    console.error('Settings POST error:', error);
    return NextResponse.json({ error: '설정 저장 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
