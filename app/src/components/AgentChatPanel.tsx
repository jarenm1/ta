import type { ReactNode } from 'react';
import type { AgentChatContext } from '../lib/canvasApi';
import { Button, TextArea } from './ui';
import ChatMarkdownView from './ChatMarkdownView';
import useAgentChat from '../hooks/useAgentChat';
import { useSettings } from '../settings/SettingsContext';
import { useState } from 'react';

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
    messages,
    resetConversation,
    sendDraft,
    setDraft,
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
          {messages.map((message) => (
            <div className={message.role === 'assistant' ? 'mr-6' : 'ml-6'} key={message.id}>
              <div
                className={[
                  'rounded-2xl px-4 py-3 text-sm leading-6',
                  message.role === 'assistant'
                    ? 'rounded-tl-sm bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                    : 'rounded-tr-sm bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900',
                ].join(' ')}
              >
                <ChatMarkdownView markdown={message.text} />
              </div>
            </div>
          ))}
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
          {isSending ? 'Replying…' : 'Send'}
        </Button>
      </div>
    </div>
  );
}
