import { MIPS as MarsRuntime } from '../vendor/specy-mips/index.mjs';
import type { CodingWorkspaceRunResult } from './canvasApi';
import { runMIPS as runFallbackMIPS } from './mipsSimulator';

type MarsAssembleError = {
  columnNumber: number;
  filename: string;
  isWarning: boolean;
  lineNumber: number;
  macroExpansionHistory: string;
  message: string;
};

type MarsAssembleResult = {
  errors: MarsAssembleError[];
  hasErrors: boolean;
  report: string;
};

type MarsSimulator = {
  assemble: () => MarsAssembleResult;
  initialize: (startAtMain: boolean) => void;
  registerHandler: (name: string, handler: (...args: any[]) => unknown) => void;
  simulateWithLimit: (limit: number) => boolean;
  terminated: boolean;
};

type MarsModule = {
  initializeMIPS?: () => void;
  makeMipsFromSource?: (source: string) => MarsSimulator;
};

const DEFAULT_MAX_STEPS = 100_000;
const FILE_SYSCALL_ERROR = 'File syscalls are not supported in the coding workspace runner.';

let marsInitialized = false;

function decodeBytes(bytes: number[]) {
  return bytes
    .map((value) => String.fromCharCode(value < 0 ? value + 256 : value))
    .join('');
}

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function formatAssembleErrors(result: MarsAssembleResult) {
  const blockingErrors = result.errors.filter((error) => !error.isWarning);

  if (!blockingErrors.length) {
    return result.report.trim() || 'Assembly failed.';
  }

  return blockingErrors
    .map((error) => {
      const location = error.lineNumber > 0 ? `line ${error.lineNumber}:${Math.max(error.columnNumber, 1)}` : 'unknown line';
      const macroHistory = error.macroExpansionHistory.trim();

      return [location, error.message.trim(), macroHistory].filter(Boolean).join('\n');
    })
    .join('\n\n');
}

function createInputReader(stdin: string) {
  const normalizedInput = stdin.replace(/\r\n/g, '\n');
  let cursor = 0;

  const readLine = () => {
    if (cursor >= normalizedInput.length) {
      return '';
    }

    const nextNewline = normalizedInput.indexOf('\n', cursor);

    if (nextNewline === -1) {
      const value = normalizedInput.slice(cursor);
      cursor = normalizedInput.length;
      return value;
    }

    const value = normalizedInput.slice(cursor, nextNewline);
    cursor = nextNewline + 1;
    return value;
  };

  const readToken = () => {
    while (cursor < normalizedInput.length && /\s/.test(normalizedInput[cursor])) {
      cursor += 1;
    }

    if (cursor >= normalizedInput.length) {
      return '';
    }

    const tokenStart = cursor;

    while (cursor < normalizedInput.length && !/\s/.test(normalizedInput[cursor])) {
      cursor += 1;
    }

    return normalizedInput.slice(tokenStart, cursor);
  };

  const readChar = () => {
    if (cursor >= normalizedInput.length) {
      return '\0';
    }

    const nextChar = normalizedInput[cursor];
    cursor += 1;
    return nextChar;
  };

  const fillBytes = (destination: number[], length: number) => {
    const nextLine = readLine();
    const encoded = Array.from(`${nextLine}\n`).slice(0, length).map((value) => value.charCodeAt(0));

    for (let index = 0; index < length; index += 1) {
      destination[index] = encoded[index] ?? 0;
    }
  };

  return {
    fillBytes,
    readChar,
    readDouble: () => Number.parseFloat(readToken() || '0'),
    readFloat: () => Number.parseFloat(readToken() || '0'),
    readInt: () => Number.parseInt(readToken() || '0', 10),
    readLine,
    readString: readLine,
  };
}

function makeMarsSimulator(source: string) {
  const marsModule = MarsRuntime as unknown as MarsModule;

  if (!marsInitialized && typeof marsModule.initializeMIPS === 'function') {
    marsModule.initializeMIPS();
    marsInitialized = true;
  }

  if (typeof marsModule.makeMipsFromSource !== 'function') {
    throw new Error('Vendored MARS runtime is missing makeMipsFromSource().');
  }

  return marsModule.makeMipsFromSource(source);
}

