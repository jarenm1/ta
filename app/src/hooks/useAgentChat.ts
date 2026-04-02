import type { AgentChatContext } from '../lib/canvasApi';
import { useAgentChatState } from '../agent/AgentChatProvider';

type UseAgentChatOptions = {
  baseContext?: AgentChatContext;
  introMessage?: string;
};

function useAgentChat({ baseContext }: UseAgentChatOptions = {}) {
  const chatState = useAgentChatState();

  return {
    ...chatState,
    sendDraft: async (contextOverride?: Partial<AgentChatContext>) =>
      chatState.sendDraft({
        ...baseContext,
        ...contextOverride,
      }),
    sendMessage: async (messageText: string, contextOverride?: Partial<AgentChatContext>) =>
      chatState.sendMessage(messageText, {
        ...baseContext,
        ...contextOverride,
      }),
  };
}

export default useAgentChat;
