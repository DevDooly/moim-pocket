import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const now = new Date();

    // 마감 시간이 지난 투표 자동 종료 처리
    await prisma.poll.updateMany({
      where: {
        isClosed: false,
        closesAt: { lt: now },
      },
      data: { isClosed: true },
    });

    const polls = await prisma.poll.findMany({
      include: {
        options: {
          include: {
            votes: {
              include: { member: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const activeMembers = await prisma.member.findMany({
      where: { isActive: true },
      orderBy: { joinedAt: 'asc' },
    });

    return NextResponse.json({ polls, activeMembers });
  } catch (error) {
    console.error('Polls GET error:', error);
    return NextResponse.json({ error: '투표 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'create_poll') {
      const { title, allowMultiple, allowAddOption, closesAt, options } = body;
      const validOptions = (Array.isArray(options) ? options : [])
        .map((t: string) => String(t).trim())
        .filter(Boolean);

      if (!title || validOptions.length < 2) {
        return NextResponse.json(
          { error: '투표 제목과 최소 2개 이상의 선택지를 입력해주세요.' },
          { status: 400 }
        );
      }

      const poll = await prisma.poll.create({
        data: {
          title: String(title).trim(),
          allowMultiple: Boolean(allowMultiple),
          allowAddOption: allowAddOption !== undefined ? Boolean(allowAddOption) : true,
          closesAt: closesAt ? new Date(closesAt) : null,
          options: {
            create: validOptions.map((text: string) => ({ text })),
          },
        },
      });

      return NextResponse.json({ ok: true, poll });
    }

    if (action === 'vote') {
      const { pollId, memberId, optionIds } = body;
      if (!pollId || !memberId || !Array.isArray(optionIds)) {
        return NextResponse.json({ error: '투표 파라미터가 올바르지 않습니다.' }, { status: 400 });
      }

      const poll = await prisma.poll.findUnique({
        where: { id: pollId },
        include: { options: true },
      });

      if (!poll || poll.isClosed) {
        return NextResponse.json({ error: '이미 마감된 투표입니다.' }, { status: 400 });
      }

      const allPollOptionIds = poll.options.map((o) => o.id);
      const selectedIds = poll.allowMultiple ? optionIds : optionIds.slice(0, 1);

      await prisma.$transaction(async (tx) => {
        await tx.pollVote.deleteMany({
          where: {
            memberId,
            optionId: { in: allPollOptionIds },
          },
        });

        for (const optId of selectedIds) {
          if (allPollOptionIds.includes(optId)) {
            await tx.pollVote.create({
              data: {
                optionId: optId,
                memberId,
              },
            });
          }
        }
      });

      return NextResponse.json({ ok: true });
    }

    if (action === 'add_option') {
      const { pollId, text } = body;
      const poll = await prisma.poll.findUnique({ where: { id: pollId } });

      if (!poll || poll.isClosed || !poll.allowAddOption) {
        return NextResponse.json({ error: '항목을 추가할 수 없는 투표입니다.' }, { status: 400 });
      }

      const option = await prisma.pollOption.create({
        data: {
          pollId,
          text: String(text).trim(),
        },
      });

      return NextResponse.json({ ok: true, option });
    }

    if (action === 'close_poll') {
      const { pollId } = body;
      await prisma.poll.update({
        where: { id: pollId },
        data: { isClosed: true },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  } catch (error) {
    console.error('Polls POST error:', error);
    return NextResponse.json({ error: '투표 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: '투표 ID가 필요합니다.' }, { status: 400 });
    }

    await prisma.poll.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Polls DELETE error:', error);
    return NextResponse.json({ error: '투표 삭제에 실패했습니다.' }, { status: 500 });
  }
}
