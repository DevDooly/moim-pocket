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

export function sanitizeFolderName(name: string): string {
  return (
    name
      .trim()
      .replace(/[\/\\:*?"<>|]/g, '_')
      .replace(/\s+/g, '_')
      .slice(0, 80) || '기본_앨범'
  );
}

export function getAlbumDir(albumTitle: string): {
  folderName: string;
  fullPath: string;
} {
  const folderName = sanitizeFolderName(albumTitle);
  const fullPath = path.join(getUploadDir(), folderName);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
  return { folderName, fullPath };
}

export function resolvePhotoDiskPath(photoUrl: string): string {
  const uploadDir = getUploadDir();
  const decoded = decodeURIComponent(photoUrl);

  // /api/uploads/<albumFolder>/<fileName>
  if (decoded.startsWith('/api/uploads/')) {
    const rel = decoded.replace(/^\/api\/uploads\//, '');
    const safeSegments = rel
      .split('/')
      .filter((s) => s && s !== '.' && s !== '..');
    return path.join(uploadDir, ...safeSegments);
  }

  // /api/files/<fileName>
  const base = path.basename(decoded);
  return path.join(uploadDir, base);
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
