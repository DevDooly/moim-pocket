import path from 'path';
import fs from 'fs';

export function getUploadDir(): string {
  const envDir = process.env.UPLOAD_DIR;
  if (envDir) {
    if (!fs.existsSync(envDir)) {
      fs.mkdirSync(envDir, { recursive: true });
    }
    return envDir;
  }

  // Docker container default path if /app/data exists
  if (fs.existsSync('/app/data')) {
    const dockerUpload = '/app/data/uploads';
    if (!fs.existsSync(dockerUpload)) {
      fs.mkdirSync(dockerUpload, { recursive: true });
    }
    return dockerUpload;
  }

  // Local fallback
  const localDir = path.join(process.cwd(), 'data', 'uploads');
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true });
  }
  return localDir;
}

export function getSqliteDbPath(): string {
  const dbUrl = process.env.DATABASE_URL || 'file:/app/data/gyemoim.db';
  const rawPath = dbUrl.replace(/^file:/, '');

  if (path.isAbsolute(rawPath) && fs.existsSync(rawPath)) {
    return rawPath;
  }

  // Check relative to prisma folder or cwd
  const fromPrisma = path.resolve(process.cwd(), 'prisma', rawPath);
  if (fs.existsSync(fromPrisma)) {
    return fromPrisma;
  }

  const fromCwd = path.resolve(process.cwd(), rawPath);
  if (fs.existsSync(fromCwd)) {
    return fromCwd;
  }

  return rawPath;
}
