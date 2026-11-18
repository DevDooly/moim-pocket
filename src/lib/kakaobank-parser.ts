import crypto from 'crypto';
import JSZip from 'jszip';
import { prisma, ensureGroupSetting } from './prisma';

export interface ParsedKakaoTx {
  dateStr: string;
  date: Date;
  rawType: string; // "입금" | "출금"
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  balanceAfter: number;
  txSubType: string; // "일반입금", "오픈뱅킹", "일반이체", "예금이자" 등
  counterparty: string; // "내용" 컬럼 (예: 정진우, 김선홍, 입출금통장 이자)
  memo: string;
  category: string;
  description: string;
  uniqueHash: string;
}

export interface ParsedKakaoExport {
  accountHolder: string;
  accountNumber: string;
  period: string;
  requestedAt: string;
  transactions: ParsedKakaoTx[];
}

// 1. OLE2 (CFB) 스트림 추출기
function extractOleStreams(buf: Buffer): Record<string, Buffer> {
  const sectorShift = buf.readUInt16LE(30);
  const sectorSize = 1 << sectorShift;
  const miniSectorShift = buf.readUInt16LE(32);
  const miniSectorSize = 1 << miniSectorShift;
  const firstDirSector = buf.readUInt32LE(48);
  const miniStreamCutoff = buf.readUInt32LE(56);
  const firstMiniFatSector = buf.readUInt32LE(60);
  const firstDifatSector = buf.readUInt32LE(68);
  const numDifatSectors = buf.readUInt32LE(72);

  const difat: number[] = [];
  for (let i = 0; i < 109; i++) {
    const sec = buf.readUInt32LE(76 + i * 4);
    if (sec < 0xfffffffe) difat.push(sec);
  }
  let nextDifat = firstDifatSector;
  for (let d = 0; d < numDifatSectors && nextDifat < 0xfffffffe; d++) {
    const offset = (nextDifat + 1) * sectorSize;
    const entriesPerSector = sectorSize / 4 - 1;
    for (let i = 0; i < entriesPerSector; i++) {
      const sec = buf.readUInt32LE(offset + i * 4);
      if (sec < 0xfffffffe) difat.push(sec);
    }
    nextDifat = buf.readUInt32LE(offset + entriesPerSector * 4);
  }

  const fat: number[] = [];
  for (const fatSec of difat) {
    const offset = (fatSec + 1) * sectorSize;
    for (let i = 0; i < sectorSize / 4; i++) {
      if (offset + i * 4 + 4 <= buf.length) {
        fat.push(buf.readUInt32LE(offset + i * 4));
      }
    }
  }

  function readChain(startSec: number, size?: number): Buffer {
    const chunks: Buffer[] = [];
    let sec = startSec;
    let guard = 0;
    while (sec < 0xfffffffe && guard < 100000) {
      const offset = (sec + 1) * sectorSize;
      chunks.push(buf.subarray(offset, offset + sectorSize));
      sec = fat[sec] ?? 0xffffffff;
      guard++;
    }
    const full = Buffer.concat(chunks);
    return size !== undefined ? full.subarray(0, size) : full;
  }

  const dirStream = readChain(firstDirSector);
  const entries: { name: string; type: number; startSec: number; size: number }[] = [];
  for (let offset = 0; offset + 128 <= dirStream.length; offset += 128) {
    const nameLen = dirStream.readUInt16LE(offset + 64);
    if (nameLen === 0) continue;
    const name = dirStream.subarray(offset, offset + nameLen - 2).toString('utf16le');
    const type = dirStream[offset + 66];
    const startSec = dirStream.readUInt32LE(offset + 116);
    const size = dirStream.readUInt32LE(offset + 120);
    entries.push({ name, type, startSec, size });
  }

  const root = entries.find((e) => e.type === 5);
  const miniStream =
    root && root.startSec < 0xfffffffe
      ? readChain(root.startSec, root.size)
      : Buffer.alloc(0);
  const miniFatStream =
    firstMiniFatSector < 0xfffffffe ? readChain(firstMiniFatSector) : Buffer.alloc(0);
  const miniFat: number[] = [];
  for (let i = 0; i + 4 <= miniFatStream.length; i += 4) {
    miniFat.push(miniFatStream.readUInt32LE(i));
  }

  function readMiniChain(startSec: number, size: number): Buffer {
    const chunks: Buffer[] = [];
    let sec = startSec;
    let guard = 0;
    while (sec < 0xfffffffe && guard < 100000) {
      const offset = sec * miniSectorSize;
      chunks.push(miniStream.subarray(offset, offset + miniSectorSize));
      sec = miniFat[sec] ?? 0xffffffff;
      guard++;
    }
    return Buffer.concat(chunks).subarray(0, size);
  }

  const result: Record<string, Buffer> = {};
  for (const e of entries) {
    if (e.type === 2) {
      result[e.name] =
        e.size < miniStreamCutoff
          ? readMiniChain(e.startSec, e.size)
          : readChain(e.startSec, e.size);
    }
  }
  return result;
}

