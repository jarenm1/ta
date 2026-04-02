import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AgentAuthStatus, AgentChatContext } from '../lib/canvasApi';
import { useSettings } from '../settings/SettingsContext';

type AgentChatUiMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
};

type AgentError = {
  id: string;
  message: string;
  timestamp: number;
};

type AgentChatProviderValue = {
  authStatus: AgentAuthStatus | null;
  canSend: boolean;
  clearStatusMessage: () => void;
  clearError: (id: string) => void;
  draft: string;
  errors: AgentError[];
  isRetrying: boolean;
  isSending: boolean;
  messages: AgentChatUiMessage[];
  resetConversation: () => void;
  retryCount: number;
  sendDraft: (context?: Partial<AgentChatContext>) => Promise<void>;
  sendMessage: (messageText: string, context?: Partial<AgentChatContext>) => Promise<void>;
  setDraft: (value: string) => void;
  statusMessage: string;
};

const DEFAULT_INTRO_MESSAGE = 'Ask about your courses, study guides, coding problems, or current page.';

const AgentChatContextState = createContext<AgentChatProviderValue | null>(null);

function buildUnavailableMessage() {
  return 'Codex/OpenAI is not connected. Run `codex --login` on this machine or set `OPENAI_API_KEY`.';
}

function currentMessagesToHistory(messages: AgentChatUiMessage[]) {
  return messages
    .filter((message) => message.id !== 'assistant-intro' && !message.id.startsWith('assistant-reset-'))
    .map((message) => ({
      role: message.role,
      text: message.text,
    }));
}

function AgentChatProvider({ children }: { children: ReactNode }) {
  const [authStatus, setAuthStatus] = useState<AgentAuthStatus | null>(null);
  const [draft, setDraft] = useState('');
  const [errors, setErrors] = useState<AgentError[]>([]);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [messages, setMessages] = useState<AgentChatUiMessage[]>([
    {
      id: 'assistant-intro',
      role: 'assistant',
      text: DEFAULT_INTRO_MESSAGE,
    },
  ]);
  const [previousResponseId, setPreviousResponseId] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  const { settings } = useSettings();

  useEffect(() => {
    let isCancelled = false;

    async function loadAuthStatus() {
      if (!window.canvasApi) {
        return;
      }

      try {
        const nextAuthStatus = await window.canvasApi.getAgentAuthStatus();

        if (!isCancelled) {
          setAuthStatus(nextAuthStatus);
          setStatusMessage(
            nextAuthStatus.available
              ? `${nextAuthStatus.source === 'codex_session' ? 'Codex' : 'API'} · ${nextAuthStatus.model}`
              : buildUnavailableMessage(),
          );
        }
      } catch (error) {
        if (!isCancelled) {
          setStatusMessage(error instanceof Error ? error.message : 'Unable to load agent auth status.');
        }
      }
    }

    void loadAuthStatus();

    return () => {
      isCancelled = true;
    };
  }, []);

  const canSend = useMemo(() => {
    const hasActiveProvider = settings.activeAgentProvider !== null;
    return hasActiveProvider && !isSending && !isRetrying;
  }, [settings.activeAgentProvider, isSending, isRetrying]);

  const addError = (message: string) => {
    const newError: AgentError = {
      id: `error-${Date.now()}`,
      message,
      timestamp: Date.now(),
    };
    setErrors((prev) => [...prev, newError]);
    
    // Auto-clear error after 8 seconds
    setTimeout(() => {
      setErrors((prev) => prev.filter((e) => e.id !== newError.id));
    }, 8000);
  };

  const clearError = (id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id));
  };

  const sendMessage = async (messageText: string, context?: Partial<AgentChatContext>) => {
    const trimmedMessage = messageText.trim();

    if (!trimmedMessage) {
      return;
    }

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user' as const,
      text: trimmedMessage,
    };
    const nextHistory = [...currentMessagesToHistory(messages), { role: 'user' as const, text: trimmedMessage }];

    setMessages((currentMessages) => [...currentMessages, userMessage]);

    if (!window.canvasApi || !settings.activeAgentProvider) {
      addError(buildUnavailableMessage());
      return;
    }

    setIsSending(true);
    setIsRetrying(false);
    setRetryCount(0);

    try {
      const activeProvider = settings.agentProviders.find(
        (p) => p.type === settings.activeAgentProvider
      );
      const apiKey = activeProvider && 'apiKey' in activeProvider ? activeProvider.apiKey : 
                     activeProvider && 'token' in activeProvider ? activeProvider.token : null;

      console.log('[DEBUG] Sending message with provider:', settings.activeAgentProvider, 'apiKey present:', !!apiKey);

      // TOOL SYSTEM STUB: Tool layer is disabled for now
      // Only Codex uses MCP tooling. Non-Codex providers use static context.
      // Future: Enable tools for other providers by uncommenting below:
      // const { registerAllTools, getAllTools } = await import('../lib/tools/definitions');
      // registerAllTools();
      // const tools = getAllTools();

      const response = await window.canvasApi.sendAgentChatMessage({
        apiKey,
        context,
        history: nextHistory,
        message: trimmedMessage,
        previousResponseId,
        provider: settings.activeAgentProvider,
        model: settings.chatSettings.chatSelectedModel,
      });

      setPreviousResponseId(response.responseId);
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          text: response.message,
        },
      ]);
      
      // Show retry info in status if applicable
      const retryInfo = response.retryCount && response.retryCount > 0 
        ? ` (retried ${response.retryCount}x)` 
        : '';
      const providerLabel = response.source === 'codex_session' 
        ? 'Codex' 
        : settings.activeAgentProvider === 'opencode'
          ? 'OpenCode'
          : settings.activeAgentProvider || 'API';
      setStatusMessage(
        `${providerLabel} · ${response.model}${retryInfo}`,
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unable to reach AI provider.';
      addError(errorMessage);
      
      // Check if it's a retry-related error
      if (errorMessage.toLowerCase().includes('rate limit') || 
          errorMessage.toLowerCase().includes('too many requests')) {
        setStatusMessage('Rate limited. Please wait a moment and try again.');
      } else if (errorMessage.toLowerCase().includes('network') ||
                 errorMessage.toLowerCase().includes('connection')) {
        setStatusMessage('Connection failed. Please check your internet.');
      } else {
        setStatusMessage('Request failed.');
      }
    } finally {
      setIsSending(false);
      setIsRetrying(false);
    }
  };

  const sendDraft = async (context?: Partial<AgentChatContext>) => {
    const nextDraft = draft;
    setDraft('');
    await sendMessage(nextDraft, context);
  };

  const resetConversation = () => {
    setPreviousResponseId(null);
    setMessages([
      {
        id: `assistant-reset-${Date.now()}`,
        role: 'assistant',
        text: DEFAULT_INTRO_MESSAGE,
      },
    ]);
    setErrors([]);
  };

  const value: AgentChatProviderValue = {
    authStatus,
    canSend,
    clearStatusMessage: () => {
      setStatusMessage('');
    },
    clearError,
    draft,
    errors,
    isRetrying,
    isSending,
    messages,
    resetConversation,
    retryCount,
    sendDraft,
    sendMessage,
    setDraft,
    statusMessage,
  };

  return <AgentChatContextState.Provider value={value}>{children}</AgentChatContextState.Provider>;
}

function useAgentChatState() {
  const context = useContext(AgentChatContextState);

  if (!context) {
    throw new Error('useAgentChatState must be used within an AgentChatProvider.');
  }

  return context;
}

export { AgentChatProvider, useAgentChatState };
export type { AgentChatUiMessage, AgentError };
