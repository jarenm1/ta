import { useMemo } from 'react';
import AgentChatPanel from './AgentChatPanel';
import useAgentChat from '../hooks/useAgentChat';

type StudyGuideAgentPanelProps = {
  className?: string;
  courseName: string;
  guideTitle?: string;
  selectedText: string;
};

function buildPromptTemplates(guideTitle?: string, selectedText?: string) {
  const excerpt = selectedText ? `Selected excerpt: "${selectedText}"` : 'Use the currently open section.';
  const guideLine = guideTitle ? `Guide: ${guideTitle}.` : 'Guide: current study guide.';

  return [
    {
      id: 'explain',
      label: 'Explain simply',
      text: `${guideLine} ${excerpt} Explain this in simpler language without leaving out the key idea.`,
    },
    {
      id: 'quiz',
      label: 'Quiz me',
      text: `${guideLine} ${excerpt} Ask me 3 short exam-style questions and wait for my answers.`,
    },
    {
      id: 'flashcards',
      label: 'Make flashcards',
      text: `${guideLine} ${excerpt} Turn this into concise flashcards with term on front and answer on back.`,
    },
    {
      id: 'pitfalls',
      label: 'Find pitfalls',
      text: `${guideLine} ${excerpt} List the common mistakes a student could make here and how to avoid them.`,
    },
  ];
}

export default function StudyGuideAgentPanel({ className, courseName, guideTitle, selectedText }: StudyGuideAgentPanelProps) {
  const promptTemplates = useMemo(
    () => buildPromptTemplates(guideTitle, selectedText),
    [guideTitle, selectedText],
  );

  return (
    <AgentChatPanel
      className={className}
      context={{
        courseName,
        guideTitle,
        pageKind: 'study-guide',
        pageTitle: guideTitle || 'Study guide',
        selectedText,
      }}
      placeholder="Ask a question about the selected section, request flashcards, or draft an exam prompt."
      topContent={
        <div className="space-y-4">
          <div className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
            <div>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">Course:</span>{' '}
              {courseName}
            </div>
            {guideTitle ? (
              <div>
                <span className="font-medium text-neutral-900 dark:text-neutral-100">Guide:</span>{' '}
                {guideTitle}
              </div>
            ) : null}
            <div>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">Selection:</span>{' '}
              {selectedText ? (
                <span className="line-clamp-4">"{selectedText}"</span>
              ) : (
                'Highlight any part of the guide to attach it here.'
              )}
            </div>
          </div>

          <StudyGuidePromptButtons promptTemplates={promptTemplates} />
        </div>
      }
    />
  );
}

function StudyGuidePromptButtons({ promptTemplates }: { promptTemplates: ReturnType<typeof buildPromptTemplates> }) {
  const { setDraft } = useAgentChat();

  return (
    <div className="flex flex-wrap gap-2">
      {promptTemplates.map((template) => (
        <button
          className="inline-flex items-center rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-all duration-200 hover:border-neutral-400 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:border-neutral-600 dark:hover:bg-neutral-700"
          key={template.id}
          onClick={() => {
            setDraft(template.text);
          }}
          type="button"
        >
          {template.label}
        </button>
      ))}
    </div>
  );
}
