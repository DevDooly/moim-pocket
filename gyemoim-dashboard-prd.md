# 계모임통장 & 커뮤니티 관리 대시보드 개발 명세서 (PRD)


## 1. 프로젝트 개요

- **목적:** 카카오뱅크 모임통장 기반 계모임의 회비 납부 현황, 입출금 장부, 일정, 투표, 사진 갤러리, 회칙/게시판을 한곳에서 관리하는 **모바일 퍼스트(Mobile-First) 웹 대시보드** 구축.
- **핵심 원칙:**
  **초경량 단일 컨테이너 배포:** 별도의 외부 DB 서버나 클라우드 스토리지 없이, Docker 컨테이너 1개(`docker-compose up -d`)와 로컬 볼륨 마운트만으로 즉시 실행 및 데이터 영속성 보장.
  **진입장벽 제로 UX:** 카카오톡 공유 링크로 접속 시 복잡한 회원가입 없이 `모임 입장 코드(PIN)` 입력 후 본인 이름을 선택해 바로 사용.
  **확장 가능한 장부 구조:** 초기에는 총무의 수기 입력(단건 및 일괄 회비 체크)으로 운영하되, 추후 카카오뱅크 CSV 업로드 및 내역 캡처 OCR 연동을 붙일 수 있도록 DB 스키마를 미리 설계.

## 2. 기술 스택 및 컨테이너 아키텍처 (초경량 구성)

소스를 직접 수정하지 않고 안정적으로 운영할 수 있도록 빌드와 런타임이 단순한 풀스택 단일 구조를 사용합니다.
- **Framework:** Next.js 15 (App Router, TypeScript, `output: 'standalone'`)
- **Styling & UI:** Tailwind CSS + Lucide React (아이콘) — 깔끔하고 직관적인 핀테크/모바일 앱 스타일
- **Database & ORM:** SQLite + Prisma ORM (별도 DB 프로세스 불필요, 단일 파일 `dev.db`로 백업 및 이전 용이)
- **File Storage:** 컨테이너 내부 로컬 경로(`/app/data/uploads`)에 영수증 및 갤러리 이미지 저장 후 호스트 볼륨과 마운트
- **Container Spec:**
  Multi-stage `Dockerfile` (Node 20 Alpine 기반 경량 이미지)
  컨테이너 시작 시 `npx prisma db push` 자동 실행 후 서버 구동 (`entrypoint.sh`)
  `docker-compose.yml` 예시:`services:
  gyemoim-app:
    build: .
    container_name: gyemoim-dashboard
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data  # SQLite DB 파일 및 업로드 이미지 영구 보관
    environment:
      - DATABASE_URL=file:/app/data/gyemoim.db
      - GROUP_PIN=1234        # 일반 멤버 입장 코드
      - ADMIN_PIN=9999        # 총무(관리자) 모드 전환 코드
      - GROUP_NAME=우리계모임
      - MONTHLY_FEE=30000     # 기본 월 회비 (원)
`

## 3. 사용자 권한 및 인증 흐름

1. **게이트 화면 (최초 접속):**
  모임 이름과 `입장 코드(GROUP_PIN)` 입력창 표시.
  코드 일치 시 로컬 스토리지/쿠키에 인증 토큰 저장 후 **멤버 선택 화면**으로 이동.
2. **프로필 선택 (로그인 대체):**
  등록된 멤버 리스트에서 본인 이름을 터치하면 해당 멤버 세션으로 진입.
  신규 인원은 총무가 멤버 관리에서 추가하거나, 초기 설정 시 등록.
3. **권한 체계:**
  **일반 멤버 (`MEMBER`):** 장부/회비 조회, 일정 참석 체크, 투표 참여 및 항목 추가, 갤러리 사진 업로드/다운로드, 게시글/댓글 작성.
  **총무 (`ADMIN`):** 상단 설정 메뉴에서 `총무 코드(ADMIN_PIN)` 입력 시 활성화. 장부 입출금 등록/수정/삭제, 월별 회비 일괄 납부 처리, 공지/회칙 고정, 투표 강제 마감, 멤버 추가/비활성화 권한 보유.

## 4. 세부 기능 명세


