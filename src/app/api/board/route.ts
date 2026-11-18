import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureGroupSetting } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const setting = await ensureGroupSetting();
    const posts = await prisma.post.findMany({
      include: {
        author: true,
        comments: {
          include: { author: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: [{ isNotice: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ setting, posts });
  } catch (error) {
    console.error('Board GET error:', error);
    return NextResponse.json({ error: '게시판을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'update_rules') {
      const { rulesMarkdown } = body;
      await ensureGroupSetting();
      const updated = await prisma.groupSetting.update({
        where: { id: 'default' },
        data: { rulesMarkdown: String(rulesMarkdown || '') },
      });
      return NextResponse.json({ ok: true, setting: updated });
    }

    if (action === 'create_post') {
      const { title, content, isNotice, imageUrl, authorId } = body;
      if (!title || !content || !authorId) {
        return NextResponse.json({ error: '제목, 내용, 작성자 정보가 필요합니다.' }, { status: 400 });
      }

      const post = await prisma.post.create({
        data: {
          title: String(title).trim(),
          content: String(content).trim(),
          isNotice: Boolean(isNotice),
          imageUrl: imageUrl || null,
          authorId,
        },
        include: { author: true, comments: { include: { author: true } } },
      });

      return NextResponse.json({ ok: true, post });
    }

    if (action === 'add_comment') {
      const { postId, content, authorId } = body;
      if (!postId || !content || !authorId) {
        return NextResponse.json({ error: '댓글 내용을 입력해주세요.' }, { status: 400 });
      }

      const comment = await prisma.comment.create({
        data: {
          postId,
          content: String(content).trim(),
          authorId,
        },
        include: { author: true },
      });

      return NextResponse.json({ ok: true, comment });
    }

    if (action === 'like_post') {
      const { postId } = body;
      const updated = await prisma.post.update({
        where: { id: postId },
        data: { likes: { increment: 1 } },
      });
      return NextResponse.json({ ok: true, likes: updated.likes });
    }

    if (action === 'toggle_notice') {
      const { postId, isNotice } = body;
      const updated = await prisma.post.update({
        where: { id: postId },
        data: { isNotice: Boolean(isNotice) },
      });
      return NextResponse.json({ ok: true, post: updated });
    }

    return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  } catch (error) {
    console.error('Board POST error:', error);
    return NextResponse.json({ error: '게시판 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const postId = searchParams.get('postId');
    const commentId = searchParams.get('commentId');

    if (commentId) {
      await prisma.comment.delete({ where: { id: commentId } });
      return NextResponse.json({ ok: true });
    }

    if (postId) {
      await prisma.post.delete({ where: { id: postId } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: '삭제 대상 ID가 없습니다.' }, { status: 400 });
  } catch (error) {
    console.error('Board DELETE error:', error);
    return NextResponse.json({ error: '삭제에 실패했습니다.' }, { status: 500 });
  }
}
