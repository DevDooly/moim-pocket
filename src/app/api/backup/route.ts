import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import { getSqliteDbPath } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const dbPath = getSqliteDbPath();

    if (!fs.existsSync(dbPath)) {
      return NextResponse.json(
        { error: `데이터베이스 파일(${dbPath})을 찾을 수 없습니다.` },
        { status: 404 }
      );
    }

    const buffer = fs.readFileSync(dbPath);
    const dateStr = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="gyemoim-backup-${dateStr}.db"`,
      },
    });
  } catch (error) {
    console.error('Backup download error:', error);
    return NextResponse.json({ error: '백업 파일 다운로드에 실패했습니다.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '복원할 SQLite DB 파일을 선택해주세요.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // SQLite 매직 헤더 검증 ("SQLite format 3")
    const header = buffer.subarray(0, 15).toString('utf-8');
    if (!header.startsWith('SQLite format 3')) {
      return NextResponse.json(
        { error: '유효한 SQLite 데이터베이스(.db) 파일이 아닙니다.' },
        { status: 400 }
      );
    }

    const dbPath = getSqliteDbPath();
    fs.writeFileSync(dbPath, buffer);

    return NextResponse.json({ ok: true, message: '데이터베이스 복원이 완료되었습니다.' });
  } catch (error) {
    console.error('Backup restore error:', error);
    return NextResponse.json({ error: '데이터베이스 복원에 실패했습니다.' }, { status: 500 });
  }
}
