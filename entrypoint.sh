#!/bin/sh
set -e

mkdir -p /app/data/uploads

echo "📦 Prisma DB 스키마 동기화 중 (npx prisma db push)..."
node ./node_modules/prisma/build/index.js db push --skip-generate

echo "🌱 초기 시드 데이터 확인 중..."
node ./prisma/seed.mjs
chmod -R 777 /app/data 2>/dev/null || true

echo "🚀 모임포켓(Moim-Pocket) 대시보드 서버 시작 (Port: 3000)..."
exec node server.js
