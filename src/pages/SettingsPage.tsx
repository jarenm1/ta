import { useState } from 'react';
import { Button, Input, Select } from '../components/ui';
import { useSettings, type AgentProvider, type Theme } from '../settings/SettingsContext';

const PROVIDER_LABELS: Record<string, string> = {
  codex: 'OpenAI Codex',
  opencode: 'OpenCode',
  copilot: 'GitHub Copilot',
  openai: 'OpenAI GPT',
  anthropic: 'Anthropic Claude',
};

export default function SettingsPage() {
  const {
    settings,
    setTheme,
    addAgentProvider,
    removeAgentProvider,
    setActiveAgentProvider,
    updateChatSettings,
    setVimEnabled,
  } = useSettings();

  const [newProviderType, setNewProviderType] = useState<AgentProvider['type']>('openai');
  const [newApiKey, setNewApiKey] = useState('');
  const [showAddProvider, setShowAddProvider] = useState(false);

  const handleAddProvider = () => {
    let provider: AgentProvider;
    
    switch (newProviderType) {
      case 'codex':
        // Codex doesn't require API key - uses CLI session
        provider = { type: 'codex' };
        break;
      case 'opencode':
        // OpenCode doesn't require API key - uses CLI with config
        provider = { type: 'opencode' };
        break;
      case 'copilot':
        if (!newApiKey.trim()) return;
        provider = { type: 'copilot', token: newApiKey };
        break;
      case 'openai':
        if (!newApiKey.trim()) return;
        provider = { type: 'openai', apiKey: newApiKey };
        break;
      case 'anthropic':
        if (!newApiKey.trim()) return;
        provider = { type: 'anthropic', apiKey: newApiKey };
        break;
      default:
        return;
    }

    addAgentProvider(provider);
    setNewApiKey('');
    setShowAddProvider(false);
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return '•'.repeat(key.length);
    return `${key.slice(0, 4)}${'•'.repeat(key.length - 8)}${key.slice(-4)}`;
  };

  return (
    <main className="h-full overflow-hidden bg-neutral-100 px-4 py-3 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100 sm:px-6 sm:py-4">
      <div className="mx-auto h-full max-w-4xl">
        <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lg shadow-neutral-200/50 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-neutral-900/50">
          <header className="border-b border-neutral-200 px-5 py-6 dark:border-neutral-800 sm:px-8">
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 sm:text-3xl">
              Settings
            </h1>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              Manage your app preferences and AI agent providers
            </p>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8">
            <div className="space-y-8">
              {/* Appearance Section */}
              <section>
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                  Appearance
                </h2>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  Customize the look and feel of the application
                </p>
                
                <div className="mt-4">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Theme
                  </label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {(['light', 'dark', 'system'] as Theme[]).map((theme) => (
                      <button
                        key={theme}
                        className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                          settings.theme === theme
                            ? 'border-neutral-800 bg-neutral-800 text-white dark:border-neutral-200 dark:bg-neutral-200 dark:text-neutral-900'
                            : 'border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:border-neutral-600'
                        }`}
                        onClick={() => setTheme(theme)}
                        type="button"
                      >
                        {theme.charAt(0).toUpperCase() + theme.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* Agent Providers Section */}
              <section className="border-t border-neutral-200 pt-8 dark:border-neutral-800">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                  AI Agent Providers
                </h2>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  Configure and manage your AI assistant providers. Model selection is available in the chat panel.
                </p>

                {/* Provider List */}
                <div className="mt-4 space-y-3">
                  {settings.agentProviders.map((provider) => (
                    <div
                      key={provider.type}
                      className={`flex items-center justify-between rounded-xl border p-4 ${
                        settings.activeAgentProvider === provider.type
                          ? 'border-neutral-400 bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900/50'
                          : 'border-neutral-200 dark:border-neutral-800'
                      }`}
                    >
                      <div>
                        <p className="font-medium text-neutral-900 dark:text-neutral-100">
                          {PROVIDER_LABELS[provider.type] || provider.type}
                          {settings.activeAgentProvider === provider.type && (
                            <span className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
                              (active)
                            </span>
                          )}
                        </p>
                        {provider.type === 'codex' ? (
                          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                            Uses local CLI session
                          </p>
                        ) : (
                          <p className="mt-1 font-mono text-sm text-neutral-500 dark:text-neutral-400">
                            {'apiKey' in provider && provider.apiKey 
                              ? maskKey(provider.apiKey) 
                              : 'token' in provider && provider.token 
                                ? maskKey(provider.token) 
                                : 'No key configured'}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {settings.activeAgentProvider !== provider.type && (
                          <Button
                            onClick={() => setActiveAgentProvider(provider.type)}
                            size="sm"
                            variant="secondary"
                          >
                            Activate
                          </Button>
                        )}
                        <Button
                          onClick={() => removeAgentProvider(provider.type)}
                          size="sm"
                          variant="danger"
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add New Provider */}
                {!showAddProvider ? (
                  <Button
                    className="mt-4"
                    onClick={() => setShowAddProvider(true)}
                    variant="secondary"
                  >
                    Add Provider
                  </Button>
                ) : (
                  <div className="mt-4 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
                    <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      Add New Provider
                    </h3>
                    
                    <div className="mt-4 space-y-4">
                      <Select
                        label="Provider Type"
                        onChange={(e) => {
                          setNewProviderType(e.target.value as AgentProvider['type']);
                          setNewApiKey('');
                        }}
                        options={[
                          { value: 'openai', label: 'OpenAI GPT' },
                          { value: 'anthropic', label: 'Anthropic Claude' },
                          { value: 'opencode', label: 'OpenCode' },
                          { value: 'codex', label: 'OpenAI Codex' },
                          { value: 'copilot', label: 'GitHub Copilot' },
                        ]}
                        value={newProviderType}
                      />

                      {newProviderType === 'codex' || newProviderType === 'opencode' ? (
                        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 dark:border-neutral-700 dark:bg-neutral-800/50">
                          <p className="text-sm text-neutral-600 dark:text-neutral-400">
                            {newProviderType === 'codex' ? (
                              <>Codex uses your local CLI session. Make sure you're logged in with <code className="rounded bg-neutral-200 px-1 py-0.5 text-xs dark:bg-neutral-700">codex login</code></>
                            ) : (
                              <>OpenCode uses your local CLI with multi-provider support. Configure providers with <code className="rounded bg-neutral-200 px-1 py-0.5 text-xs dark:bg-neutral-700">opencode config</code></>
                            )}
                          </p>
                        </div>
                      ) : (
                        <Input
                          label="API Key / Token"
                          onChange={(e) => setNewApiKey(e.target.value)}
                          placeholder="Enter your API key"
                          type="password"
                          value={newApiKey}
                        />
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button 
                          onClick={handleAddProvider} 
                          variant="primary"
                          disabled={newProviderType !== 'codex' && newProviderType !== 'opencode' && !newApiKey.trim()}
                        >
                          Add Provider
                        </Button>
                        <Button
                          onClick={() => {
                            setShowAddProvider(false);
                            setNewApiKey('');
                          }}
                          variant="ghost"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* Chat Settings Section */}
              <section className="border-t border-neutral-200 pt-8 dark:border-neutral-800">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                  Chat Settings
                </h2>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  Configure chat behavior and display options
                </p>

                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-neutral-900 dark:text-neutral-100">Auto-scroll</p>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        Automatically scroll to new messages
                      </p>
                    </div>
                    <button
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        settings.chatSettings.autoScroll
                          ? 'bg-neutral-800 dark:bg-neutral-200'
                          : 'bg-neutral-300 dark:bg-neutral-700'
                      }`}
                      onClick={() =>
                        updateChatSettings({ autoScroll: !settings.chatSettings.autoScroll })
                      }
                      type="button"
                    >
                      <span
                        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                          settings.chatSettings.autoScroll ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-neutral-900 dark:text-neutral-100">
                        Show Timestamps
                      </p>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        Display message timestamps in chat
                      </p>
                    </div>
                    <button
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        settings.chatSettings.showTimestamps
                          ? 'bg-neutral-800 dark:bg-neutral-200'
                          : 'bg-neutral-300 dark:bg-neutral-700'
                      }`}
                      onClick={() =>
                        updateChatSettings({
                          showTimestamps: !settings.chatSettings.showTimestamps,
                        })
                      }
                      type="button"
                    >
                      <span
                        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                          settings.chatSettings.showTimestamps ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </section>

              {/* Editor Settings Section */}
              <section className="border-t border-neutral-200 pt-8 dark:border-neutral-800">
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                  Editor Settings
                </h2>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  Configure code editor behavior
                </p>

                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-neutral-900 dark:text-neutral-100">Vim Mode</p>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400">
                        Enable Vim keybindings in the code editor
                      </p>
                    </div>
                    <button
                      className={`relative h-6 w-11 rounded-full transition-colors ${
                        settings.editorSettings.vimEnabled
                          ? 'bg-neutral-800 dark:bg-neutral-200'
                          : 'bg-neutral-300 dark:bg-neutral-700'
                      }`}
                      onClick={() => setVimEnabled(!settings.editorSettings.vimEnabled)}
                      type="button"
                    >
                      <span
                        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                          settings.editorSettings.vimEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