// 2. MS-OFFCRYPTO Agile Encryption 복호화기
function decryptAgileEncryption(
  encInfoBuf: Buffer,
  encPkgBuf: Buffer,
  password: string
): Buffer {
  const xml = encInfoBuf.subarray(8).toString('utf8');
  const getAttr = (tag: string, attr: string) => {
    const m = xml.match(new RegExp(`<${tag}[^>]*\\b${attr}="([^"]+)"`));
    return m ? m[1] : null;
  };

  const keyDataSalt = Buffer.from(getAttr('keyData', 'saltValue') || '', 'base64');
  const keyDataBlockSize = Number(getAttr('keyData', 'blockSize') || 16);
  const keyDataHashAlg = (getAttr('keyData', 'hashAlgorithm') || 'SHA1')
    .toLowerCase()
    .replace('-', '');

  const spinCount = Number(getAttr('p:encryptedKey', 'spinCount') || 100000);
  const pwSalt = Buffer.from(getAttr('p:encryptedKey', 'saltValue') || '', 'base64');
  const pwKeyBits = Number(getAttr('p:encryptedKey', 'keyBits') || 128);
  const pwHashAlg = (getAttr('p:encryptedKey', 'hashAlgorithm') || 'SHA1')
    .toLowerCase()
    .replace('-', '');

  const encryptedVerifierHashInput = Buffer.from(
    getAttr('p:encryptedKey', 'encryptedVerifierHashInput') || '',
    'base64'
  );
  const encryptedVerifierHashValue = Buffer.from(
    getAttr('p:encryptedKey', 'encryptedVerifierHashValue') || '',
    'base64'
  );
  const encryptedKeyValue = Buffer.from(
    getAttr('p:encryptedKey', 'encryptedKeyValue') || '',
    'base64'
  );

  const hash = (alg: string, data: Buffer) => crypto.createHash(alg).update(data).digest();

  const pwBuf = Buffer.from(String(password), 'utf16le');
  let h = hash(pwHashAlg, Buffer.concat([pwSalt, pwBuf]));
  const iterBuf = Buffer.alloc(4);
  for (let i = 0; i < spinCount; i++) {
    iterBuf.writeUInt32LE(i, 0);
    h = hash(pwHashAlg, Buffer.concat([iterBuf, h]));
  }

  const deriveKey = (blockKey: Buffer) => {
    let d = hash(pwHashAlg, Buffer.concat([h, blockKey]));
    const keyLen = pwKeyBits / 8;
    return d.length < keyLen
      ? Buffer.concat([d, Buffer.alloc(keyLen - d.length, 0x36)])
      : d.subarray(0, keyLen);
  };

  const aesDecrypt = (data: Buffer, key: Buffer, iv: Buffer) => {
    const decipher = crypto.createDecipheriv(
      `aes-${key.length * 8}-cbc`,
      key,
      iv.subarray(0, 16)
    );
    decipher.setAutoPadding(false);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  };

  // 비밀번호 검증
  const blockKeyVerifierInput = Buffer.from([0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79]);
  const blockKeyVerifierValue = Buffer.from([0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e]);
  const blockKeyEncryptedKey = Buffer.from([0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6]);

  const verifierInput = aesDecrypt(
    encryptedVerifierHashInput,
    deriveKey(blockKeyVerifierInput),
    pwSalt
  );
  const verifierHash = aesDecrypt(
    encryptedVerifierHashValue,
    deriveKey(blockKeyVerifierValue),
    pwSalt
  );
  const actualHash = hash(pwHashAlg, verifierInput);

  if (!actualHash.equals(verifierHash.subarray(0, actualHash.length))) {
    throw new Error('엑셀 파일 비밀번호가 일치하지 않습니다. (생년월일 6자리 등을 확인해주세요)');
  }

  const secretKey = aesDecrypt(encryptedKeyValue, deriveKey(blockKeyEncryptedKey), pwSalt);
  const totalSize = Number(encPkgBuf.readBigUInt64LE(0));
  const encryptedData = encPkgBuf.subarray(8);
  const decryptedChunks: Buffer[] = [];

  for (let i = 0, offset = 0; offset < encryptedData.length; i++, offset += 4096) {
    const seg = encryptedData.subarray(offset, offset + 4096);
    const segIdxBuf = Buffer.alloc(4);
    segIdxBuf.writeUInt32LE(i, 0);
    let iv = hash(keyDataHashAlg, Buffer.concat([keyDataSalt, segIdxBuf]));
    iv =
      iv.length < keyDataBlockSize
        ? Buffer.concat([iv, Buffer.alloc(keyDataBlockSize - iv.length, 0x36)])
        : iv.subarray(0, keyDataBlockSize);
    decryptedChunks.push(aesDecrypt(seg, secretKey, iv));
  }

  return Buffer.concat(decryptedChunks).subarray(0, totalSize);
}