function runWithMars(source: string, stdin: string, maxSteps: number): CodingWorkspaceRunResult {
  const startedAt = Date.now();
  const stdout: string[] = [];
  const stderr: string[] = [];
  const inputReader = createInputReader(stdin);
  const simulator = makeMarsSimulator(source);
  const blockingErrors = (result: MarsAssembleResult) => result.errors.filter((error) => !error.isWarning);
  const appendStdout = (value: string) => {
    stdout.push(value);
  };
  const appendStderr = (value: string) => {
    stderr.push(value);
  };

  simulator.registerHandler('printInt', (value: number) => appendStdout(String(value)));
  simulator.registerHandler('printFloat', (value: number) => appendStdout(String(value)));
  simulator.registerHandler('printDouble', (value: number) => appendStdout(String(value)));
  simulator.registerHandler('printChar', (value: string) => appendStdout(value));
  simulator.registerHandler('printString', (value: string) => appendStdout(value));
  simulator.registerHandler('stdOut', (buffer: number[]) => appendStdout(decodeBytes(buffer)));
  simulator.registerHandler('log', (message: string) => appendStderr(message));
  simulator.registerHandler('logLine', (message: string) => appendStderr(`${message}\n`));
  simulator.registerHandler('readInt', () => inputReader.readInt());
  simulator.registerHandler('readFloat', () => inputReader.readFloat());
  simulator.registerHandler('readDouble', () => inputReader.readDouble());
  simulator.registerHandler('readChar', () => inputReader.readChar());
  simulator.registerHandler('readString', () => inputReader.readString());
  simulator.registerHandler('stdIn', (buffer: number[], length: number) => inputReader.fillBytes(buffer, length));
  simulator.registerHandler('askInt', () => inputReader.readInt());
  simulator.registerHandler('askFloat', () => inputReader.readFloat());
  simulator.registerHandler('askDouble', () => inputReader.readDouble());
  simulator.registerHandler('askString', () => inputReader.readString());
  simulator.registerHandler('inputDialog', (message: string) => {
    appendStderr(`${message}\n`);
    return inputReader.readString();
  });
  simulator.registerHandler('confirm', () => 2);
  simulator.registerHandler('outputDialog', (message: string) => appendStderr(`${message}\n`));
  simulator.registerHandler('sleep', () => undefined);
  simulator.registerHandler('openFile', () => {
    throw new Error(FILE_SYSCALL_ERROR);
  });
  simulator.registerHandler('closeFile', () => undefined);
  simulator.registerHandler('writeFile', () => {
    throw new Error(FILE_SYSCALL_ERROR);
  });
  simulator.registerHandler('readFile', () => {
    throw new Error(FILE_SYSCALL_ERROR);
  });

  const assembleResult = simulator.assemble();

  if (blockingErrors(assembleResult).length > 0) {
    return {
      durationMs: Date.now() - startedAt,
      exitCode: 1,
      ok: false,
      phase: 'compile',
      stderr: formatAssembleErrors(assembleResult),
      stdout: '',
      timedOut: false,
    };
  }

  try {
    simulator.initialize(true);
  } catch {
    simulator.initialize(false);
  }

  try {
    const completed = simulator.simulateWithLimit(maxSteps);
    const timedOut = !completed && !simulator.terminated;

    if (timedOut) {
      appendStderr(`Execution limit reached (${maxSteps} steps)\n`);
    }

    return {
      durationMs: Date.now() - startedAt,
      exitCode: timedOut ? null : 0,
      ok: !timedOut && stderr.length === 0,
      phase: 'run',
      stderr: stderr.join(''),
      stdout: stdout.join(''),
      timedOut,
    };
  } catch (error) {
    appendStderr(`${normalizeErrorMessage(error)}\n`);

    return {
      durationMs: Date.now() - startedAt,
      exitCode: 1,
      ok: false,
      phase: 'run',
      stderr: stderr.join(''),
      stdout: stdout.join(''),
      timedOut: false,
    };
  }
}

function runWithFallbackSimulator(source: string, stdin: string, maxSteps: number): CodingWorkspaceRunResult {
  const startedAt = Date.now();
  const result = runFallbackMIPS(source, stdin, maxSteps);

  if (result.error) {
    return {
      durationMs: Date.now() - startedAt,
      exitCode: 1,
      ok: false,
      phase: 'compile',
      stderr: result.error,
      stdout: '',
      timedOut: false,
    };
  }

  const timedOut = result.exitCode === null && /Execution limit reached/.test(result.stderr);

  return {
    durationMs: Date.now() - startedAt,
    exitCode: timedOut ? null : (result.exitCode ?? 0),
    ok: !timedOut && result.exitCode === 0 && !result.stderr,
    phase: 'run',
    stderr: result.stderr,
    stdout: result.stdout,
    timedOut,
  };
}

async function runMipsProgram(source: string, stdin: string = '', maxSteps: number = DEFAULT_MAX_STEPS) {
  try {
    return runWithMars(source, stdin, maxSteps);
  } catch (error) {
    const fallbackResult = runWithFallbackSimulator(source, stdin, maxSteps);
    const integrationMessage = `Fell back to the built-in simulator: ${normalizeErrorMessage(error)}`;

    if (fallbackResult.ok) {
      return fallbackResult;
    }

    if (fallbackResult.stderr) {
      return {
        ...fallbackResult,
        stderr: `${integrationMessage}\n${fallbackResult.stderr}`,
      };
    }

    return {
      ...fallbackResult,
      stderr: integrationMessage,
    };
  }
}

export { runMipsProgram };
