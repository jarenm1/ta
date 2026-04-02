import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { Button, EmptyState } from './ui';
import type {
  CourseKnowledgeBase,
  CourseMaterialRecord,
  UploadCourseMaterialsResult,
} from '../lib/courseMaterials';

type CourseKnowledgeBaseSectionProps = {
  courseId: number;
};

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';

type FeedbackState = {
  tone: 'neutral' | 'warning';
  message: string;
} | null;

function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function describeExtraction(material: CourseMaterialRecord) {
  if (material.textExtracted) {
    return material.textTruncated ? 'Indexed partially for MCP' : 'Indexed for MCP';
  }

  if (material.extractionStatus === 'empty') {
    return 'No readable text found';
  }

  if (material.extractionStatus === 'error') {
    return 'Import saved, text extraction failed';
  }

  return 'Metadata only';
}

function buildUploadFeedback(result: UploadCourseMaterialsResult): FeedbackState {
  if (result.canceled) {
    return null;
  }

  const parts: string[] = [];

  if (result.imported.length > 0) {
    parts.push(`Added ${result.imported.length} material${result.imported.length === 1 ? '' : 's'}.`);
  }

  if (result.skipped.length > 0) {
    parts.push(
      `Skipped ${result.skipped.length} file${result.skipped.length === 1 ? '' : 's'}: ${result.skipped
        .map((item) => item.name)
        .join(', ')}.`,
    );
  }

  if (parts.length === 0) {
    return null;
  }

  return {
    tone: result.skipped.length > 0 ? 'warning' : 'neutral',
    message: parts.join(' '),
  };
}

type DroppedFile = File & {
  path?: string;
};

function extractDroppedFilePaths(event: DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer.files)
    .map((file) => (file as DroppedFile).path)
    .filter((filePath): filePath is string => typeof filePath === 'string' && filePath.length > 0);
}

