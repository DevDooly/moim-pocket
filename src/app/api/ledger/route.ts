import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureGroupSetting } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const year = Number(searchParams.get('year') || new Date().getFullYear());

    const setting = await ensureGroupSetting();
    const members = await prisma.member.findMany({
      orderBy: [{ isActive: 'desc' }, { joinedAt: 'asc' }],
    });

    const duesRecords = await prisma.duesRecord.findMany({
      where: { year },
      include: { member: true },
    });

    const transactions = await prisma.transaction.findMany({
      include: { member: true, event: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    const events = await prisma.event.findMany({
      orderBy: { startAt: 'desc' },
    });

    return NextResponse.json({
      year,
      setting,
      members,
      duesRecords,
      transactions,
      events,
    });
  } catch (error) {
    console.error('Ledger GET error:', error);
    return NextResponse.json({ error: '장부 데이터를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    // 1. [총무 전용] 빠른 일괄 납부 처리 (매트릭스 + 입출금 장부 동시 반영)
    if (action === 'bulk_dues') {
      const year = Number(body.year);
      const month = Number(body.month);
      const memberIds: string[] = Array.isArray(body.memberIds) ? body.memberIds : [];
      const setting = await ensureGroupSetting();
      const amount = Number(body.amount || setting.monthlyFee || 30000);

      if (!year || !month || memberIds.length === 0) {
        return NextResponse.json({ error: '연도, 월, 대상 멤버를 선택해주세요.' }, { status: 400 });
      }

      const targetMembers = await prisma.member.findMany({
        where: { id: { in: memberIds } },
      });

      const txDate = body.date ? new Date(body.date) : new Date(year, month - 1, 25, 12, 0);

      await prisma.$transaction(async (tx) => {
        for (const member of targetMembers) {
          await tx.duesRecord.upsert({
            where: {
              year_month_memberId: {
                year,
                month,
                memberId: member.id,
              },
            },
            update: {
              status: 'PAID',
              amount,
            },
            create: {
              year,
              month,
              status: 'PAID',
              amount,
              memberId: member.id,
            },
          });

          const uniqueHash = `BULK-DUES-${year}-${month}-${member.id}`;
          const existingTx = await tx.transaction.findUnique({
            where: { uniqueHash },
          });

          if (!existingTx) {
            await tx.transaction.create({
              data: {
                date: txDate,
                type: 'INCOME',
                category: '회비',
                amount,
                description: `${month}월 정기 회비 납부 (${member.name})`,
                memberId: member.id,
                sourceType: 'MANUAL',
                uniqueHash,
              },
            });
          }
        }
      });

      return NextResponse.json({ ok: true, count: targetMembers.length });
    }

    // 2. 개별 셀 상태 변경 (PAID / UNPAID / EXEMPT)
    if (action === 'update_dues_status') {
      const year = Number(body.year);
      const month = Number(body.month);
      const memberId = String(body.memberId);
      const status = String(body.status); // "PAID" | "UNPAID" | "EXEMPT"
      const setting = await ensureGroupSetting();
      const amount = status === 'PAID' ? Number(body.amount || setting.monthlyFee) : 0;

      const member = await prisma.member.findUnique({ where: { id: memberId } });
      if (!member) {
        return NextResponse.json({ error: '멤버를 찾을 수 없습니다.' }, { status: 404 });
      }

      const record = await prisma.duesRecord.upsert({
        where: {
          year_month_memberId: {
            year,
            month,
            memberId,
          },
        },
        update: { status, amount },
        create: { year, month, status, amount, memberId },
      });

      const uniqueHash = `BULK-DUES-${year}-${month}-${memberId}`;
      if (status === 'PAID') {
        const existingTx = await prisma.transaction.findUnique({ where: { uniqueHash } });
        if (!existingTx) {
          await prisma.transaction.create({
            data: {
              date: new Date(year, month - 1, 25, 12, 0),
              type: 'INCOME',
              category: '회비',
              amount,
              description: `${month}월 정기 회비 납부 (${member.name})`,
              memberId: member.id,
              sourceType: 'MANUAL',
              uniqueHash,
            },
          });
        }
      } else {
        await prisma.transaction.deleteMany({ where: { uniqueHash } });
      }

      return NextResponse.json({ ok: true, record });
    }

    // 3. 수기 입출금 내역 등록
    if (action === 'create_transaction') {
      const {
        date,
        type,
        category,
        amount,
        description,
        receiptUrl,
        memberId,
        eventId,
      } = body;

      const parsedDate = date ? new Date(date) : new Date();
      const parsedAmount = Number(amount);

      const created = await prisma.transaction.create({
        data: {
          date: parsedDate,
          type: type || 'EXPENSE',
          category: category || '기타',
          amount: parsedAmount,
          description: description || `${category} 내역`,
          receiptUrl: receiptUrl || null,
          memberId: memberId || null,
          eventId: eventId || null,
          sourceType: 'MANUAL',
        },
        include: { member: true, event: true },
      });

      // 만약 회비 입금이고 멤버가 지정되어 있으면 해당 연/월 회비 매트릭스도 자동 완납 반영
      if (type === 'INCOME' && (category === '회비' || category === '회비입금') && memberId) {
        const y = parsedDate.getFullYear();
        const m = parsedDate.getMonth() + 1;
        await prisma.duesRecord.upsert({
          where: {
            year_month_memberId: { year: y, month: m, memberId },
          },
          update: { status: 'PAID', amount: parsedAmount },
          create: { year: y, month: m, status: 'PAID', amount: parsedAmount, memberId },
        });
      }

      return NextResponse.json({ ok: true, transaction: created });
    }

    return NextResponse.json({ error: '지원하지 않는 작업입니다.' }, { status: 400 });
  } catch (error) {
    console.error('Ledger POST error:', error);
    return NextResponse.json({ error: '장부 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      date,
      type,
      category,
      amount,
      description,
      receiptUrl,
      memberId,
      eventId,
    } = body;

    if (!id) {
      return NextResponse.json({ error: '거래 ID가 필요합니다.' }, { status: 400 });
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: {
        date: date ? new Date(date) : undefined,
        type,
        category,
        amount: Number(amount),
        description,
        receiptUrl: receiptUrl || null,
        memberId: memberId || null,
        eventId: eventId || null,
      },
      include: { member: true, event: true },
    });

    return NextResponse.json({ ok: true, transaction: updated });
  } catch (error) {
    console.error('Ledger PUT error:', error);
    return NextResponse.json({ error: '내역 수정에 실패했습니다.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '삭제할 내역 ID가 없습니다.' }, { status: 400 });
    }

    await prisma.transaction.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Ledger DELETE error:', error);
    return NextResponse.json({ error: '내역 삭제에 실패했습니다.' }, { status: 500 });
  }
}