// 3. XLSX XML 시트 파서
function parseSheetXml(sheetXml: string, sharedStringsXml: string): string[][] {
  const shared: string[] = [];
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let m: RegExpExecArray | null;
  while ((m = siRegex.exec(sharedStringsXml)) !== null) {
    const texts: string[] = [];
    const tRegex = /<t(?:\s+[^>]*)?\/>|<t(?:\s+[^>]*)?>([\s\S]*?)<\/t>/g;
    let tm: RegExpExecArray | null;
    while ((tm = tRegex.exec(m[1])) !== null) {
      texts.push(tm[1] || '');
    }
    shared.push(texts.join(''));
  }

  const colToIndex = (colStr: string) => {
    let n = 0;
    for (let i = 0; i < colStr.length; i++) {
      n = n * 26 + (colStr.charCodeAt(i) - 64);
    }
    return n - 1;
  };

  const rows: string[][] = [];
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rm: RegExpExecArray | null;
  while ((rm = rowRegex.exec(sheetXml)) !== null) {
    const rowCells: string[] = [];
    const cellRegex = /<c\b([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g;
    let cm: RegExpExecArray | null;
    while ((cm = cellRegex.exec(rm[1])) !== null) {
      const attrs = cm[1];
      const inner = cm[3] || '';
      const refMatch = attrs.match(/\br="([A-Z]+)\d+"/);
      const typeMatch = attrs.match(/\bt="([^"]+)"/);
      const colIdx = refMatch ? colToIndex(refMatch[1]) : rowCells.length;
      const cellType = typeMatch ? typeMatch[1] : '';
      let val = '';
      if (cellType === 's') {
        const vm = inner.match(/<v>(\d+)<\/v>/);
        if (vm) val = shared[Number(vm[1])] || '';
      } else if (cellType === 'inlineStr') {
        const tm = inner.match(/<t[^>]*>([\s\S]*?)<\/t>/);
        if (tm) val = tm[1];
      } else {
        const vm = inner.match(/<v>([\s\S]*?)<\/v>/);
        if (vm) val = vm[1];
      }
      rowCells[colIdx] = val.trim();
    }
    if (rowCells.some((c) => c !== undefined && c !== '')) {
      rows.push(rowCells);
    }
  }
  return rows;
}

// 4. 카카오뱅크 엑셀/CSV 버퍼 통합 파싱 함수
export async function parseKakaoBankFile(
  fileBuf: Buffer,
  password = ''
): Promise<ParsedKakaoExport> {
  let rows: string[][] = [];

  // (A) OLE2 암호화 엑셀 (0xD0CF11E0)
  if (
    fileBuf.length > 8 &&
    fileBuf.readUInt32LE(0) === 0xe011cfd0 &&
    fileBuf.readUInt32LE(4) === 0xe11ab1a1
  ) {
    const streams = extractOleStreams(fileBuf);
    if (!streams['EncryptionInfo'] || !streams['EncryptedPackage']) {
      throw new Error('지원하지 않는 암호화 엑셀 형식입니다.');
    }
    const zipBuf = decryptAgileEncryption(
      streams['EncryptionInfo'],
      streams['EncryptedPackage'],
      password
    );
    const zip = await JSZip.loadAsync(zipBuf);
    const sharedStringsXml = zip.file('xl/sharedStrings.xml')
      ? await zip.file('xl/sharedStrings.xml')!.async('string')
      : '';
    const sheetFile =
      zip.file('xl/worksheets/sheet1.xml') ||
      Object.values(zip.files).find((f) => f.name.startsWith('xl/worksheets/sheet'));
    if (!sheetFile) {
      throw new Error('엑셀 워크시트를 찾을 수 없습니다.');
    }
    const sheetXml = await sheetFile.async('string');
    rows = parseSheetXml(sheetXml, sharedStringsXml);
  }
  // (B) 일반 비암호화 .xlsx (PK\x03\x04)
  else if (fileBuf.length > 4 && fileBuf[0] === 0x50 && fileBuf[1] === 0x4b) {
    const zip = await JSZip.loadAsync(fileBuf);
    const sharedStringsXml = zip.file('xl/sharedStrings.xml')
      ? await zip.file('xl/sharedStrings.xml')!.async('string')
      : '';
    const sheetFile =
      zip.file('xl/worksheets/sheet1.xml') ||
      Object.values(zip.files).find((f) => f.name.startsWith('xl/worksheets/sheet'));
    if (!sheetFile) {
      throw new Error('엑셀 워크시트를 찾을 수 없습니다.');
    }
    const sheetXml = await sheetFile.async('string');
    rows = parseSheetXml(sheetXml, sharedStringsXml);
  }
  // (C) CSV 텍스트
  else {
    const text = fileBuf.toString('utf8');
    rows = text
      .split(/\r?\n/)
      .map((line) => line.split(',').map((c) => c.trim().replace(/^"|"$/g, '')))
      .filter((r) => r.some(Boolean));
  }

  let accountHolder = '';
  let accountNumber = '';
  let period = '';
  let requestedAt = '';
  let headerRowIdx = -1;
  let colMap = {
    date: 1,
    type: 2,
    amount: 3,
    balance: 4,
    subType: 5,
    content: 6,
    memo: 7,
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    for (let c = 0; c < r.length; c++) {
      if (r[c] === '성명' && r[c + 1]) accountHolder = r[c + 1];
      if (r[c] === '조회기간' && r[c + 1]) period = r[c + 1];
      if (r[c] === '계좌번호' && r[c + 1]) accountNumber = r[c + 1];
      if (r[c] === '요청일시' && r[c + 1]) requestedAt = r[c + 1];
    }
    if (r.includes('거래일시') && r.includes('거래금액')) {
      headerRowIdx = i;
      colMap = {
        date: r.indexOf('거래일시'),
        type: r.indexOf('구분'),
        amount: r.indexOf('거래금액'),
        balance: r.indexOf('거래 후 잔액'),
        subType: r.indexOf('거래구분'),
        content: r.indexOf('내용'),
        memo: r.indexOf('메모'),
      };
      break;
    }
  }

  if (headerRowIdx === -1) {
    throw new Error('카카오뱅크 거래내역 헤더(거래일시, 거래금액)를 찾을 수 없습니다.');
  }

  const transactions: ParsedKakaoTx[] = [];
  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const dateStr = (r[colMap.date] || '').trim();
    if (!dateStr || !/^\d{4}[.\-/]\d{2}[.\-/]\d{2}/.test(dateStr)) continue;

    const rawType = (r[colMap.type] || '').trim();
    const rawAmountStr = (r[colMap.amount] || '0').replace(/[^0-9-]/g, '');
    const signedAmount = parseInt(rawAmountStr || '0', 10);
    const amount = Math.abs(signedAmount);

    const rawBalanceStr = (r[colMap.balance] || '0').replace(/[^0-9-]/g, '');
    const balanceAfter = parseInt(rawBalanceStr || '0', 10);

    const txSubType = (r[colMap.subType] || '').trim();
    const counterparty = (r[colMap.content] || '').trim();
    const memo = (r[colMap.memo] || '').trim();

    const isIncome = rawType.includes('입금') || signedAmount > 0;
    const type: 'INCOME' | 'EXPENSE' = isIncome ? 'INCOME' : 'EXPENSE';

    // 날짜 파싱 ("2026.10.19 08:01:35" -> ISO)
    const normalizedDate = dateStr.replace(/\./g, '-').replace(' ', 'T') + '+09:00';
    const parsedDate = new Date(normalizedDate);

    // 카테고리 자동 분류
    let category = isIncome ? '회비' : '운영비';
    if (txSubType.includes('이자') || counterparty.includes('이자')) {
      category = '이자/기타수입';
    } else if (!isIncome) {
      if (memo.includes('식비') || memo.includes('회식') || counterparty.includes('식당')) {
        category = '식비';
      } else if (memo.includes('숙박') || memo.includes('여행')) {
        category = '숙박/여행';
      } else if (memo.includes('경조') || memo.includes('축의') || memo.includes('조의')) {
        category = '경조사';
      }
    }

    const description = memo
      ? `${counterparty} (${txSubType} · ${memo})`
      : `${counterparty} (${txSubType})`;

    const rawHashSource = `KAKAOBANK|${dateStr}|${rawType}|${signedAmount}|${balanceAfter}|${counterparty}`;
    const uniqueHash =
      'KB-' + crypto.createHash('sha256').update(rawHashSource).digest('hex').slice(0, 24);

    transactions.push({
      dateStr,
      date: isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
      rawType,
      type,
      amount,
      balanceAfter,
      txSubType,
      counterparty,
      memo,
      category,
      description,
      uniqueHash,
    });
  }

  return {
    accountHolder,
    accountNumber,
    period,
    requestedAt,
    transactions,
  };
}

