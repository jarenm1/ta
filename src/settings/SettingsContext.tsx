import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

type AgentProvider = 
  | { type: 'codex'; apiKey?: string }
  | { type: 'opencode'; apiKey?: string }
  | { type: 'copilot'; token: string }
  | { type: 'openai'; apiKey: string }
  | { type: 'anthropic'; apiKey: string };

type Settings = {
  theme: Theme;
  agentProviders: AgentProvider[];
  activeAgentProvider: string | null;
  chatSettings: {
    autoScroll: boolean;
    showTimestamps: boolean;
    maxHistoryMessages: number;
    chatSelectedModel: string | null;
  };
  editorSettings: {
    vimEnabled: boolean;
  };
};

type SettingsContextType = {
  settings: Settings;
  setTheme: (theme: Theme) => void;
  addAgentProvider: (provider: AgentProvider) => void;
  removeAgentProvider: (type: string) => void;
  setActiveAgentProvider: (type: string | null) => void;
  updateChatSettings: (settings: Partial<Settings['chatSettings']>) => void;
  setChatSelectedModel: (model: string | null) => void;
  setVimEnabled: (enabled: boolean) => void;
  isHydrated: boolean;
};

const defaultSettings: Settings = {
  theme: 'system',
  agentProviders: [],
  activeAgentProvider: null,
  chatSettings: {
    autoScroll: true,
    showTimestamps: false,
    maxHistoryMessages: 100,
    chatSelectedModel: null,
  },
  editorSettings: {
    vimEnabled: false,
  },
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

function getInitialSettings(): Settings {
  if (typeof window === 'undefined') {
    return defaultSettings;
  }
  
  try {
    const stored = localStorage.getItem('ta-settings');
    if (stored) {
      return { ...defaultSettings, ...JSON.parse(stored) };
    }
  } catch {
    // Invalid stored data
  }
  
  return defaultSettings;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [isHydrated, setIsHydrated] = useState(false);

  // Helper to apply theme - defined before use
  const applyTheme = (theme: Theme) => {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // System preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  };

  // Hydrate from localStorage on mount
  useEffect(() => {
    const initialSettings = getInitialSettings();
    setSettings(initialSettings);
    setIsHydrated(true);
    
    // Apply theme immediately on mount
    applyTheme(initialSettings.theme);
  }, []);

  // Persist to localStorage on change
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('ta-settings', JSON.stringify(settings));
    }
  }, [settings, isHydrated]);

  // Apply theme when settings change
  useEffect(() => {
    if (isHydrated) {
      applyTheme(settings.theme);
    }
  }, [settings.theme, isHydrated]);

  // Listen for system theme changes
  useEffect(() => {
    if (!isHydrated || settings.theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [settings.theme, isHydrated]);

  const setTheme = (theme: Theme) => {
    setSettings((prev) => ({ ...prev, theme }));
  };

  const addAgentProvider = (provider: AgentProvider) => {
    setSettings((prev) => {
      const filtered = prev.agentProviders.filter((p) => p.type !== provider.type);
      return {
        ...prev,
        agentProviders: [...filtered, provider],
        activeAgentProvider: prev.activeAgentProvider || provider.type,
      };
    });
  };

  const removeAgentProvider = (type: string) => {
    setSettings((prev) => {
      const filtered = prev.agentProviders.filter((p) => p.type !== type);
      return {
        ...prev,
        agentProviders: filtered,
        activeAgentProvider: prev.activeAgentProvider === type 
          ? (filtered[0]?.type || null)
          : prev.activeAgentProvider,
      };
    });
  };

  const setActiveAgentProvider = (type: string | null) => {
    setSettings((prev) => ({ ...prev, activeAgentProvider: type }));
  };

  const updateChatSettings = (chatSettings: Partial<Settings['chatSettings']>) => {
    setSettings((prev) => ({
      ...prev,
      chatSettings: { ...prev.chatSettings, ...chatSettings },
    }));
  };

  const setChatSelectedModel = (model: string | null) => {
    setSettings((prev) => ({
      ...prev,
      chatSettings: { ...prev.chatSettings, chatSelectedModel: model },
    }));
  };

  const setVimEnabled = (enabled: boolean) => {
    setSettings((prev) => ({
      ...prev,
      editorSettings: { ...prev.editorSettings, vimEnabled: enabled },
    }));
  };

  return (
    <SettingsContext.Provider
      value={{
        settings,
        setTheme,
        addAgentProvider,
        removeAgentProvider,
        setActiveAgentProvider,
        updateChatSettings,
        setChatSelectedModel,
        setVimEnabled,
        isHydrated,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}

export type { AgentProvider, Settings, Theme };
