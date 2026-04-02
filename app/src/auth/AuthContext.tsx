import {
  createContext,
  type PropsWithChildren,
  useEffect,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  clearCanvasSession,
  loadCanvasSession,
  saveCanvasSession,
  type CanvasSession,
} from '../lib/canvasSession';

type LoginInput = {
  endpoint: string;
  token: string;
};

type AuthContextValue = {
  session: CanvasSession | null;
  isAuthenticated: boolean;
  login: (input: LoginInput) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function normalizeLoginInput(input: LoginInput): CanvasSession {
  return {
    endpoint: input.endpoint.trim().replace(/\/+$/, ''),
    token: input.token.trim(),
    savedAt: new Date().toISOString(),
  };
}

function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<CanvasSession | null>(() => loadCanvasSession());

  useEffect(() => {
    if (session) {
      if (window.canvasApi) {
        void window.canvasApi.saveSharedSession(session);
      }
      return;
    }

    if (!window.canvasApi) {
      return;
    }

    let isCanceled = false;

    async function hydrateSharedSession() {
      try {
        const sharedSession = await window.canvasApi?.loadSharedSession();

        if (!sharedSession || isCanceled) {
          return;
        }

        saveCanvasSession(sharedSession);
        setSession(sharedSession);
      } catch {
        return;
      }
    }

    void hydrateSharedSession();

    return () => {
      isCanceled = true;
    };
  }, [session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isAuthenticated: Boolean(session),
      login: (input) => {
        const nextSession = normalizeLoginInput(input);

        saveCanvasSession(nextSession);
        if (window.canvasApi) {
          void window.canvasApi.saveSharedSession(nextSession);
        }
        setSession(nextSession);
      },
      logout: () => {
        clearCanvasSession();
        if (window.canvasApi) {
          void window.canvasApi.clearSharedSession();
        }
        setSession(null);
      },
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}

export { AuthProvider, useAuth };
export type { LoginInput };
