import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { prisma, ensureGroupSetting } from '@/lib/prisma';
import {
  parseKakaoBankFile,
  importKakaoTransactionsToDb,
} from '@/lib/kakaobank-parser';
import { fetchLatestKakaoExcelFromImap } from '@/lib/imap-client';

export const dynamic = 'force-dynamic';

function findSampleExcelPath(): string | null {
  const candidates = [
    path.join(process.cwd(), '카카오뱅크_거래내역_N0402748125_2026111819260112.xlsx'),
    '/app/data/카카오뱅크_거래내역_N0402748125_2026111819260112.xlsx',
    path.join(process.cwd(), 'data', '카카오뱅크_거래내역_N0402748125_2026111819260112.xlsx'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }

  // 혹은 폴더 내 카카오뱅크_거래내역*.xlsx 탐색
  for (const dir of [process.cwd(), '/app/data', path.join(process.cwd(), 'data')]) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    const match = files.find((f) => f.startsWith('카카오뱅크_거래내역') && f.endsWith('.xlsx'));
    if (match) return path.join(dir, match);
  }
  return null;
}

export async function GET() {
  try {
    const setting = await ensureGroupSetting();
    const samplePath = findSampleExcelPath();

    return NextResponse.json({
      hasSampleFile: Boolean(samplePath),
      sampleFileName: samplePath ? path.basename(samplePath) : null,
      excelPassword: setting.excelPassword || '890803',
      imapHost: setting.imapHost || 'imap.naver.com',
      imapPort: setting.imapPort || 993,
      imapUser: setting.imapUser || '',
      hasImapPass: Boolean(setting.imapPass),
    });
  } catch (error) {
    console.error('Kakao import GET error:', error);
    return NextResponse.json({ error: '설정 조회 실패' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const setting = await ensureGroupSetting();
    const contentType = req.headers.get('content-type') || '';

    // 1. multipart/form-data (웹에서 직접 엑셀/CSV 파일 업로드)
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const password = String(
        formData.get('password') ?? setting.excelPassword ?? '890803'
      ).trim();
      const autoRegisterMembers = formData.get('autoRegisterMembers') !== 'false';

      if (!file) {
        return NextResponse.json({ error: '업로드할 엑셀 파일을 선택해주세요.' }, { status: 400 });
      }

      const fileBuf = Buffer.from(await file.arrayBuffer());
      const parsed = await parseKakaoBankFile(fileBuf, password);
      const result = await importKakaoTransactionsToDb(parsed, {
        autoRegisterMembers,
      });

      if (password && password !== setting.excelPassword) {
        await prisma.groupSetting.update({
          where: { id: 'default' },
          data: { excelPassword: password },
        });
      }

      return NextResponse.json({
        ok: true,
        source: 'FILE_UPLOAD',
        filename: file.name,
        ...result,
      });
    }

    // 2. application/json (서버 샘플 파일 가져오기 / IMAP 이메일 가져오기 / 외부 웹훅)
    const body = await req.json();
    const { mode } = body;
    const password = String(body.password ?? setting.excelPassword ?? '890803').trim();
    const autoRegisterMembers = body.autoRegisterMembers !== false;

    // (A) 프로젝트 폴더 내 예시 파일(카카오뱅크_거래내역_N0402748125_2026111819260112.xlsx) 즉시 가져오기
    if (mode === 'sample') {
      const samplePath = findSampleExcelPath();
      if (!samplePath) {
        return NextResponse.json(
          { error: '서버에서 예시 엑셀 파일을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      const fileBuf = fs.readFileSync(samplePath);
      const parsed = await parseKakaoBankFile(fileBuf, password);
      const result = await importKakaoTransactionsToDb(parsed, {
        autoRegisterMembers,
      });

      return NextResponse.json({
        ok: true,
        source: 'SAMPLE_FILE',
        filename: path.basename(samplePath),
        ...result,
      });
    }

    // (B) 이메일(IMAP) 메일함에서 최신 카카오뱅크 엑셀 첨부파일 자동 수신 및 반영
    if (mode === 'imap') {
      const host = String(body.imapHost ?? setting.imapHost ?? 'imap.naver.com').trim();
      const port = Number(body.imapPort ?? setting.imapPort ?? 993);
      const user = String(body.imapUser ?? setting.imapUser ?? '').trim();
      const pass = String(body.imapPass || setting.imapPass || '').trim();

      if (body.saveConfig) {
        await prisma.groupSetting.update({
          where: { id: 'default' },
          data: {
            excelPassword: password,
            imapHost: host,
            imapPort: port,
            imapUser: user,
            imapPass: pass || setting.imapPass,
          },
        });
      }

      const attachment = await fetchLatestKakaoExcelFromImap({
        host,
        port,
        user,
        pass,
      });

      const parsed = await parseKakaoBankFile(attachment.buffer, password);
      const result = await importKakaoTransactionsToDb(parsed, {
        autoRegisterMembers,
      });

      return NextResponse.json({
        ok: true,
        source: 'IMAP_EMAIL',
        filename: attachment.filename,
        ...result,
      });
    }

    // (C) IMAP 설정만 저장
    if (mode === 'save_config') {
      const updated = await prisma.groupSetting.update({
        where: { id: 'default' },
        data: {
          excelPassword: password,
          imapHost: body.imapHost !== undefined ? String(body.imapHost).trim() : undefined,
          imapPort: body.imapPort !== undefined ? Number(body.imapPort) : undefined,
          imapUser: body.imapUser !== undefined ? String(body.imapUser).trim() : undefined,
          imapPass:
            body.imapPass && String(body.imapPass).trim()
              ? String(body.imapPass).trim()
              : undefined,
        },
      });
      return NextResponse.json({ ok: true, setting: updated });
    }

    // (D) 외부 이메일 웹훅 (Base64 첨부파일 수신)
    if (mode === 'webhook' && body.base64File) {
      const fileBuf = Buffer.from(String(body.base64File), 'base64');
      const parsed = await parseKakaoBankFile(fileBuf, password);
      const result = await importKakaoTransactionsToDb(parsed, {
        autoRegisterMembers,
      });

      return NextResponse.json({
        ok: true,
        source: 'EMAIL_WEBHOOK',
        filename: body.filename || 'webhook_kakaobank.xlsx',
        ...result,
      });
    }

    return NextResponse.json({ error: '지원하지 않는 요청 모드입니다.' }, { status: 400 });
  } catch (error: any) {
    console.error('Kakao import POST error:', error);
    return NextResponse.json(
      { error: error?.message || '카카오뱅크 엑셀 처리 중 오류가 발생했습니다.' },
      { status: 400 }
    );
  }
}
