import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AgentAuthStatus, AgentChatContext, ToolCall, ToolResult, ToolDefinition } from '../lib/canvasApi';
import { useSettings } from '../settings/SettingsContext';
import { registerTool, executeTool, getAllTools, toOpenAIFunctions } from '../lib/tools/index';
import {
  listCourses,
  getCourseMaterials,
  searchCourseMaterials,
  getStudyGuides,
  getStudyGuide,
  getCodingProblems,
  getCodingProblem,
  runCode,
  downloadCourseFiles,
  uploadLocalFiles,
} from '../lib/tools/courseTools';

type AgentChatUiMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  thinking?: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  isStreaming?: boolean;
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
  isStreaming: boolean;
  messages: AgentChatUiMessage[];
  resetConversation: () => void;
  retryCount: number;
  sendDraft: (context?: Partial<AgentChatContext>) => Promise<void>;
  sendMessage: (messageText: string, context?: Partial<AgentChatContext>) => Promise<void>;
  setDraft: (value: string) => void;
  statusMessage: string;
  streamingMessageId: string | null;
  streamingContent: string;
  streamingThinking: string;
};

const DEFAULT_INTRO_MESSAGE = 'Ask about your courses, study guides, coding problems, or current page.';

// Tool definitions
const listCoursesTool: ToolDefinition = {
  name: 'list_courses',
  description: 'List all available courses in the system',
  parameters: [],
};

const getCourseMaterialsTool: ToolDefinition = {
  name: 'get_course_materials',
  description: 'Get all materials (files, documents) for a specific course',
  parameters: [
    {
      name: 'courseId',
      type: 'number',
      description: 'The ID of the course to get materials for',
      required: true,
    },
  ],
};

const searchCourseMaterialsTool: ToolDefinition = {
  name: 'search_course_materials',
  description: 'Search course materials by keyword or phrase',
  parameters: [
    {
      name: 'courseId',
      type: 'number',
      description: 'The ID of the course to search within',
      required: true,
    },
    {
      name: 'query',
      type: 'string',
      description: 'The search query to find relevant materials',
      required: true,
    },
  ],
};

const getStudyGuidesTool: ToolDefinition = {
  name: 'get_study_guides',
  description: 'Get all study guides for a specific course',
  parameters: [
    {
      name: 'courseId',
      type: 'number',
      description: 'The ID of the course to get study guides for',
      required: true,
    },
  ],
};

const getStudyGuideTool: ToolDefinition = {
  name: 'get_study_guide',
  description: 'Get the full content of a specific study guide',
  parameters: [
    {
      name: 'courseId',
      type: 'number',
      description: 'The ID of the course',
      required: true,
    },
    {
      name: 'guideId',
      type: 'string',
      description: 'The ID of the study guide to retrieve',
      required: true,
    },
  ],
};

const getCodingProblemsTool: ToolDefinition = {
  name: 'get_coding_problems',
  description: 'Get all coding problems for a specific course',
  parameters: [
    {
      name: 'courseId',
      type: 'number',
      description: 'The ID of the course to get coding problems for',
      required: true,
    },
  ],
};

const getCodingProblemTool: ToolDefinition = {
  name: 'get_coding_problem',
  description: 'Get the full details of a specific coding problem including description and starter code',
  parameters: [
    {
      name: 'courseId',
      type: 'number',
      description: 'The ID of the course',
      required: true,
    },
    {
      name: 'problemId',
      type: 'string',
      description: 'The ID of the coding problem to retrieve',
      required: true,
    },
  ],
};

const runCodeTool: ToolDefinition = {
  name: 'run_code',
  description: 'Execute code in a sandboxed environment (Python, JavaScript, or TypeScript)',
  parameters: [
    {
      name: 'code',
      type: 'string',
      description: 'The code to execute',
      required: true,
    },
    {
      name: 'language',
      type: 'string',
      description: 'The programming language (python, javascript, or typescript)',
      required: true,
    },
  ],
};