export default function CourseKnowledgeBaseSection({ courseId }: CourseKnowledgeBaseSectionProps) {
  const [knowledgeBase, setKnowledgeBase] = useState<CourseKnowledgeBase | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [removingMaterialId, setRemovingMaterialId] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadMaterials() {
      if (!window.canvasApi) {
        if (!isCancelled) {
          setLoadStatus('error');
          setErrorMessage('The desktop bridge is unavailable, so course materials cannot be managed.');
        }
        return;
      }

      setLoadStatus('loading');
      setErrorMessage('');

      try {
        const nextKnowledgeBase = await window.canvasApi.listCourseMaterials(courseId);

        if (!isCancelled) {
          setKnowledgeBase(nextKnowledgeBase);
          setLoadStatus('ready');
        }
      } catch (error) {
        if (!isCancelled) {
          setLoadStatus('error');
          setErrorMessage(
            error instanceof Error ? error.message : 'Unable to load course knowledge base.',
          );
        }
      }
    }

    void loadMaterials();

    return () => {
      isCancelled = true;
    };
  }, [courseId]);

  const materials = knowledgeBase?.materials || [];
  const summaryLabel = useMemo(() => {
    if (!knowledgeBase) {
      return '';
    }

    return `${knowledgeBase.summary.totalCount} stored • ${knowledgeBase.summary.extractedTextCount} indexed for MCP`;
  }, [knowledgeBase]);

  const handleUpload = async (filePaths?: string[]) => {
    if (!window.canvasApi) {
      setErrorMessage('The desktop bridge is unavailable, so uploads cannot start.');
      setLoadStatus('error');
      return;
    }

    setIsUploading(true);
    setErrorMessage('');
    setFeedback(null);

    try {
      const uploadResult = await window.canvasApi.uploadCourseMaterials(courseId, filePaths);

      setKnowledgeBase(uploadResult);
      setLoadStatus('ready');
      setFeedback(buildUploadFeedback(uploadResult));
    } catch (error) {
      setLoadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unable to upload materials.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragEnter = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    setIsDraggingOver(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();

    if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
      return;
    }

    setIsDraggingOver(false);
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDraggingOver(false);

    const filePaths = extractDroppedFilePaths(event);

    if (filePaths.length === 0) {
      setFeedback({
        tone: 'warning',
        message: 'Those dropped items did not include readable local file paths.',
      });
      return;
    }

    void handleUpload(filePaths);
  };

  const handleRemove = async (material: CourseMaterialRecord) => {
    if (!window.canvasApi) {
      setErrorMessage('The desktop bridge is unavailable, so materials cannot be removed.');
      setLoadStatus('error');
      return;
    }

    const confirmed = window.confirm(
      `Remove "${material.displayName}" from this course knowledge base?`,
    );

    if (!confirmed) {
      return;
    }

    setRemovingMaterialId(material.id);
    setErrorMessage('');
    setFeedback(null);

    try {
      const nextKnowledgeBase = await window.canvasApi.removeCourseMaterial(courseId, material.id);

      setKnowledgeBase(nextKnowledgeBase);
      setLoadStatus('ready');
    } catch (error) {
      setLoadStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Unable to remove this material.');
    } finally {
      setRemovingMaterialId(null);
    }
  };

  return (
    <section className="scroll-mt-16" id="course-knowledge-base">
      <div className="border-b border-neutral-200/60 pb-8 dark:border-neutral-800/60">
        <div
          className={`transition-colors duration-200 ${
            isDraggingOver
              ? 'bg-blue-50/50 dark:bg-blue-950/20'
              : ''
          }`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex-1">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500 dark:text-neutral-400">
                Course Knowledge Base
              </p>
              <h2 className="mt-2 text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                Course Materials
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600 dark:text-neutral-400 sm:text-base">
                Upload notes, handouts, or study docs for this course. They are stored locally and
                exposed to the Canvas MCP server so an agent can use them when building study guides
                or quizzes.
              </p>
              <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
                Drag files here or use the upload button.
              </p>
            </div>

            <Button
              disabled={isUploading}
              isLoading={isUploading}
              onClick={() => {
                void handleUpload();
              }}
            >
              Upload material
            </Button>
          </div>

          {isDraggingOver ? (
            <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50/30 p-4 dark:border-blue-900/50 dark:bg-blue-950/10">
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                Drop files to add them to this course.
              </p>
            </div>
          ) : null}
        </div>

        {summaryLabel ? (
          <p className="mt-6 text-sm text-neutral-600 dark:text-neutral-400">{summaryLabel}</p>
        ) : null}

        {loadStatus === 'loading' ? (
          <div className="mt-6">
            <p className="text-base leading-7 text-neutral-600 dark:text-neutral-400">
              Loading the course knowledge base…
            </p>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="mt-6">
            <p className="text-base leading-7 text-red-600 dark:text-red-400">{errorMessage}</p>
          </div>
        ) : null}

        {feedback ? (
          <div className="mt-6">
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                feedback.tone === 'warning'
                  ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300'
              }`}
            >
              {feedback.message}
            </div>
          </div>
        ) : null}

        {loadStatus === 'ready' && materials.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              description="Add files here to give the MCP server more course context."
              title="No uploaded materials yet"
            />
          </div>
        ) : null}

        {materials.length > 0 ? (
          <div className="mt-6">
            {materials.map((material) => {
              const isRemoving = removingMaterialId === material.id;

              return (
                <div
                  className="group flex flex-col gap-4 border-b border-neutral-200 py-4 transition-colors duration-200 last:border-b-0 hover:bg-neutral-50/50 dark:border-neutral-800 dark:hover:bg-neutral-900/20 md:flex-row md:items-start md:justify-between"
                  key={material.id}
                >
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-base font-semibold text-neutral-900 dark:text-neutral-100">
                      {material.displayName}
                    </h3>
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                      Added {formatDate(material.addedAt)} • {formatBytes(material.sizeBytes)} •{' '}
                      {describeExtraction(material)}
                    </p>
                    {material.extractionNote ? (
                      <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                        {material.extractionNote}
                      </p>
                    ) : null}
                    {material.textExcerpt ? (
                      <p className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
                        {material.textExcerpt}
                      </p>
                    ) : null}
                  </div>

                  <Button
                    disabled={isRemoving}
                    isLoading={isRemoving}
                    onClick={() => {
                      void handleRemove(material);
                    }}
                    size="sm"
                    variant="danger"
                  >
                    Remove
                  </Button>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}
