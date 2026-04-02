type CanvasSession = {
  endpoint: string;
  token: string;
  savedAt: string;
};

const storageKey = 'canvas-session-v1';

function isValidCanvasSession(value: unknown): value is CanvasSession {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const maybeSession = value as Record<string, unknown>;

  return (
    typeof maybeSession.endpoint === 'string' &&
    maybeSession.endpoint.length > 0 &&
    typeof maybeSession.token === 'string' &&
    maybeSession.token.length > 0 &&
    typeof maybeSession.savedAt === 'string'
  );
}

function loadCanvasSession(): CanvasSession | null {
  try {
    const rawValue = window.localStorage.getItem(storageKey);

    if (!rawValue) {
      return null;
    }

    const parsedValue = JSON.parse(rawValue) as unknown;

    if (!isValidCanvasSession(parsedValue)) {
      window.localStorage.removeItem(storageKey);
      return null;
    }

    return parsedValue;
  } catch {
    return null;
  }
}

function saveCanvasSession(session: CanvasSession) {
  window.localStorage.setItem(storageKey, JSON.stringify(session));
}

function clearCanvasSession() {
  window.localStorage.removeItem(storageKey);
}

export { clearCanvasSession, loadCanvasSession, saveCanvasSession };
export type { CanvasSession };
