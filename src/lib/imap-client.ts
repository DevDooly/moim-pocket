import tls from 'tls';

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

export interface ExtractedAttachment {
  filename: string;
  buffer: Buffer;
  subject: string;
}

/**
 * 순수 Node.js TLS 기반 경량 IMAP 첨부파일 추출 클라이언트
 * 최근 메일 중 .xlsx 첨부파일(카카오뱅크 거래내역)을 찾아 디코딩 후 반환합니다.
 */
export async function fetchLatestKakaoExcelFromImap(
  config: ImapConfig
): Promise<ExtractedAttachment> {
  const { host, port = 993, user, pass } = config;
  if (!host || !user || !pass) {
    throw new Error('IMAP 호스트, 이메일 계정, 앱 비밀번호를 모두 설정해주세요.');
  }

  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host, port, rejectUnauthorized: false },
      () => {}
    );

    let buffer = '';
    let step = 0;
    let totalMessages = 0;
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('IMAP 서버 응답 시간이 초과되었습니다 (15초).'));
    }, 15000);

    const sendCmd = (tag: string, cmd: string) => {
      socket.write(`${tag} ${cmd}\r\n`);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      try {
        socket.end();
      } catch {}
    };

    socket.on('error', (err) => {
      cleanup();
      reject(new Error(`IMAP 연결 실패: ${err.message}`));
    });

    socket.on('data', (chunk) => {
      buffer += chunk.toString('latin1');

      if (step === 0 && buffer.includes('\r\n')) {
        buffer = '';
        step = 1;
        const safeUser = user.replace(/"/g, '\\"');
        const safePass = pass.replace(/"/g, '\\"');
        sendCmd('A1', `LOGIN "${safeUser}" "${safePass}"`);
        return;
      }

      if (step === 1) {
        if (buffer.includes('A1 OK')) {
          buffer = '';
          step = 2;
          sendCmd('A2', 'SELECT INBOX');
        } else if (buffer.includes('A1 NO') || buffer.includes('A1 BAD')) {
          cleanup();
          reject(
            new Error(
              '이메일 로그인에 실패했습니다. 아이디와 앱 비밀번호(또는 IMAP 사용 설정)를 확인해주세요.'
            )
          );
        }
        return;
      }

      if (step === 2) {
        if (buffer.includes('A2 OK')) {
          const existsMatch = buffer.match(/\*\s+(\d+)\s+EXISTS/i);
          totalMessages = existsMatch ? parseInt(existsMatch[1], 10) : 0;
          if (totalMessages === 0) {
            cleanup();
            reject(new Error('받은편지함(INBOX)에 메일이 없습니다.'));
            return;
          }
          buffer = '';
          step = 3;
          const startSeq = Math.max(1, totalMessages - 14);
          sendCmd('A3', `FETCH ${startSeq}:${totalMessages} (BODY.PEEK[])`);
        } else if (buffer.includes('A2 NO') || buffer.includes('A2 BAD')) {
          cleanup();
          reject(new Error('INBOX 선택에 실패했습니다.'));
        }
        return;
      }

      if (step === 3) {
        if (buffer.includes('A3 OK') || buffer.includes('A3 NO') || buffer.includes('A3 BAD')) {
          const rawAll = buffer;
          sendCmd('A4', 'LOGOUT');
          cleanup();

          const extracted = extractXlsxFromRawMime(rawAll);
          if (!extracted) {
            reject(
              new Error(
                '최근 15통의 메일 중 카카오뱅크 엑셀(.xlsx) 첨부파일을 찾지 못했습니다.'
              )
            );
          } else {
            resolve(extracted);
          }
        }
      }
    });
  });
}

function decodeMimeWord(str: string): string {
  return str.replace(/=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g, (_m, charset, enc, text) => {
    try {
      if (enc.toUpperCase() === 'B') {
        return Buffer.from(text, 'base64').toString('utf8');
      }
      const qp = text
        .replace(/_/g, ' ')
        .replace(/=([0-9A-Fa-f]{2})/g, (_: string, hex: string) =>
          String.fromCharCode(parseInt(hex, 16))
        );
      return Buffer.from(qp, 'binary').toString('utf8');
    } catch {
      return text;
    }
  });
}

function extractXlsxFromRawMime(raw: string): ExtractedAttachment | null {
  // MIME 파트 중 .xlsx 첨부 파트 탐색 (가장 최근 매치 우선)
  const parts = raw.split(/--[^\r\n]+/);
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;

    const headerRaw = part.slice(0, headerEnd);
    const decodedHeader = decodeMimeWord(headerRaw);

    const isXlsx =
      /\.xlsx/i.test(decodedHeader) ||
      /filename\*=UTF-8''[^\r\n]*\.xlsx/i.test(headerRaw) ||
      /application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet/i.test(
        headerRaw
      );

    if (!isXlsx) continue;
    if (!/Content-Transfer-Encoding:\s*base64/i.test(headerRaw)) continue;

    const bodyRaw = part.slice(headerEnd + 4);
    const base64Clean = bodyRaw
      .split(/\r?\n/)
      .filter((line) => /^[A-Za-z0-9+/=]+$/.test(line.trim()))
      .join('');

    if (base64Clean.length < 200) continue;

    let filename = 'kakaobank_export.xlsx';
    const fnMatch = decodedHeader.match(/filename="?([^";\r\n]+\.xlsx)"?/i);
    if (fnMatch) {
      filename = fnMatch[1].trim();
    }

    return {
      filename,
      buffer: Buffer.from(base64Clean, 'base64'),
      subject: filename,
    };
  }
  return null;
}
