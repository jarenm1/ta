import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizeCanvasEndpoint } from './canvas-client.mjs';

const CANVAS_SESSION_ENV_VAR = 'TA_CANVAS_SESSION_PATH';
const DEFAULT_SESSION_FILE = path.join('.teaching-assistant', 'canvas-session.json');

function resolveSharedCanvasSessionPath() {
  const configuredPath = String(process.env[CANVAS_SESSION_ENV_VAR] || '').trim();
  return configuredPath || path.join(os.homedir(), DEFAULT_SESSION_FILE);
}

function normalizeStoredSession(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const endpoint = normalizeCanvasEndpoint(value.endpoint || '');
  const token = String(value.token || '').trim();

  if (!endpoint || !token) {
    return null;
  }

  return {
    endpoint,
    token,
  };
}

async function loadSharedCanvasSession() {
  try {
    const rawValue = await fs.readFile(resolveSharedCanvasSessionPath(), 'utf8');
    return normalizeStoredSession(JSON.parse(rawValue));
  } catch {
    return null;
  }
}

export { CANVAS_SESSION_ENV_VAR, loadSharedCanvasSession, resolveSharedCanvasSessionPath };