### ① 홈 대시보드 (`/`)

- **통장 현황 카드:**
  현재 총 잔액 (전체 입금 합계 - 전체 출금 합계 자동 계산)
  이번 달 총 입금액 / 총 지출액 요약
  모임 계좌번호 표시 및 `원클릭 계좌번호 복사` 버튼 (총무가 설정에서 등록)
- **내 회비 상태 배너:** 현재 로그인한 멤버의 당월 회비 납부 완료(`완납`) 또는 `미납` 상태 즉시 표시.
- **하이라이트 위젯:** 가장 가까운 다가오는 일정(D-Day) 1건, 현재 진행 중인 투표 배너.
- **최근 활동 요약:** 최근 입출금 내역 3건, 최신 공지사항 1건.

### ② 회비 & 장부 관리 (`/ledger`)

- **탭 1: 월별 회비 납부 매트릭스 (연도 선택 가능)**
  행(Row): 활성 멤버 목록 / 열(Column): `1월 ~ 12월`
  셀 상태: `납부완료(초록 체크)`, `미납(빨간 표시)`, `면제/해당없음(회색 -)`
  **[총무 전용] 빠른 일괄 납부 처리:** 특정 월을 선택하고 납부한 멤버들을 체크박스로 다중 선택한 뒤 `[선택 멤버 회비 입금 일괄 등록]` 버튼을 누르면 입출금 내역과 회비 매트릭스가 동시에 반영됨.
- **탭 2: 입출금 내역 리스트**
  월별 필터링 및 검색, 수입/지출 구분 필터.
  표시 항목: 거래일시, 구분(`회비입금`, `이자/기타수입`, `식비`, `숙박/여행`, `경조사`, `운영비`), 금액, 관련 멤버(입금자), 메모, 영수증 사진 아이콘(클릭 시 모달로 영수증 이미지 확인).
  **[총무 전용] 수기 내역 등록/수정 폼:** 날짜, 입금/출금 선택, 카테고리, 금액, 입금자(멤버 선택 드롭다운), 메모, 영수증 이미지 첨부.
  *향후 확장을 위한 예약 UI:* 상단에 `[엑셀/캡처 가져오기 (준비중)]` 비활성 버튼 또는 확장 인터페이스를 고려한 컴포넌트 분리.

### ③ 일정표 & 모임 정산 (`/schedule`)

- **뷰 전환:** 월간 캘린더 뷰 / 다가오는 일정 리스트 뷰.
- **일정 등록 (모든 멤버 또는 총무):** 제목, 시작/종료 일시, 장소(네이버/카카오 지도 링크 첨부 가능), 설명.
- **참석 여부(RSVP) 투표:** 일정 상세에서 `참석`, `불참`, `미정` 버튼 클릭 및 상태별 멤버 명단 표시.
- **모임 지출 연동 (선택):** 장부에서 출금 내역 등록 시 특정 일정을 태그로 연결하면, 해당 일정 상세 페이지에서 **"이 모임 총 지출액 / 참석자 1인당 평균 사용액"** 자동 요약 표시.

### ④ 투표 기능 (`/polls`)

- **투표 생성:** 질문 제목, 마감 일시, 복수 선택 허용 여부, **멤버의 선택지 추가 허용 여부** 설정.
- **투표 참여 및 결과:** 실시간 득표수 및 퍼센트 바 차트 표시, 항목별 투표자 이름 확인, **미투표자 명단 표시**(독촉용).
- **상태 관리:** 마감 시간 경과 또는 총무의 `[투표 마감]` 클릭 시 종료 처리.

### ⑤ 갤러리 (`/gallery`)

- **앨범(폴더) 단위 관리:** 모임/여행 단위로 앨범 생성(예: `2026 여름 가평 여행`, `정기모임`) 및 일정과 연결 가능.
- **사진 업로드 & 뷰어:** 다중 이미지 업로드 지원(서버 저장 시 용량 절감을 위해 적정 해상도 리사이징 또는 원본 저장 옵션), 라이트박스 전체화면 뷰어, 개별 다운로드 및 앨범 전체 ZIP 다운로드 지원.

### ⑥ 게시판 & 회칙 (`/board`)

