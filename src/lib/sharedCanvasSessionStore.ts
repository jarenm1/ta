import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { CanvasSession } from './canvasApi';

const CANVAS_SESSION_ENV_VAR = 'TA_CANVAS_SESSION_PATH';
const DEFAULT_SESSION_FILE = path.join('.teaching-assistant', 'canvas-session.json');

type StoredCanvasSession = CanvasSession & {
  savedAt: string;
};

function resolveSharedCanvasSessionPath() {
  const configuredPath = String(process.env[CANVAS_SESSION_ENV_VAR] || '').trim();
  return configuredPath || path.join(os.homedir(), DEFAULT_SESSION_FILE);
}

function isStoredCanvasSession(value: unknown): value is StoredCanvasSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const maybeSession = value as Record<string, unknown>;

  return (
    typeof maybeSession.endpoint === 'string' &&
    maybeSession.endpoint.trim().length > 0 &&
    typeof maybeSession.token === 'string' &&
    maybeSession.token.trim().length > 0 &&
    typeof maybeSession.savedAt === 'string' &&
    maybeSession.savedAt.length > 0
  );
}

function normalizeSession(session: CanvasSession): StoredCanvasSession {
  return {
    endpoint: session.endpoint.trim().replace(/\/+$/, ''),
    token: session.token.trim(),
    savedAt: session.savedAt || new Date().toISOString(),
  };
}

async function loadSharedCanvasSession() {
  try {
    const sessionPath = resolveSharedCanvasSessionPath();
    const rawValue = await fs.readFile(sessionPath, 'utf8');
    const parsedValue = JSON.parse(rawValue) as unknown;

    if (!isStoredCanvasSession(parsedValue)) {
      return null;
    }

    return normalizeSession(parsedValue);
  } catch {
    return null;
  }
}

async function saveSharedCanvasSession(session: CanvasSession) {
  const sessionPath = resolveSharedCanvasSessionPath();
  const normalizedSession = normalizeSession(session);

  await fs.mkdir(path.dirname(sessionPath), { recursive: true });
  await fs.writeFile(sessionPath, JSON.stringify(normalizedSession, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
  await fs.chmod(sessionPath, 0o600);

  return normalizedSession;
}

async function clearSharedCanvasSession() {
  try {
    await fs.unlink(resolveSharedCanvasSessionPath());
  } catch (error) {
    const maybeError = error as NodeJS.ErrnoException;
    if (maybeError?.code !== 'ENOENT') {
      throw error;
    }
  }
}

export {
  CANVAS_SESSION_ENV_VAR,
  clearSharedCanvasSession,
  loadSharedCanvasSession,
  resolveSharedCanvasSessionPath,
  saveSharedCanvasSession,
};
export type { StoredCanvasSession };
