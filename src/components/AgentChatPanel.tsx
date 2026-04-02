import type { ReactNode } from 'react';
import { useState, useRef, useEffect } from 'react';
import type { AgentChatContext, ToolCall, ToolResult } from '../lib/canvasApi';
import { Button, TextArea } from './ui';
import ChatMarkdownView from './ChatMarkdownView';
import useAgentChat from '../hooks/useAgentChat';
import { useSettings } from '../settings/SettingsContext';

// Tool call display component
function ToolCallDisplay({ toolCall, result }: { toolCall: ToolCall; result?: ToolResult }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div className="my-2 rounded-lg border border-neutral-300 bg-white dark:border-neutral-600 dark:bg-neutral-900 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
        type="button"
      >
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Tool: {toolCall.name}</span>
          {result && (
            <span className={`ml-1 inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${result.error ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300'}`}>
              {result.error ? 'Error' : 'Success'}
            </span>
          )}
        </div>
        <svg className={`h-3 w-3 text-neutral-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isExpanded && (
        <div className="border-t border-neutral-200 bg-neutral-50 px-3 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-800/50">
          <div className="space-y-2">
            <div>
              <span className="font-medium text-neutral-600 dark:text-neutral-400">Arguments:</span>
              <pre className="mt-1 overflow-x-auto rounded bg-neutral-100 p-1.5 text-[10px] text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300">
                {JSON.stringify(toolCall.arguments, null, 2)}
              </pre>
            </div>
            {result && (
              <div>
                <span className="font-medium text-neutral-600 dark:text-neutral-400">Result:</span>
                <pre className={`mt-1 overflow-x-auto rounded p-1.5 text-[10px] ${result.error ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                  {result.error ? result.error : JSON.stringify(result.result, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Thinking block display component with streaming tokens
function ThinkingBlock({ 
  thinking, 
  isStreaming,
  tokenCount 
}: { 
  thinking: string; 
  isStreaming?: boolean;
  tokenCount?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom when streaming
  useEffect(() => {
    if (isStreaming && contentRef.current && isExpanded) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [thinking, isStreaming, isExpanded]);
  
  if (!thinking || thinking.trim().length === 0) return null;
  
  // Calculate visible content - show last 1000 chars when streaming to avoid overflow
  const displayContent = isStreaming && thinking.length > 1000 
    ? '\u2026' + thinking.slice(-1000) 
    : thinking;
  
  // Calculate estimated tokens (rough approximation: 1 token ~ 4 chars)
  const estimatedTokens = tokenCount || Math.ceil(thinking.length / 4);
  
  return (
    <div className="my-2 rounded-lg border border-violet-200 bg-violet-50/80 dark:border-violet-800/50 dark:bg-violet-950/30 overflow-hidden shadow-sm">
      {/* Header with live indicator */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-violet-100/50 dark:hover:bg-violet-900/20 transition-colors"
        type="button"
      >
        <div className="flex items-center gap-2.5">
          {/* Animated brain/thinking icon */}
          <div className="relative">
            <svg className="h-4 w-4 text-violet-600 dark:text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            {isStreaming && (
              <span className="absolute -right-1 -top-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
              </span>
            )}
          </div>
          
          <span className="text-xs font-semibold text-violet-900 dark:text-violet-200">
            {isStreaming ? 'Thinking' : 'Thought Process'}
          </span>
          
          {/* Live badge */}
          {isStreaming && (
            <span className="live-badge inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
              <span className="h-1 w-1 rounded-full bg-violet-500" />
              LIVE
            </span>
          )}
          
          {/* Token count */}
          <span className="text-[10px] text-violet-600/70 dark:text-violet-400/70">
            {estimatedTokens.toLocaleString()} tokens
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Streaming animation dots */}
          {isStreaming && (
            <div className="flex gap-0.5">
              <span className="h-1 w-1 animate-bounce rounded-full bg-violet-500 [animation-delay:-0.3s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-violet-500 [animation-delay:-0.15s]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-violet-500" />
            </div>
          )}
          
          <svg 
            className={`h-4 w-4 text-violet-500 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>
      
      {/* Streaming content */}
      {isExpanded && (
        <div className="border-t border-violet-200 dark:border-violet-800/50">
          <div 
            ref={contentRef}
            className="thinking-scroll max-h-[400px] overflow-y-auto px-3 py-3 text-xs leading-relaxed"
          >
            <div className="font-mono text-violet-800 dark:text-violet-200 whitespace-pre-wrap">
              {displayContent}
              {isStreaming && (
                <span className="token-cursor" />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const PROVIDER_LABELS: Record<string, string> = {
  codex: 'Codex',
  opencode: 'OpenCode',
  copilot: 'Copilot',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
};

// Model options for each provider
const PROVIDER_MODELS: Record<string, string[]> = {
  codex: [
    // GPT-5.4 (supported through Codex CLI)
    'gpt-5.4',
    // Codex 5.3
    'codex-5.3',
  ],
  opencode: [
    // Kimi K2.5 Turbo via Fireworks
    'accounts/fireworks/routers/kimi-k2p5-turbo',
  ],
  openai: [
    // GPT-5.4 Series (Current Flagship)
    'gpt-5.4',
    'gpt-5.4-mini',
    'gpt-5.4-nano',
    // Reasoning Models
    'o1',
    'o3-mini',
  ],
  anthropic: [
    'claude-3-5-sonnet-latest',
    'claude-3-opus-latest',
    'claude-3-haiku-latest',
    'claude-3-5-haiku-latest',
  ],
};

// Short labels for models (displayed in dropdown)
const MODEL_SHORT_LABELS: Record<string, string> = {
  // GPT-5.4 Series (All providers)
  'gpt-5.4': 'GPT-5.4 (Flagship)',
  'gpt-5.4-mini': 'GPT-5.4 Mini',
  'gpt-5.4-nano': 'GPT-5.4 Nano',
  // Codex-specific
  'codex-5.3': 'Codex 5.3',
  // OpenCode multi-provider models
  'accounts/fireworks/routers/kimi-k2p5-turbo': 'Kimi K2.5 Turbo (Fireworks)',
  // Reasoning Models
  'o1': 'o1',
  'o3-mini': 'o3-mini',
  // Anthropic
  'claude-3-5-sonnet-latest': 'Claude 3.5 Sonnet',
  'claude-3-opus-latest': 'Claude 3 Opus',
  'claude-3-haiku-latest': 'Claude 3 Haiku',
  'claude-3-5-haiku-latest': 'Claude 3.5 Haiku',
};

export type AgentChatPanelProps = {
  className?: string;
  context?: AgentChatContext;
  contextLabel?: string;
  headerTitle?: string;
  placeholder?: string;
  topContent?: ReactNode;
};

export default function AgentChatPanel({
  className,
  context,
  contextLabel,
  headerTitle = 'Chat',
  placeholder = 'Ask anything about this page.',
  topContent,
}: AgentChatPanelProps) {
  const {
    canSend,
    clearError,
    draft,
    errors,
    isSending,
    isStreaming,
    messages,
    resetConversation,
    sendDraft,
    setDraft,
    streamingContent,
    streamingThinking,
    streamingMessageId,
  } = useAgentChat({
    baseContext: context,
  });

  const { settings, setActiveAgentProvider, setChatSelectedModel } = useSettings();
  const [showConfigDropdown, setShowConfigDropdown] = useState(false);

  const activeProvider = settings.agentProviders.find(
    (p) => p.type === settings.activeAgentProvider
  );

  // Get current display labels
  const currentProviderLabel = activeProvider 
    ? PROVIDER_LABELS[activeProvider.type] || activeProvider.type 
    : 'None';
  const currentModelLabel = settings.chatSettings.chatSelectedModel 
    ? MODEL_SHORT_LABELS[settings.chatSettings.chatSelectedModel] || settings.chatSettings.chatSelectedModel.split('/').pop() || settings.chatSettings.chatSelectedModel
    : 'Default';

  // Check if any provider has models
  const hasAnyModels = settings.agentProviders.some(
    (p) => PROVIDER_MODELS[p.type] && PROVIDER_MODELS[p.type].length > 0
  );

  return (
    <div
      className={[
        'relative flex h-full min-h-0 flex-col overflow-hidden',
        className || '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Error Toast Notifications */}
      {errors.length > 0 && (
        <div className="absolute right-4 top-16 z-50 flex flex-col gap-2">
          {errors.map((error) => (
            <div
              key={error.id}
              className="flex max-w-xs items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 shadow-lg dark:border-red-800 dark:bg-red-900/80"
            >
              <svg
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="flex-1">
                <p className="text-xs font-medium text-red-800 dark:text-red-200">
                  Error
                </p>
                <p className="mt-0.5 text-xs text-red-700 dark:text-red-100">
                  {error.message}
                </p>
              </div>
              <button
                onClick={() => clearError(error.id)}
                className="text-red-600 hover:text-red-800 dark:text-red-300 dark:hover:text-red-100"
                type="button"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              {headerTitle}
            </h2>
            {contextLabel ? (
              <p className="mt-1 text-xs font-medium uppercase tracking-[0.15em] text-neutral-500 dark:text-neutral-400">
                {contextLabel}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {/* Config Dropdown Button */}
            <div className="relative">
              <button
                onClick={() => setShowConfigDropdown(!showConfigDropdown)}
                className="flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-all hover:border-neutral-400 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
                type="button"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="hidden sm:inline">{currentProviderLabel}</span>
                {hasAnyModels && (
                  <span className="text-neutral-400 dark:text-neutral-500">·</span>
                )}
                {hasAnyModels && (
                  <span className="hidden sm:inline">{currentModelLabel}</span>
                )}
                <svg className="h-3 w-3 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
                {showConfigDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowConfigDropdown(false)}
                    />
                    <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                      {/* Scrollable model list */}
                      <div className="max-h-[300px] overflow-y-auto py-1">
                        {settings.agentProviders.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-neutral-500 dark:text-neutral-400">
                            No providers configured
                          </div>
                        ) : (
                          settings.agentProviders.map((provider) => {
                            const models = PROVIDER_MODELS[provider.type] || [];
                            return (
                              <div key={provider.type}>
                                {/* Provider Header */}
                                <div className="px-3 py-1.5 text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                                  {PROVIDER_LABELS[provider.type] || provider.type}
                                </div>
                                
                                {/* Provider Default Option */}
                                <button
                                  onClick={() => {
                                    setActiveAgentProvider(provider.type);
                                    setChatSelectedModel(null);
                                    setShowConfigDropdown(false);
                                  }}
                                  className={`w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                                    settings.activeAgentProvider === provider.type && !settings.chatSettings.chatSelectedModel
                                      ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
                                      : 'text-neutral-700 dark:text-neutral-300'
                                  }`}
                                  type="button"
                                >
                                  Default
                                </button>

                                {/* Model Options */}
                                {models.map((model) => (
                                  <button
                                    key={model}
                                    onClick={() => {
                                      setActiveAgentProvider(provider.type);
                                      setChatSelectedModel(model);
                                      setShowConfigDropdown(false);
                                    }}
                                    className={`w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                                      settings.activeAgentProvider === provider.type && settings.chatSettings.chatSelectedModel === model
                                        ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
                                        : 'text-neutral-600 dark:text-neutral-400'
                                    }`}
                                    type="button"
                                  >
                                    {MODEL_SHORT_LABELS[model] || model.split('/').pop() || model}
                                  </button>
                                ))}
                              </div>
                            );
                          })
                        )}
                      </div>
                      
                      {/* Footer with disable option */}
                      {settings.agentProviders.length > 0 && (
                        <>
                          <div className="border-t border-neutral-100 dark:border-neutral-800" />
                          <button
                            onClick={() => {
                              setActiveAgentProvider(null);
                              setChatSelectedModel(null);
                              setShowConfigDropdown(false);
                            }}
                            className={`w-full px-3 py-2 text-left text-xs transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                              !settings.activeAgentProvider
                                ? 'bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100'
                                : 'text-neutral-500 dark:text-neutral-400'
                            }`}
                            type="button"
                          >
                            None (disable AI chat)
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
            </div>

            <Button onClick={resetConversation} size="sm" variant="ghost">
              New chat
            </Button>
          </div>
        </div>
      </div>

      {topContent ? (
        <div className="border-b border-neutral-200 bg-neutral-50/50 px-5 py-4 dark:border-neutral-800 dark:bg-neutral-900/30">
          {topContent}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <div className="space-y-4">
          {messages.map((message) => {
            const isCurrentStreaming = isStreaming && message.id === streamingMessageId;
            const displayText = isCurrentStreaming && streamingContent ? streamingContent : message.text;
            const displayThinking = isCurrentStreaming && streamingThinking ? streamingThinking : message.thinking;
            
            return (
              <div className={message.role === 'assistant' ? 'mr-6' : 'ml-6'} key={message.id}>
                <div
                  className={[
                    'rounded-2xl px-4 py-3 text-sm leading-6',
                    message.role === 'assistant'
                      ? 'rounded-tl-sm bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                      : 'rounded-tr-sm bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900',
                  ].join(' ')}
                >
                  {/* Thinking block for assistant messages */}
                  {message.role === 'assistant' && (displayThinking || (isCurrentStreaming && streamingThinking)) && (
                    <ThinkingBlock thinking={displayThinking || ''} isStreaming={isCurrentStreaming} />
                  )}
                  
                  {/* Tool calls for assistant messages */}
                  {message.role === 'assistant' && message.toolCalls && message.toolCalls.length > 0 && (
                    <div className="space-y-1">
                      {message.toolCalls.map((toolCall, index) => (
                        <ToolCallDisplay
                          key={toolCall.id}
                          toolCall={toolCall}
                          result={message.toolResults?.find(r => r.toolCallId === toolCall.id)}
                        />
                      ))}
                    </div>
                  )}
                  
                  {/* Streaming indicator for active streaming message */}
                  {isCurrentStreaming && !streamingContent && !streamingThinking && (
                    <div className="flex items-center gap-2 py-2">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-400" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-400 animation-delay-150" />
                      <span className="h-2 w-2 animate-pulse rounded-full bg-neutral-400 animation-delay-300" />
                      <span className="text-xs text-neutral-500">Thinking...</span>
                    </div>
                  )}
                  
                  {/* Message content */}
                  {(displayText || isCurrentStreaming) && (
                    <div className={isCurrentStreaming ? 'animate-pulse' : ''}>
                      <ChatMarkdownView markdown={displayText} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-neutral-200 bg-white px-5 py-4 dark:border-neutral-800 dark:bg-neutral-900">
        <TextArea
          className="min-h-[80px]"
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          placeholder={placeholder}
          value={draft}
        />

        <Button
          className="mt-4 w-full"
          disabled={!canSend || !draft.trim()}
          isLoading={isSending}
          onClick={() => {
            void sendDraft();
          }}
          variant="primary"
        >
          {isStreaming ? 'Streaming...' : isSending ? 'Replying…' : 'Send'}
        </Button>
      </div>
    </div>
  );
}