const downloadCourseFilesTool: ToolDefinition = {
  name: 'download_course_files',
  description: 'Download files from Canvas course and save them to local knowledge base. Use this to fetch lecture slides, PDFs, documents, and other materials from the professor\'s Canvas site.',
  parameters: [
    {
      name: 'courseId',
      type: 'number',
      description: 'The ID of the Canvas course to download files from',
      required: true,
    },
    {
      name: 'fileIds',
      type: 'array',
      description: 'Array of Canvas file IDs to download (e.g., [12345, 67890]). You can find these by browsing the Canvas course files.',
      required: true,
    },
    {
      name: 'maxTextChars',
      type: 'number',
      description: 'Maximum characters to extract from text files (default: 12000)',
      required: false,
    },
    {
      name: 'maxFileSize',
      type: 'number',
      description: 'Maximum file size in bytes (default: 50MB)',
      required: false,
    },
  ],
};

const uploadLocalFilesTool: ToolDefinition = {
  name: 'upload_local_files',
  description: 'Upload files from your local computer to the course knowledge base. Use this for files from the professor\'s website, downloaded materials, or local documents.',
  parameters: [
    {
      name: 'courseId',
      type: 'number',
      description: 'The ID of the course to upload files to',
      required: true,
    },
    {
      name: 'filePaths',
      type: 'array',
      description: 'Array of absolute file paths to upload (e.g., ["/home/user/Downloads/lecture1.pdf", "/home/user/Documents/notes.docx"])',
      required: true,
    },
  ],
};

