import { useLocation } from 'react-router-dom';
import AgentChatPanel from './AgentChatPanel';

type AppAgentSidebarProps = {
  className?: string;
  contextLabel?: string;
};

function AppAgentSidebar({ className, contextLabel }: AppAgentSidebarProps) {
  const location = useLocation();

  return (
    <AgentChatPanel
      className={className || 'hidden xl:flex'}
      context={{
        pageKind: location.pathname === '/' ? 'dashboard' : location.pathname.includes('/workspace') ? 'workspace' : location.pathname.includes('/study-guides') ? 'study-guide' : 'course',
        pagePath: location.pathname,
        pageTitle: contextLabel,
      }}
      contextLabel={contextLabel}
      placeholder="Ask anything about this page."
    />
  );
}

export default AppAgentSidebar;
