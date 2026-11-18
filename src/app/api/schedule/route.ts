import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const events = await prisma.event.findMany({
      include: {
        rsvps: {
          include: { member: true },
        },
        transactions: {
          include: { member: true },
          orderBy: { date: 'desc' },
        },
        albums: true,
      },
      orderBy: { startAt: 'asc' },
    });

    const members = await prisma.member.findMany({
      where: { isActive: true },
      orderBy: { joinedAt: 'asc' },
    });

    return NextResponse.json({ events, members });
  } catch (error) {
    console.error('Schedule GET error:', error);
    return NextResponse.json({ error: '일정을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'create_event') {
      const { title, description, location, startAt, endAt } = body;
      if (!title || !startAt) {
        return NextResponse.json({ error: '일정 제목과 시작 일시는 필수입니다.' }, { status: 400 });
      }

      const event = await prisma.event.create({
        data: {
          title,
          description: description || null,
          location: location || null,
          startAt: new Date(startAt),
          endAt: endAt ? new Date(endAt) : null,
        },
      });

      return NextResponse.json({ ok: true, event });
    }

    if (action === 'rsvp') {
      const { eventId, memberId, status } = body;
      if (!eventId || !memberId || !status) {
        return NextResponse.json({ error: '필수 파라미터가 누락되었습니다.' }, { status: 400 });
      }

      const rsvp = await prisma.eventRsvp.upsert({
        where: {
          eventId_memberId: { eventId, memberId },
        },
        update: { status },
        create: { eventId, memberId, status },
      });

      return NextResponse.json({ ok: true, rsvp });
    }

    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  } catch (error) {
    console.error('Schedule POST error:', error);
    return NextResponse.json({ error: '일정 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: '일정 ID가 필요합니다.' }, { status: 400 });
    }

    await prisma.event.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Schedule DELETE error:', error);
    return NextResponse.json({ error: '일정 삭제에 실패했습니다.' }, { status: 500 });
  }
}