// Register all tools
function registerAllTools(): void {
  registerTool(listCoursesTool, async () => listCourses());
  registerTool(getCourseMaterialsTool, async (args) => getCourseMaterials(args.courseId as number));
  registerTool(searchCourseMaterialsTool, async (args) => 
    searchCourseMaterials(args.courseId as number, args.query as string)
  );
  registerTool(getStudyGuidesTool, async (args) => getStudyGuides(args.courseId as number));
  registerTool(getStudyGuideTool, async (args) => 
    getStudyGuide(args.courseId as number, args.guideId as string)
  );
  registerTool(getCodingProblemsTool, async (args) => getCodingProblems(args.courseId as number));
  registerTool(getCodingProblemTool, async (args) => 
    getCodingProblem(args.courseId as number, args.problemId as string)
  );
  registerTool(runCodeTool, async (args) => 
    runCode(args.code as string, args.language as 'python' | 'javascript' | 'typescript')
  );
  registerTool(downloadCourseFilesTool, async (args) =>
    downloadCourseFiles(
      args.courseId as number,
      args.fileIds as string[],
      {
        maxTextChars: args.maxTextChars as number | undefined,
        maxFileSize: args.maxFileSize as number | undefined,
      }
    )
  );
  registerTool(uploadLocalFilesTool, async (args) =>
    uploadLocalFiles(args.courseId as number, args.filePaths as string[])
  );
}

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
  const [isStreaming, setIsStreaming] = useState(false);
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
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingThinking, setStreamingThinking] = useState('');

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

  // Set up streaming event listeners
  useEffect(() => {
    if (!window.canvasApi?.onAgentChatStream) {
      return;
    }

    const handleStreamingEvent = (data: { type: string; messageId?: string; data: unknown }) => {
      switch (data.type) {
        case 'thinking':
          setStreamingThinking((prev) => prev + (data.data as string));
          break;
        case 'content':
          setStreamingContent((prev) => prev + (data.data as string));
          break;
        case 'tool_call':
          setMessages((current) => {
            const lastMessage = current[current.length - 1];
            if (lastMessage && lastMessage.id === data.messageId) {
              const toolCall = data.data as ToolCall;
              const updatedMessage = {
                ...lastMessage,
                toolCalls: [...(lastMessage.toolCalls || []), toolCall],
              };
              return [...current.slice(0, -1), updatedMessage];
            }
            return current;
          });
          break;
        case 'tool_result':
          setMessages((current) => {
            const lastMessage = current[current.length - 1];
            if (lastMessage && lastMessage.id === data.messageId) {
              const toolResult = data.data as ToolResult;
              const updatedMessage = {
                ...lastMessage,
                toolResults: [...(lastMessage.toolResults || []), toolResult],
              };
              return [...current.slice(0, -1), updatedMessage];
            }
            return current;
          });
          break;
        case 'error':
          addError((data.data as { error: string }).error);
          setIsStreaming(false);
          setIsSending(false);
          break;
        case 'done':
          setIsStreaming(false);
          setIsSending(false);
          // Finalize the streaming message
          if (streamingMessageId) {
            setMessages((current) => {
              const lastMessage = current[current.length - 1];
              if (lastMessage && lastMessage.id === streamingMessageId) {
                return [
                  ...current.slice(0, -1),
                  {
                    ...lastMessage,
                    text: streamingContent || lastMessage.text,
                    thinking: streamingThinking || lastMessage.thinking,
                    isStreaming: false,
                  },
                ];
              }
              return current;
            });
            setStreamingMessageId(null);
            setStreamingContent('');
            setStreamingThinking('');
          }
          break;
      }
    };

    const unsubscribe = window.canvasApi.onAgentChatStream(handleStreamingEvent);

    return () => {
      unsubscribe();
    };
  }, [streamingMessageId, streamingContent, streamingThinking]);

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

    const streamingId = `assistant-${Date.now()}`;
    setStreamingMessageId(streamingId);
    setStreamingContent('');
    setStreamingThinking('');

    setMessages((currentMessages) => [
      ...currentMessages,
      userMessage,
      {
        id: streamingId,
        role: 'assistant',
        text: '',
        isStreaming: true,
      },
    ]);

    if (!window.canvasApi || !settings.activeAgentProvider) {
      addError(buildUnavailableMessage());
      setStreamingMessageId(null);
      return;
    }

    setIsSending(true);
    setIsStreaming(true);
    setIsRetrying(false);
    setRetryCount(0);

    try {
      const activeProvider = settings.agentProviders.find(
        (p) => p.type === settings.activeAgentProvider
      );
      const apiKey = activeProvider && 'apiKey' in activeProvider ? activeProvider.apiKey : 
                     activeProvider && 'token' in activeProvider ? activeProvider.token : null;

      console.log('[DEBUG] Sending message with provider:', settings.activeAgentProvider, 'apiKey present:', !!apiKey);

      // Register tools for this session
      registerAllTools();
      const tools = getAllTools();

      const response = await window.canvasApi.sendAgentChatMessage({
        apiKey,
        context,
        history: nextHistory,
        message: trimmedMessage,
        previousResponseId,
        provider: settings.activeAgentProvider,
        model: settings.chatSettings.chatSelectedModel,
        stream: true,
        tools: tools.length > 0 ? tools : undefined,
      });

      setPreviousResponseId(response.responseId);
      
      // Finalize the message with complete content
      setMessages((currentMessages) => {
        const lastMessage = currentMessages[currentMessages.length - 1];
        if (lastMessage && lastMessage.id === streamingId) {
          return [
            ...currentMessages.slice(0, -1),
            {
              id: streamingId,
              role: 'assistant',
              text: response.message || streamingContent,
              thinking: response.thinking || streamingThinking,
              toolCalls: response.toolCalls,
              toolResults: response.toolResults,
              isStreaming: false,
            },
          ];
        }
        return currentMessages;
      });
      
      // Clear streaming state
      setStreamingMessageId(null);
      setStreamingContent('');
      setStreamingThinking('');
      setIsStreaming(false);
      
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
      setIsStreaming(false);
      if (streamingMessageId) {
        setStreamingMessageId(null);
        setStreamingContent('');
        setStreamingThinking('');
      }
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
    isStreaming,
    messages,
    resetConversation,
    retryCount,
    sendDraft,
    sendMessage,
    setDraft,
    statusMessage,
    streamingMessageId,
    streamingContent,
    streamingThinking,
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
