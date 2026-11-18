import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AppProvider } from '@/components/AppContext';
import { AppShell } from '@/components/AppShell';

export const metadata: Metadata = {
  title: '모임포켓 (Moim-Pocket) | 계모임통장 & 커뮤니티 대시보드',
  description:
    '카카오뱅크 모임통장 기반 계모임의 회비 납부 현황, 입출금 장부, 일정, 투표, 사진 갤러리, 회칙/게시판을 한곳에서 관리하는 반응형 웹 대시보드',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
