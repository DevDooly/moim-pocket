import { NextRequest, NextResponse } from 'next/server';
import { prisma, ensureGroupSetting } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const setting = await ensureGroupSetting();
    const members = await prisma.member.findMany({
      orderBy: [{ isActive: 'desc' }, { joinedAt: 'asc' }],
    });

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const monthStart = new Date(currentYear, currentMonth - 1, 1);
    const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

    const allTransactions = await prisma.transaction.findMany({
      include: { member: true, event: true },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    let totalIncome = 0;
    let totalExpense = 0;
    let monthlyIncome = 0;
    let monthlyExpense = 0;

    for (const tx of allTransactions) {
      if (tx.type === 'INCOME') {
        totalIncome += tx.amount;
        if (tx.date >= monthStart && tx.date <= monthEnd) {
          monthlyIncome += tx.amount;
        }
      } else if (tx.type === 'EXPENSE') {
        totalExpense += tx.amount;
        if (tx.date >= monthStart && tx.date <= monthEnd) {
          monthlyExpense += tx.amount;
        }
      }
    }

    const totalBalance = totalIncome - totalExpense;
    const recentTransactions = allTransactions.slice(0, 3);

    const currentMonthDues = await prisma.duesRecord.findMany({
      where: { year: currentYear, month: currentMonth },
    });

    const upcomingEvent = await prisma.event.findFirst({
      where: {
        startAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
      },
      include: {
        rsvps: { include: { member: true } },
      },
      orderBy: { startAt: 'asc' },
    });

    const activePolls = await prisma.poll.findMany({
      where: { isClosed: false },
      include: {
        options: {
          include: { votes: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 2,
    });

    const latestNotice = await prisma.post.findFirst({
      where: { isNotice: true },
      include: { author: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      setting,
      members,
      summary: {
        totalBalance,
        totalIncome,
        totalExpense,
        monthlyIncome,
        monthlyExpense,
        currentYear,
        currentMonth,
        currentMonthDues,
        recentTransactions,
        upcomingEvent,
        activePolls,
        latestNotice,
      },
    });
  } catch (error) {
    console.error('Bootstrap API error:', error);
    return NextResponse.json({ error: '데이터를 불러오지 못했습니다.' }, { status: 500 });
  }
}