- **상단 고정 회칙/공지 영역:** 모임 회칙(회비 금액, 납부일, 경조사 지원 기준, 지각/불참 규정 등)을 상단에 고정 노출하고 총무만 편집 가능.
- **자유 게시판:** 일반 게시글 작성, 이미지 첨부, 댓글 작성/삭제, 좋아요 버튼.

### ⑦ 설정 & 데이터 백업 (`/settings`)

- **모임 기본 정보 설정 (총무 전용):** 모임명, 모임통장 계좌번호(복사용), 월 기본 회비 설정.
- **멤버 관리 (총무 전용):** 멤버 추가, 이름 수정, 탈퇴/휴면 처리(기존 장부 기록 보존을 위해 Soft Delete 처리).
- **데이터 백업/복원 (총무 전용):** 버튼 클릭 한 번으로 현재 SQLite DB 파일(`gyemoim.db`)을 브라우저로 다운로드하는 백업 기능 제공.

## 5. 데이터베이스 스키마 (Prisma Schema 기준)

AI 에이전트는 아래 스키마를 기반으로 `prisma/schema.prisma`를 작성합니다. 추후 카카오뱅크 CSV 파싱 및 OCR 연동을 위해 `Transaction` 모델에 `sourceType`과 `uniqueHash`를 포함합니다.

```
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Member {
  id           String        @id @default(cuid())
  name         String
  role         String        @default("MEMBER") // "ADMIN" | "MEMBER"
  isActive     Boolean       @default(true)
  joinedAt     DateTime      @default(now())
  transactions Transaction[]
  duesRecords  DuesRecord[]
  rsvps        EventRsvp[]
  pollVotes    PollVote[]
  posts        Post[]
  comments     Comment[]
  photos       Photo[]
}

model GroupSetting {
  id            String @id @default("default")
  groupName     String @default("우리계모임")
  bankAccount   String @default("")
  monthlyFee    Int    @default(30000)
  rulesMarkdown String @default("모임 회칙을 작성해주세요.")
}

model Transaction {
  id          String   @id @default(cuid())
  date        DateTime
  type        String   // "INCOME" (입금) | "EXPENSE" (출금)
  category    String   // "회비", "이자", "식비", "숙박", "경조사", "기타"
  amount      Int
  description String
  receiptUrl  String?
  sourceType  String   @default("MANUAL") // 추후 확장용: "MANUAL" | "CSV" | "OCR"
  uniqueHash  String?  @unique            // 추후 중복 업로드 방지용 해시
  memberId    String?
  member      Member?  @relation(fields: [memberId], references: [id])
  eventId     String?
  event       Event?   @relation(fields: [eventId], references: [id])
  createdAt   DateTime @default(now())
}

model DuesRecord {
  id        String   @id @default(cuid())
  year      Int
  month     Int      // 1 ~ 12
  status    String   // "PAID" | "UNPAID" | "EXEMPT"
  amount    Int      @default(0)
  memberId  String
  member    Member   @relation(fields: [memberId], references: [id])
  updatedAt DateTime @updatedAt

  @@unique([year, month, memberId])
}

model Event {
  id           String        @id @default(cuid())
  title        String
  description  String?
  location     String?
  startAt      DateTime
  endAt        DateTime?
  rsvps        EventRsvp[]
  transactions Transaction[]
  albums       Album[]
  createdAt    DateTime      @default(now())
}

model EventRsvp {
  id       String @id @default(cuid())
  status   String // "ATTEND" | "ABSENT" | "MAYBE"
  eventId  String
  event    Event  @relation(fields: [eventId], references: [id], onDelete: Cascade)
  memberId String
  member   Member @relation(fields: [memberId], references: [id])

  @@unique([eventId, memberId])
}

model Poll {
  id             String       @id @default(cuid())
  title          String
  allowMultiple  Boolean      @default(false)
  allowAddOption Boolean      @default(true)
  isClosed       Boolean      @default(false)
  closesAt       DateTime?
  options        PollOption[]
  createdAt      DateTime     @default(now())
}

model PollOption {
  id     String     @id @default(cuid())
  text   String
  pollId String
  poll   Poll       @relation(fields: [pollId], references: [id], onDelete: Cascade)
  votes  PollVote[]
}

model PollVote {
  id       String     @id @default(cuid())
  optionId String
  option   PollOption @relation(fields: [optionId], references: [id], onDelete: Cascade)
  memberId String
  member   Member     @relation(fields: [memberId], references: [id])

  @@unique([optionId, memberId])
}

model Album {
  id        String   @id @default(cuid())
  title     String
  eventId   String?
  event     Event?   @relation(fields: [eventId], references: [id])
  photos    Photo[]
  createdAt DateTime @default(now())
}

model Photo {
  id         String   @id @default(cuid())
  url        String
  caption    String?
  albumId    String
  album      Album    @relation(fields: [albumId], references: [id], onDelete: Cascade)
  uploaderId String
  uploader   Member   @relation(fields: [uploaderId], references: [id])
  createdAt  DateTime @default(now())
}

model Post {
  id        String    @id @default(cuid())
  title     String
  content   String
  isNotice  Boolean   @default(false)
  imageUrl  String?
  authorId  String
  author    Member    @relation(fields: [authorId], references: [id])
  comments  Comment[]
  createdAt DateTime  @default(now())
}

model Comment {
  id        String   @id @default(cuid())
  content   String
  postId    String
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  authorId  String
  author    Member   @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
}
```


