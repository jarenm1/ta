import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Badge, Button, Select, Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui';
import AgentChatPanel from '../components/AgentChatPanel';
import MonacoCodeEditor from '../components/MonacoCodeEditor';
import { useCanvasData } from '../canvas/CanvasDataContext';
import useAgentChat from '../hooks/useAgentChat';
import { useSettings } from '../settings/SettingsContext';
import { buildCoursePath } from '../lib/canvasApi';
import type { CodingWorkspaceRunResult } from '../lib/canvasApi';
import type { CodingProblemDocument, CodingProblemRecord } from '../lib/codingProblems';
import {
  buildCodingWorkspaceConfigFromProblem,
  getCodingWorkspaceConfig,
  type CodingWorkspaceTestCase,
} from '../lib/courseFeatures';
import { runCodingWorkspaceSubmission } from '../lib/codingWorkspaceRunner';

const BUILT_IN_PROBLEM_ID = '__built_in__';

function formatOutputPreview(expectedOutput: string, notes?: string) {
  return [`Expected output`, expectedOutput, notes ? `Notes: ${notes}` : '']
    .filter(Boolean)
    .join('\n\n');
}

function normalizeOutput(value: string) {
  return value.replace(/\r\n/g, '\n').trim();
}

type TestCaseVerdict = 'error' | 'failed' | 'passed';

function getTestCaseVerdict(
  testCase: CodingWorkspaceTestCase,
  runResult: CodingWorkspaceRunResult,
): TestCaseVerdict {
  if (runResult.phase === 'compile' || !runResult.ok) {
    return 'error';
  }

  return normalizeOutput(runResult.stdout) === normalizeOutput(testCase.expectedOutput)
    ? 'passed'
    : 'failed';
}

function formatVerdictLabel(verdict: TestCaseVerdict) {
  switch (verdict) {
    case 'passed':
      return 'Passed';
    case 'failed':
      return 'Output mismatch';
    case 'error':
      return 'Runtime error';
    default:
      return 'Not run';
  }
}

function buildWorkspacePromptTemplates(problemTitle: string, testLabel?: string) {
  return [
    {
      id: 'hint',
      label: 'Hint only',
      text: `For the coding problem "${problemTitle}", give me a hint only. Do not provide the full solution.`,
    },
    {
      id: 'strategy',
      label: 'Strategy',
      text: `For the coding problem "${problemTitle}", explain a step-by-step solving strategy without writing the final code for me.`,
    },
    {
      id: 'test',
      label: 'Explain test',
      text: `For the coding problem "${problemTitle}", explain what the${testLabel ? ` test case "${testLabel}"` : ' selected test case'} is checking and why it matters.`,
    },
  ];
}

