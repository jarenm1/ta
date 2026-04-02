import type { CanvasApiBridge, CodingWorkspaceRunResult } from './canvasApi';
import { buildCodingWorkspaceRunnableSource, type CodingWorkspaceConfig } from './courseFeatures';
import { runMipsProgram } from './mipsMarsRunner';

type CanvasRunBridge = Pick<CanvasApiBridge, 'runCodingWorkspace'>;
type WorkspaceRunner = {
  run: (
    sourceCode: string,
    stdin: string,
    canvasApi?: CanvasRunBridge | null,
  ) => Promise<CodingWorkspaceRunResult>;
};

const cppConsoleRunner: WorkspaceRunner = {
  async run(sourceCode, stdin, canvasApi) {
    if (!canvasApi) {
      throw new Error('Coding workspace runner is unavailable.');
    }

    return canvasApi.runCodingWorkspace({
      language: 'cpp',
      sourceCode,
      stdin,
    });
  },
};

const mipsRunner: WorkspaceRunner = {
  async run(sourceCode, stdin) {
    return runMipsProgram(sourceCode, stdin);
  },
};

const workspaceRunners: Record<CodingWorkspaceConfig['runnerKind'], WorkspaceRunner> = {
  'cpp-linked-list-reverse': cppConsoleRunner,
  'cpp-stdin-console': cppConsoleRunner,
  'mips-wasm': mipsRunner,
};

async function runCodingWorkspaceSource(
  workspace: Pick<CodingWorkspaceConfig, 'runnerKind'>,
  sourceCode: string,
  stdin: string,
  canvasApi?: CanvasRunBridge | null,
) {
  return workspaceRunners[workspace.runnerKind].run(sourceCode, stdin, canvasApi);
}

async function runCodingWorkspaceSubmission(
  workspace: Pick<CodingWorkspaceConfig, 'runnerKind'>,
  sourceCode: string,
  stdin: string,
  canvasApi?: CanvasRunBridge | null,
) {
  const runnableSource = buildCodingWorkspaceRunnableSource(workspace, sourceCode);
  return runCodingWorkspaceSource(workspace, runnableSource, stdin, canvasApi);
}

export { runCodingWorkspaceSource, runCodingWorkspaceSubmission };