## 6. UI/UX 디자인 가이드라인

- **레이아웃:** 모바일 화면(최대 폭 `480px~640px` 중앙 정렬 카드형 레이아웃, 데스크톱에서도 깔끔한 모바일 앱 뷰 유지)
- **내비게이션:** 하단 고정 탭 바(Bottom Navigation Bar) 5개 메뉴 구성:
  `홈` (요약 대시보드)
  `장부/회비` (매트릭스 및 입출금 내역)
  `일정/투표` (상단 세그먼트 탭으로 일정표와 투표 전환)
  `갤러리` (앨범 및 사진첩)
  `게시판/더보기` (회칙, 자유게시판, 총무 설정)
- **컬러 톤:** 화이트/라이트 그레이 배경에 신뢰감을 주는 네이비/옐로우(카카오뱅크 스타일 포인트) 또는 에메랄드 그린 포인트 컬러 적용. 금액 표기는 천 단위 콤마(`₩150,000`)와 입금(`+`, 파란색)/출금(`-`, 빨간색 또는 검은색) 시각 구분 명확화.

## 7. AI 코딩 에이전트(Antigravity) 실행 지시사항

이 문서를 전달받은 AI 에이전트는 다음 순서대로 프로젝트를 생성하고 검증해야 합니다.
1. **프로젝트 초기화:** Next.js (TypeScript, Tailwind CSS, App Router) 프로젝트를 생성하고 `prisma`, `@prisma/client`, `lucide-react`, `jszip` 등 필요한 최소 패키지만 설치합니다.
2. **DB 및 시드(Seed) 구성:** 위 Prisma 스키마를 적용하고, 최초 실행 시 DB가 비어있을 경우 기본 설정(`GroupSetting`)과 샘플 멤버 3~4명, 샘플 데이터가 자동 생성되도록 시드 스크립트를 구성합니다.
3. **API 및 프론트엔드 구현:** 모든 기능(인증 PIN 검증, 장부 CRUD, 일괄 회비 처리, 일정 RSVP, 투표, 로컬 파일 업로드 API `/api/uploads/[...path]` 서빙, 게시판)을 완전하게 동작하도록 구현합니다.
  *주의:* Next.js 프로덕션 빌드에서는 `public/uploads`에 런타임으로 추가된 파일이 정적 서빙되지 않을 수 있으므로, 반드시 `/app/data/uploads`에 저장하고 전용 API Route(`/api/files/[filename]`)를 통해 이미지를 스트리밍 서빙하도록 구현합니다.
4. **Docker 패키징 검증:**
  `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `entrypoint.sh`를 루트 디렉토리에 생성합니다.
  컨테이너 빌드(`docker compose build`) 및 실행 후 실제 페이지 렌더링과 DB 쓰기/읽기가 정상 작동하는지 확인합니다.