function CourseCodingWorkspacePage() {
  const { courseSlug } = useParams();
  const { settings } = useSettings();
  const { coursesStatus, getCourseBySlug } = useCanvasData();
  const course = courseSlug ? getCourseBySlug(courseSlug) : undefined;
  const fallbackCodingWorkspace = course ? getCodingWorkspaceConfig(course) : null;
  const [savedProblemsStatus, setSavedProblemsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [savedProblemsErrorMessage, setSavedProblemsErrorMessage] = useState('');
  const [savedProblems, setSavedProblems] = useState<CodingProblemRecord[]>([]);
  const [selectedProblemId, setSelectedProblemId] = useState(
    fallbackCodingWorkspace ? BUILT_IN_PROBLEM_ID : '',
  );
  const [selectedProblemStatus, setSelectedProblemStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [selectedProblemErrorMessage, setSelectedProblemErrorMessage] = useState('');
  const [selectedProblemDocument, setSelectedProblemDocument] = useState<CodingProblemDocument | null>(
    null,
  );
  const isBuiltInSelected =
    selectedProblemId === BUILT_IN_PROBLEM_ID ||
    (!selectedProblemId && Boolean(fallbackCodingWorkspace) && savedProblems.length === 0);
  const codingWorkspace = useMemo(() => {
    if (isBuiltInSelected) {
      return fallbackCodingWorkspace;
    }

    return selectedProblemDocument
      ? buildCodingWorkspaceConfigFromProblem(selectedProblemDocument.payload)
      : null;
  }, [fallbackCodingWorkspace, isBuiltInSelected, selectedProblemDocument]);
  const [selectedTestCaseId, setSelectedTestCaseId] = useState(codingWorkspace?.testCases[0]?.id ?? '');
  const [code, setCode] = useState(codingWorkspace?.starterCode ?? '');
  const [outputPreview, setOutputPreview] = useState(
    codingWorkspace?.testCases[0]
      ? formatOutputPreview(
          codingWorkspace.testCases[0].expectedOutput,
          codingWorkspace.testCases[0].notes,
        )
      : 'Select a test case to inspect the expected output.',
  );
  const [runErrorMessage, setRunErrorMessage] = useState('');
  const [runResult, setRunResult] = useState<CodingWorkspaceRunResult | null>(null);
  const [runStatus, setRunStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [runAllStatus, setRunAllStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [runningTestCaseId, setRunningTestCaseId] = useState<string | null>(null);
  const [rightPanelTab, setRightPanelTab] = useState<'chat' | 'tests'>('tests');
  const [testCaseVerdicts, setTestCaseVerdicts] = useState<Record<string, TestCaseVerdict>>({});

  useEffect(() => {
    if (!course || !window.canvasApi) {
      return;
    }

    let isActive = true;

    setSavedProblemsStatus('loading');
    setSavedProblemsErrorMessage('');

    void window.canvasApi
      .listCodingProblems(course.id)
      .then((nextProblemList) => {
        if (!isActive) {
          return;
        }

        setSavedProblems(nextProblemList.codingProblems);
        setSavedProblemsStatus('ready');
        setSelectedProblemId((currentProblemId) => {
          if (
            currentProblemId &&
            currentProblemId !== BUILT_IN_PROBLEM_ID &&
            nextProblemList.codingProblems.some((problem) => problem.id === currentProblemId)
          ) {
            return currentProblemId;
          }

          if (nextProblemList.codingProblems[0]) {
            return nextProblemList.codingProblems[0].id;
          }

          return fallbackCodingWorkspace ? BUILT_IN_PROBLEM_ID : '';
        });
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setSavedProblems([]);
        setSavedProblemsStatus('error');
        setSavedProblemsErrorMessage(
          error instanceof Error ? error.message : 'Unable to load saved coding problems.',
        );
        setSelectedProblemId(fallbackCodingWorkspace ? BUILT_IN_PROBLEM_ID : '');
      });

    return () => {
      isActive = false;
    };
  }, [course, fallbackCodingWorkspace]);

  useEffect(() => {
    if (!course || !window.canvasApi || !selectedProblemId || selectedProblemId === BUILT_IN_PROBLEM_ID) {
      setSelectedProblemDocument(null);
      setSelectedProblemStatus('idle');
      setSelectedProblemErrorMessage('');
      return;
    }

    let isActive = true;

    setSelectedProblemStatus('loading');
    setSelectedProblemErrorMessage('');

    void window.canvasApi
      .getCodingProblem(course.id, selectedProblemId)
      .then((nextProblemDocument) => {
        if (!isActive) {
          return;
        }

        setSelectedProblemDocument(nextProblemDocument);
        setSelectedProblemStatus('ready');
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setSelectedProblemDocument(null);
        setSelectedProblemStatus('error');
        setSelectedProblemErrorMessage(
          error instanceof Error ? error.message : 'Unable to load the selected coding problem.',
        );
      });

    return () => {
      isActive = false;
    };
  }, [course, selectedProblemId]);

  useEffect(() => {
    if (!codingWorkspace) {
      return;
    }

    const firstTestCase = codingWorkspace.testCases[0];

    setCode(codingWorkspace.starterCode);
    setSelectedTestCaseId(firstTestCase?.id ?? '');
    setRunErrorMessage('');
    setRunResult(null);
    setRunStatus('idle');
    setRunAllStatus('idle');
    setRunningTestCaseId(null);
    setTestCaseVerdicts({});
    setOutputPreview(
      firstTestCase
        ? formatOutputPreview(firstTestCase.expectedOutput, firstTestCase.notes)
        : 'Select a test case to inspect the expected output.',
    );
  }, [codingWorkspace]);

  const selectedTestCase = useMemo(() => {
    return codingWorkspace?.testCases.find((testCase) => testCase.id === selectedTestCaseId) ?? null;
  }, [codingWorkspace, selectedTestCaseId]);

  const runVerdict = useMemo(() => {
    if (!selectedTestCase || !runResult || !runResult.ok || runResult.phase !== 'run') {
      return null;
    }

    return normalizeOutput(runResult.stdout) === normalizeOutput(selectedTestCase.expectedOutput)
      ? 'passed'
      : 'failed';
  }, [runResult, selectedTestCase]);

  const activeProblemRecord = useMemo(() => {
    if (isBuiltInSelected) {
      return null;
    }

    return (
      savedProblems.find((problem) => problem.id === selectedProblemId) ||
      selectedProblemDocument?.problem ||
      null
    );
  }, [isBuiltInSelected, savedProblems, selectedProblemDocument, selectedProblemId]);

  const workspacePromptTemplates = useMemo(
    () => buildWorkspacePromptTemplates(codingWorkspace?.title || 'Coding problem', selectedTestCase?.label),
    [codingWorkspace?.title, selectedTestCase?.label],
  );

  const runWorkspaceTestCase = async (testCase: CodingWorkspaceTestCase) => {
    if (!codingWorkspace) {
      throw new Error('Coding workspace runner is unavailable.');
    }
    const nextRunResult: CodingWorkspaceRunResult = await runCodingWorkspaceSubmission(
      codingWorkspace,
      code,
      testCase.input,
      window.canvasApi ?? null,
    );
    
    const nextVerdict = getTestCaseVerdict(testCase, nextRunResult);

    setTestCaseVerdicts((currentVerdicts) => ({
      ...currentVerdicts,
      [testCase.id]: nextVerdict,
    }));

    return {
      runResult: nextRunResult,
      verdict: nextVerdict,
    };
  };

  const handleRunSingleTest = async (testCase: CodingWorkspaceTestCase) => {
    if (!codingWorkspace) {
      return;
    }

    setSelectedTestCaseId(testCase.id);
    setRunningTestCaseId(testCase.id);
    setRunStatus('loading');
    setRunAllStatus('idle');
    setRunErrorMessage('');
    setRunResult(null);

    try {
      const { runResult: nextRunResult } = await runWorkspaceTestCase(testCase);

      setRunResult(nextRunResult);
      setRunStatus('ready');
      setOutputPreview(nextRunResult.stdout || nextRunResult.stderr || '(no output)');
    } catch (error) {
      setTestCaseVerdicts((currentVerdicts) => ({
        ...currentVerdicts,
        [testCase.id]: 'error',
      }));
      setRunStatus('error');
      setRunErrorMessage(error instanceof Error ? error.message : 'Unable to run the selected test.');
      setOutputPreview('Run failed before execution started.');
    } finally {
      setRunningTestCaseId(null);
    }
  };

  const handleRunAllTests = async () => {
    if (!codingWorkspace) {
      return;
    }

    setRunAllStatus('loading');
    setRunStatus('idle');
    setRunErrorMessage('');
    setRunResult(null);
    setTestCaseVerdicts({});

    const summaryLines = ['Run all summary'];
    let passedCount = 0;
    let failedCount = 0;
    let errorCount = 0;

    try {
      for (const testCase of codingWorkspace.testCases) {
        setRunningTestCaseId(testCase.id);

        try {
          const { runResult: nextRunResult, verdict } = await runWorkspaceTestCase(testCase);

          if (verdict === 'passed') {
            passedCount += 1;
          } else if (verdict === 'failed') {
            failedCount += 1;
          } else {
            errorCount += 1;
          }

          summaryLines.push(`${testCase.label}: ${formatVerdictLabel(verdict)}`);

          if (verdict === 'error') {
            summaryLines.push(nextRunResult.stderr || '(execution failed without stderr)');
          }

          if (nextRunResult.phase === 'compile') {
            break;
          }
        } catch (error) {
          errorCount += 1;
          setTestCaseVerdicts((currentVerdicts) => ({
            ...currentVerdicts,
            [testCase.id]: 'error',
          }));
          summaryLines.push(
            `${testCase.label}: ${
              error instanceof Error ? error.message : 'Unable to run the selected test.'
            }`,
          );
          break;
        }
      }

      summaryLines.splice(1, 0, `Passed: ${passedCount}`, `Mismatched: ${failedCount}`, `Errors: ${errorCount}`, '');
      setOutputPreview(summaryLines.join('\n'));
      setRunAllStatus('ready');
    } catch (error) {
      setRunAllStatus('error');
      setRunErrorMessage(error instanceof Error ? error.message : 'Unable to run all tests.');
    } finally {
      setRunningTestCaseId(null);
    }
  };

  if (coursesStatus === 'ready' && courseSlug && !course) {
    return <Navigate replace to="/" />;
  }

  if (!course) {
    return (
      <main className="bg-neutral-100 px-6 py-10 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
        <div className="mx-auto max-w-7xl">
          <p className="text-base leading-7 text-neutral-700 dark:text-neutral-300">
            {coursesStatus === 'error'
              ? 'Unable to load this course because the Canvas course list failed to load.'
              : 'Loading coding workspace…'}
          </p>
        </div>
      </main>
    );
  }

  if (
    savedProblemsStatus === 'ready' &&
    savedProblems.length === 0 &&
    !fallbackCodingWorkspace &&
    !codingWorkspace
  ) {
    return <Navigate replace to={buildCoursePath(course)} />;
  }

  if (!codingWorkspace) {
    return (
      <main className="bg-neutral-100 px-6 py-10 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
        <div className="mx-auto max-w-7xl">
          <p className="text-base leading-7 text-neutral-700 dark:text-neutral-300">
            {selectedProblemStatus === 'error'
              ? selectedProblemErrorMessage
              : savedProblemsStatus === 'error'
                ? savedProblemsErrorMessage
                : 'Loading coding workspace…'}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="h-full overflow-hidden bg-neutral-100 px-6 py-4 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
      <div className="mx-auto flex h-full max-w-[110rem] flex-col">
        <header className="shrink-0 border-b border-neutral-300 pb-4 dark:border-neutral-800">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <Link
                className="text-sm font-medium text-neutral-600 transition hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                to={buildCoursePath(course)}
              >
                ← Back to {course.course_code || course.name}
              </Link>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
                {codingWorkspace.title}
              </h1>
            </div>

            <div className="flex flex-col gap-3 md:items-end">
              {savedProblems.length > 0 ? (
                <Select
                  label="Problem"
                  onChange={(event) => {
                    setSelectedProblemId(event.target.value);
                  }}
                  options={[
                    ...(fallbackCodingWorkspace ? [{ value: BUILT_IN_PROBLEM_ID, label: `Built-in · ${fallbackCodingWorkspace.title}` }] : []),
                    ...savedProblems.map((problem) => ({ value: problem.id, label: `Saved · ${problem.title}` })),
                  ]}
                  value={selectedProblemId}
                />
              ) : null}

              <div className="flex flex-wrap justify-end gap-2">
                <Badge variant="soft">
                  {activeProblemRecord ? 'Saved MCP problem' : 'Built-in problem'}
                </Badge>
                <Badge variant="soft">{codingWorkspace.topic}</Badge>
                <Badge variant="soft">{codingWorkspace.language.toUpperCase()}</Badge>
                <Badge variant="soft">{codingWorkspace.difficulty}</Badge>
              </div>

              {selectedProblemStatus === 'error' ? (
                <p className="text-sm text-red-600 dark:text-red-400">{selectedProblemErrorMessage}</p>
              ) : null}
            </div>
          </div>
        </header>

        <div className="mt-4 grid min-h-0 flex-1 xl:grid-cols-[minmax(16rem,1fr)_minmax(0,48rem)_minmax(16rem,1fr)] rounded-lg overflow-hidden border border-neutral-300 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-900/80 shadow-sm">
          <aside className="min-h-0 space-y-6 overflow-y-auto px-5 py-5 bg-neutral-50/50 dark:bg-neutral-900/30">
            <section>
              <h2 className="text-xl font-semibold tracking-tight">Problem</h2>
              <div className="mt-4 space-y-4 text-sm leading-7 text-neutral-700 dark:text-neutral-300">
                {codingWorkspace.prompt.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                Constraints
              </h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7 text-neutral-700 dark:text-neutral-300">
                {codingWorkspace.constraints.map((constraint) => (
                  <li key={constraint}>{constraint}</li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                Walkthrough
              </h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-7 text-neutral-700 dark:text-neutral-300">
                {codingWorkspace.walkthrough.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>

            <section>
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                Examples
              </h3>
              <div className="mt-3 space-y-4">
                {codingWorkspace.examples.map((example) => (
                  <article
                    className="border border-neutral-200 px-4 py-4 dark:border-neutral-800"
                    key={example.title}
                  >
                    <h4 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                      {example.title}
                    </h4>
                    <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                      <span className="font-medium text-neutral-900 dark:text-neutral-100">Input:</span>{' '}
                      {example.input}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                      <span className="font-medium text-neutral-900 dark:text-neutral-100">Output:</span>{' '}
                      {example.output}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                      {example.explanation}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </aside>

          <section className="flex min-h-0 flex-col overflow-hidden bg-neutral-50/50 dark:bg-neutral-900/30 border-l border-neutral-300 dark:border-neutral-800">
            <div className="flex flex-col gap-3 border-b border-neutral-300 px-5 py-4 dark:border-neutral-800 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Code Editor</h2>
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  Monaco editor with a course-specific starter implementation.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    setCode(codingWorkspace.starterCode);
                  }}
                  size="sm"
                  variant="secondary"
                >
                  Reset starter code
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 px-2 py-2">
              <MonacoCodeEditor language={codingWorkspace.language} onChange={setCode} value={code} vimEnabled={settings.editorSettings.vimEnabled} />
            </div>
          </section>

          <aside className="flex min-h-0 flex-col overflow-hidden bg-neutral-50/50 dark:bg-neutral-900/30 border-l border-neutral-300 dark:border-neutral-800">
            <Tabs className="flex min-h-0 flex-col" defaultValue="tests" onValueChange={(value) => setRightPanelTab(value as 'tests' | 'chat')} value={rightPanelTab}>
              <TabsList className="shrink-0 border-b border-neutral-200 px-4 dark:border-neutral-800">
                <TabsTrigger value="tests">Tests</TabsTrigger>
                <TabsTrigger value="chat">Chat</TabsTrigger>
              </TabsList>
              
              <TabsContent className="min-h-0 flex-1 overflow-y-auto px-5 py-5" value="tests">
                <section>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight">Test Cases</h2>
                      <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                        Inspect the expected sample behavior before wiring execution.
                      </p>
                    </div>
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">
                      {codingWorkspace.testCases.length} saved
                    </span>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button
                      disabled={runAllStatus === 'loading' || Boolean(runningTestCaseId)}
                      isLoading={runAllStatus === 'loading'}
                      onClick={() => {
                        void handleRunAllTests();
                      }}
                      size="sm"
                      variant="secondary"
                    >
                      {runAllStatus === 'loading' ? 'Running all…' : 'Run all tests'}
                    </Button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {codingWorkspace.testCases.map((testCase) => {
                      const isSelected = testCase.id === selectedTestCaseId;
                      const verdict = testCaseVerdicts[testCase.id];
                      const isRunning = runningTestCaseId === testCase.id;

                      return (
                        <article
                          className={`border px-4 py-4 transition ${
                            isSelected
                              ? 'border-neutral-900 bg-neutral-50 dark:border-neutral-100 dark:bg-neutral-900'
                              : 'border-neutral-300 hover:border-neutral-500 dark:border-neutral-800 dark:hover:border-neutral-700'
                          }`}
                          key={testCase.id}
                        >
                          <button
                            className="w-full rounded-lg text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
                            onClick={() => {
                              setSelectedTestCaseId(testCase.id);
                              setRunErrorMessage('');
                              setRunResult(null);
                              setRunStatus('idle');
                              setRunAllStatus('idle');
                              setOutputPreview(formatOutputPreview(testCase.expectedOutput, testCase.notes));
                            }}
                            type="button"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                                {testCase.label}
                              </h3>
                              {isRunning ? (
                                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                                  Running…
                                </span>
                              ) : verdict ? (
                                <span
                                  className={`text-xs font-medium ${
                                    verdict === 'passed'
                                      ? 'text-emerald-700 dark:text-emerald-300'
                                      : verdict === 'failed'
                                        ? 'text-amber-700 dark:text-amber-300'
                                        : 'text-rose-700 dark:text-rose-300'
                                  }`}
                                >
                                  {formatVerdictLabel(verdict)}
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-2 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
                              <span className="font-medium text-neutral-900 dark:text-neutral-100">Input:</span>{' '}
                              {testCase.input}
                            </p>
                          </button>

                          <div className="mt-4 flex justify-end">
                            <Button
                              disabled={Boolean(runningTestCaseId)}
                              isLoading={isRunning}
                              onClick={() => {
                                void handleRunSingleTest(testCase);
                              }}
                              size="sm"
                              variant="secondary"
                            >
                              {isRunning ? 'Running…' : 'Run'}
                            </Button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className="mt-6">
                  <h2 className="text-xl font-semibold tracking-tight">Output</h2>
                  <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                    Run the selected test case to compare actual output against the expected result.
                  </p>

                  {selectedTestCase ? (
                    <div className="mt-4 border border-neutral-200 px-4 py-4 text-sm dark:border-neutral-800">
                      <p className="font-semibold text-neutral-900 dark:text-neutral-100">Expected output</p>
                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-neutral-700 dark:text-neutral-300">
                        {selectedTestCase.expectedOutput}
                      </pre>
                    </div>
                  ) : null}

                  {runStatus === 'ready' && runResult ? (
                    <div className="mt-4 border border-neutral-200 px-4 py-4 text-sm dark:border-neutral-800">
                      <p className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {runResult.phase === 'compile'
                          ? 'Compilation failed'
                          : !runResult.ok
                            ? 'Runtime error'
                            : runVerdict === 'passed'
                              ? 'Passed'
                              : runVerdict === 'failed'
                                ? 'Output mismatch'
                                : 'Program finished'}
                      </p>
                      <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                        {runResult.phase} · {runResult.durationMs} ms
                        {runResult.timedOut ? ' · timed out' : ''}
                      </p>
                    </div>
                  ) : null}

                  {runStatus === 'error' ? (
                    <p className="mt-4 text-sm leading-6 text-rose-700 dark:text-rose-300">
                      {runErrorMessage}
                    </p>
                  ) : null}

                  <pre className="mt-4 overflow-x-auto bg-neutral-50 px-4 py-4 text-sm leading-6 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-200">
                    {outputPreview}
                  </pre>

                  {runResult?.stderr ? (
                    <div className="mt-4">
                      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Errors</p>
                      <pre className="mt-2 overflow-x-auto bg-neutral-50 px-4 py-4 text-sm leading-6 text-rose-700 dark:bg-neutral-900 dark:text-rose-300">
                        {runResult.stderr}
                      </pre>
                    </div>
                  ) : null}
                </section>
              </TabsContent>
              
              <TabsContent className="min-h-0 flex-1" value="chat">
                <div className="h-full">
                  <AgentChatPanel
                    className="h-full border-0 bg-transparent"
                    context={{
                      courseId: course.id,
                      courseName: course.course_code || course.name,
                      pageKind: 'workspace',
                      pageTitle: codingWorkspace.title,
                      selectedText: selectedTestCase
                        ? `Problem: ${codingWorkspace.title}\nSelected test: ${selectedTestCase.label}\nInput: ${selectedTestCase.input}\nExpected output: ${selectedTestCase.expectedOutput}`
                        : `Problem: ${codingWorkspace.title}`,
                    }}
                    contextLabel={codingWorkspace.title}
                    placeholder="Ask for a hint, explain a test case, or debug the current approach."
                    topContent={
                      <CodingWorkspaceChatTopContent
                        problemTopic={codingWorkspace.topic}
                        promptTemplates={workspacePromptTemplates}
                        selectedTestLabel={selectedTestCase?.label}
                      />
                    }
                  />
                </div>
              </TabsContent>
            </Tabs>
          </aside>
        </div>
      </div>
    </main>
  );
}

function CodingWorkspaceChatTopContent({
  problemTopic,
  promptTemplates,
  selectedTestLabel,
}: {
  problemTopic: string;
  promptTemplates: ReturnType<typeof buildWorkspacePromptTemplates>;
  selectedTestLabel?: string;
}) {
  const { setDraft } = useAgentChat();

  return (
    <div className="space-y-4">
      <div className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
        <div>
          <span className="font-medium text-neutral-900 dark:text-neutral-100">Topic:</span> {problemTopic}
        </div>
        <div>
          <span className="font-medium text-neutral-900 dark:text-neutral-100">Selected test:</span>{' '}
          {selectedTestLabel || 'Choose a test on the Tests tab.'}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {promptTemplates.map((template) => (
          <Button
            className="rounded-full"
            key={template.id}
            onClick={() => {
              setDraft(template.text);
            }}
            size="sm"
            variant="secondary"
          >
            {template.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export default CourseCodingWorkspacePage;