// 5. 파싱된 카카오뱅크 내역을 DB에 반영 (멤버 자동 매칭/생성 + 회비 매트릭스 자동 완납 처리)
export async function importKakaoTransactionsToDb(
  parsed: ParsedKakaoExport,
  options: {
    autoRegisterMembers?: boolean;
    skipZeroAmount?: boolean;
  } = {}
) {
  const { autoRegisterMembers = true, skipZeroAmount = true } = options;
  const setting = await ensureGroupSetting();

  // 계좌번호가 비어있거나 기본값이면 엑셀 헤더의 계좌 정보 업데이트 가능
  if (parsed.accountNumber && parsed.accountHolder) {
    const accLabel = `카카오뱅크 ${parsed.accountNumber} (${parsed.accountHolder})`;
    if (!setting.bankAccount || setting.bankAccount.includes('3333-01-2345678')) {
      await prisma.groupSetting.update({
        where: { id: 'default' },
        data: { bankAccount: accLabel },
      });
    }
  }

  let allMembers = await prisma.member.findMany();
  const findOrCreateMember = async (name: string, isOwner = false) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const existing = allMembers.find((m) => m.name === trimmed);
    if (existing) return existing;

    // 한국인 실명 형태(2~4글자 한글)이고 이자/통장 등 키워드가 아닐 때만 자동 등록
    const isPersonName =
      /^[가-힣]{2,4}$/.test(trimmed) &&
      !['예금이자', '일반입금', '일반이체', '오픈뱅킹', '체크카드', '모임통장'].includes(trimmed);

    if (autoRegisterMembers && isPersonName) {
      const created = await prisma.member.create({
        data: {
          name: trimmed,
          role: isOwner ? 'ADMIN' : 'MEMBER',
          isActive: true,
        },
      });
      allMembers.push(created);
      return created;
    }
    return null;
  };

  if (parsed.accountHolder) {
    await findOrCreateMember(parsed.accountHolder, true);
  }

  let insertedCount = 0;
  let skippedCount = 0;
  const newMembersSet = new Set<string>();

  // 오래된 거래부터 시간순 정렬하여 저장
  const sortedTxs = [...parsed.transactions].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  for (const item of sortedTxs) {
    if (skipZeroAmount && item.amount === 0) {
      skippedCount++;
      continue;
    }

    const exists = await prisma.transaction.findUnique({
      where: { uniqueHash: item.uniqueHash },
    });
    if (exists) {
      skippedCount++;
      continue;
    }

    const beforeCount = allMembers.length;
    const matchedMember = await findOrCreateMember(item.counterparty, false);
    if (allMembers.length > beforeCount && matchedMember) {
      newMembersSet.add(matchedMember.name);
    }

    await prisma.transaction.create({
      data: {
        date: item.date,
        type: item.type,
        category: item.category,
        amount: item.amount,
        description: item.description,
        memberId: matchedMember?.id || null,
        sourceType: 'CSV',
        uniqueHash: item.uniqueHash,
      },
    });
    insertedCount++;

    // 입금 내역이고 매칭된 멤버가 있으면 해당 연/월 회비 납부(PAID) 자동 반영
    if (item.type === 'INCOME' && matchedMember && item.amount > 0) {
      const y = item.date.getFullYear();
      const m = item.date.getMonth() + 1;
      const existingDues = await prisma.duesRecord.findUnique({
        where: {
          year_month_memberId: {
            year: y,
            month: m,
            memberId: matchedMember.id,
          },
        },
      });

      const nextAmount = (existingDues?.amount || 0) + item.amount;
      await prisma.duesRecord.upsert({
        where: {
          year_month_memberId: {
            year: y,
            month: m,
            memberId: matchedMember.id,
          },
        },
        update: {
          status: 'PAID',
          amount: nextAmount,
        },
        create: {
          year: y,
          month: m,
          status: 'PAID',
          amount: item.amount,
          memberId: matchedMember.id,
        },
      });
    }
  }

  return {
    accountHolder: parsed.accountHolder,
    accountNumber: parsed.accountNumber,
    period: parsed.period,
    totalParsed: parsed.transactions.length,
    insertedCount,
    skippedCount,
    newlyRegisteredMembers: Array.from(newMembersSet),
  };
}
