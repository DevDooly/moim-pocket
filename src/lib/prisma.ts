import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function ensureGroupSetting() {
  const defaultName = process.env.GROUP_NAME || '우리계모임';
  const defaultFee = Number(process.env.MONTHLY_FEE || 30000);

  let setting = await prisma.groupSetting.findUnique({
    where: { id: 'default' },
  });

  if (!setting) {
    setting = await prisma.groupSetting.create({
      data: {
        id: 'default',
        groupName: defaultName,
        bankAccount: '카카오뱅크 3333-01-2345678',
        monthlyFee: defaultFee,
        rulesMarkdown: `### 📌 ${defaultName} 회칙 안내\n\n1. 매월 25일 회비 ${defaultFee.toLocaleString()}원 납부\n2. 모임 지출 시 영수증 첨부 필수`,
      },
    });
  }

  return setting;
}
