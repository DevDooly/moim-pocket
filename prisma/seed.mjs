import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const existingMembers = await prisma.member.count();
  if (existingMembers > 0) {
    console.log('데이터베이스에 이미 초기 데이터가 존재합니다. 시드 작업을 건너뜁니다.');
    return;
  }

  console.log('초기 시드 데이터를 생성합니다...');

  const groupName = process.env.GROUP_NAME || '우리계모임';
  const monthlyFee = Number(process.env.MONTHLY_FEE || 30000);

  await prisma.groupSetting.upsert({
    where: { id: 'default' },
    update: {},
    create: {
      id: 'default',
      groupName,
      bankAccount: '카카오뱅크 3333-01-2345678 (홍길동 모임통장)',
      monthlyFee,
      rulesMarkdown: `### 📌 ${groupName} 회칙 안내\n\n1. **월 회비:** 매월 25일 **${monthlyFee.toLocaleString()}원** 자동이체 또는 모임통장 입금\n2. **정기 모임:** 매 분기 첫째 주 토요일 저녁 6시\n3. **경조사 지원 기준:**\n   - 본인 및 직계가족 결혼/장례: 모임비 200,000원 + 화환\n   - 출산/돌잔치: 축하금 100,000원\n4. **지각/불참 규정:** 당일 노쇼(No-Show) 시 식비 N분의 1 동일 부담`,
    },
  });

  // 샘플 멤버 4명 생성
  const m1 = await prisma.member.create({
    data: { name: '김총무', role: 'ADMIN', isActive: true },
  });
  const m2 = await prisma.member.create({
    data: { name: '이영희', role: 'MEMBER', isActive: true },
  });
  const m3 = await prisma.member.create({
    data: { name: '박철수', role: 'MEMBER', isActive: true },
  });
  const m4 = await prisma.member.create({
    data: { name: '최지훈', role: 'MEMBER', isActive: true },
  });

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

  // 샘플 일정 2개 생성
  const pastEvent = await prisma.event.create({
    data: {
      title: '봄맞이 정기 회식 & 볼링 모임',
      description: '오랜만에 모여서 삼겹살 먹고 볼링 한 게임 치는 날입니다!',
      location: 'https://map.kakao.com (강남역 삼겹살명가)',
      startAt: new Date(now.getFullYear(), now.getMonth() - 1, 15, 18, 30),
      endAt: new Date(now.getFullYear(), now.getMonth() - 1, 15, 22, 30),
    },
  });

  const upcomingEvent = await prisma.event.create({
    data: {
      title: `${currentYear} 하반기 가평 글램핑 워크숍`,
      description: '1박 2일 바베큐 파티 및 불멍 모임! 회비에서 숙박비 전액 지원됩니다.',
      location: 'https://map.naver.com (가평 별빛글램핑)',
      startAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 12),
      endAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 13),
    },
  });

  // RSVP 생성
  await prisma.eventRsvp.createMany({
    data: [
      { eventId: pastEvent.id, memberId: m1.id, status: 'ATTEND' },
      { eventId: pastEvent.id, memberId: m2.id, status: 'ATTEND' },
      { eventId: pastEvent.id, memberId: m3.id, status: 'ATTEND' },
      { eventId: pastEvent.id, memberId: m4.id, status: 'ABSENT' },
      { eventId: upcomingEvent.id, memberId: m1.id, status: 'ATTEND' },
      { eventId: upcomingEvent.id, memberId: m2.id, status: 'ATTEND' },
      { eventId: upcomingEvent.id, memberId: m3.id, status: 'MAYBE' },
    ],
  });

  // 전달 회비 전원 완납 + 이번 달 회비 3명 완납, 1명 미납
  const members = [m1, m2, m3, m4];
  for (const m of members) {
    await prisma.duesRecord.create({
      data: {
        year: prevYear,
        month: prevMonth,
        status: 'PAID',
        amount: monthlyFee,
        memberId: m.id,
      },
    });
    await prisma.transaction.create({
      data: {
        date: new Date(prevYear, prevMonth - 1, 25, 10, 0),
        type: 'INCOME',
        category: '회비',
        amount: monthlyFee,
        description: `${prevMonth}월 정기 회비 납부 (${m.name})`,
        memberId: m.id,
        sourceType: 'MANUAL',
        uniqueHash: `SEED-${prevYear}-${prevMonth}-${m.id}`,
      },
    });
  }

  for (const m of [m1, m2, m3]) {
    await prisma.duesRecord.create({
      data: {
        year: currentYear,
        month: currentMonth,
        status: 'PAID',
        amount: monthlyFee,
        memberId: m.id,
      },
    });
    await prisma.transaction.create({
      data: {
        date: new Date(currentYear, currentMonth - 1, 5, 14, 0),
        type: 'INCOME',
        category: '회비',
        amount: monthlyFee,
        description: `${currentMonth}월 정기 회비 납부 (${m.name})`,
        memberId: m.id,
        sourceType: 'MANUAL',
        uniqueHash: `SEED-${currentYear}-${currentMonth}-${m.id}`,
      },
    });
  }

  await prisma.duesRecord.create({
    data: {
      year: currentYear,
      month: currentMonth,
      status: 'UNPAID',
      amount: 0,
      memberId: m4.id,
    },
  });

  // 이자 수입 및 모임 지출 내역
  await prisma.transaction.create({
    data: {
      date: new Date(currentYear, currentMonth - 1, 1, 9, 0),
      type: 'INCOME',
      category: '이자',
      amount: 1450,
      description: '카카오뱅크 모임통장 결산 이자',
      sourceType: 'MANUAL',
    },
  });

  await prisma.transaction.create({
    data: {
      date: new Date(now.getFullYear(), now.getMonth() - 1, 15, 21, 0),
      type: 'EXPENSE',
      category: '식비',
      amount: 96000,
      description: '정기 회식 삼겹살 및 음료 결제',
      memberId: m1.id,
      eventId: pastEvent.id,
      sourceType: 'MANUAL',
    },
  });

  // 샘플 투표 생성
  const poll = await prisma.poll.create({
    data: {
      title: '이번 글램핑 워크숍 저녁 메인 메뉴 투표 🥩',
      allowMultiple: true,
      allowAddOption: true,
      isClosed: false,
      closesAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7),
      options: {
        create: [
          { text: '두툼한 한돈 목살 & 삼겹살 바베큐' },
          { text: '양갈비 프렌치랙 & 구운 야채' },
          { text: '대하 소금구이 & 조개탕' },
        ],
      },
    },
    include: { options: true },
  });

  await prisma.pollVote.createMany({
    data: [
      { optionId: poll.options[0].id, memberId: m1.id },
      { optionId: poll.options[0].id, memberId: m2.id },
      { optionId: poll.options[1].id, memberId: m2.id },
      { optionId: poll.options[2].id, memberId: m3.id },
    ],
  });

  // 샘플 앨범 생성
  await prisma.album.create({
    data: {
      title: '봄맞이 정기 회식 & 볼링 추억',
      eventId: pastEvent.id,
    },
  });

  await prisma.album.create({
    data: {
      title: `${currentYear} 가평 글램핑 답사 & 준비`,
      eventId: upcomingEvent.id,
    },
  });

  // 샘플 게시글 (공지 1건, 일반글 1건)
  const post1 = await prisma.post.create({
    data: {
      title: `[공지] ${currentYear}년 모임통장 회비 납부 및 정산 안내`,
      content:
        '안녕하세요 총무 김총무입니다! 매월 25일은 우리 모임 회비 납부일입니다. 홈 화면의 원클릭 계좌번호 복사 버튼을 눌러 편하게 입금해 주세요.',
      isNotice: true,
      likes: 4,
      authorId: m1.id,
    },
  });

  const post2 = await prisma.post.create({
    data: {
      title: '다음 글램핑 때 보드게임 가져갈까요?',
      content: '스플렌더랑 카탄 챙겨갈 수 있는데 같이 하실 분 댓글 남겨주세요!',
      isNotice: false,
      likes: 2,
      authorId: m2.id,
    },
  });

  await prisma.comment.createMany({
    data: [
      {
        postId: post1.id,
        authorId: m2.id,
        content: '총무님 늘 깔끔한 정산 감사합니다! 이번 달도 입금 완료했어요 :)',
      },
      {
        postId: post2.id,
        authorId: m3.id,
        content: '오 스플렌더 무조건 찬성입니다!!',
      },
    ],
  });

  console.log('초기 시드 데이터 생성이 완료되었습니다.');
}

main()
  .catch((e) => {
    console.error('Seed 오류:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
