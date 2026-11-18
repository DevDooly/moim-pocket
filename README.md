# 💰 모임포켓 (Moim-Pocket)

> **카카오뱅크 모임통장 기반 계모임의 회비 납부 현황, 입출금 장부, 일정, 투표, 사진 갤러리, 회칙/게시판을 한곳에서 관리하는 초경량 모바일 퍼스트(Mobile-First) 웹 대시보드**

---

## ✨ 핵심 특징

1. **초경량 단일 컨테이너 배포 (`docker compose up -d`)**
   - 별도의 외부 DB 서버나 클라우드 스토리지 없이 **SQLite + 로컬 볼륨 마운트(`./data:/app/data`)** 만으로 즉시 구동 및 영구 데이터 보존.
2. **진입장벽 제로 UX**
   - 카카오톡 단톡방 공유 링크로 접속 시 복잡한 회원가입 없이 **`모임 입장 코드(GROUP_PIN)` 입력 → 본인 프로필 터치**만으로 즉시 시작.
3. **총무 전용 원클릭 관리 기능**
   - 상단 `총무전환` 버튼에서 `ADMIN_PIN` 입력 시 **월별 회비 일괄 입금 등록(매트릭스 + 입출금 장부 동시 반영)**, **영수증 첨부 장부 관리**, **고정 회칙 편집**, **SQLite DB 원클릭 백업/복원** 지원.
4. **확장 가능한 장부 스키마**
   - 향후 카카오뱅크 거래내역 CSV 업로드 및 내역 캡처 OCR 연동을 위한 `sourceType` 및 `uniqueHash` 필드 기본 탑재.

---

## 🛠️ 기술 스택

- **Framework:** Next.js 15 (App Router, TypeScript, `output: 'standalone'`)
- **Styling & UI:** Tailwind CSS + Lucide React
- **Database & ORM:** SQLite + Prisma ORM (`prisma/schema.prisma`)
- **File Storage:** 컨테이너 볼륨(`/app/data/uploads`) + 스트리밍 서빙 API (`/api/files/[filename]`, `/api/uploads/[...path]`)
- **Archive:** `JSZip` 기반 앨범 전체 사진 ZIP 일괄 다운로드 (`/api/gallery/zip`)

---

## 🚀 빠른 실행 방법 (Docker Compose 권장)

```bash
# 1. 컨테이너 이미지 빌드 및 백그라운드 실행
docker compose up -d --build

# 2. 실행 로그 확인 (DB 스키마 자동 push 및 초기 시드 데이터 생성 확인)
docker logs -f gyemoim-dashboard
```

브라우저에서 **`http://localhost:3000`** 으로 접속합니다.

- **기본 일반 멤버 입장 코드 (`GROUP_PIN`):** `1234`
- **기본 총무(관리자) 전환 코드 (`ADMIN_PIN`):** `9999`

---

## 💻 로컬 개발 환경 실행

```bash
# 1. 의존성 설치
npm install

# 2. SQLite 스키마 동기화 및 시드 데이터 생성
npx prisma db push
npm run db:seed

# 3. 개발 서버 실행
npm run dev
```

---

## 📂 주요 화면 및 라우트 구성

| 메뉴 | 경로 | 주요 기능 |
| :--- | :--- | :--- |
| **홈** | `/` | 모임통장 총 잔액, 당월 입금/지출 요약, 원클릭 계좌번호 복사, 내 당월 회비 상태 배너, 다가오는 일정(D-Day), 진행 중 투표, 최신 공지 및 최근 거래 3건 |
| **장부/회비** | `/ledger` | 연도별 1~12월 회비 납부 매트릭스, **[총무 전용] 다중 선택 일괄 회비 입금 처리**, 월별/유형별 입출금 내역 검색, 영수증 사진 첨부 및 모달 뷰어 |
| **일정/투표** | `/schedule`, `/polls` | 월간 캘린더 뷰 & 리스트 뷰 전환, 참석/불참/미정 RSVP 투표, **연동 지출 기반 참석자 1인당 평균 비용 자동 정산**, 실시간 퍼센트 투표 및 **미투표자 명단 표시** |
| **갤러리** | `/gallery` | 모임/일정별 앨범 생성, 다중 사진 업로드(해상도 최적화/원본 선택), 전체화면 라이트박스 뷰어, 개별 다운로드 및 **앨범 전체 ZIP 다운로드** |
| **게시판/더보기** | `/board`, `/settings` | 상단 고정 모임 회칙(총무 편집), 공지/자유게시판(이미지 첨부, 댓글, 좋아요), 모임 기본 설정, 멤버 관리(Soft Delete), **SQLite DB 원클릭 백업 다운로드 & 복원** |
