import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import started from 'electron-squirrel-startup';
import {
  type AgentAuthStatus,
  type AgentChatRequest,
  type AgentChatResponse,
  buildCourseAssignmentsPath,
  canvasCoursesPath,
  normalizeCanvasEndpoint,
  type CanvasAssignment,
  type CanvasCourse,
  type CodingProblemDocument,
  type CourseCodingProblemList,
  type CodingWorkspaceRunRequest,
  type CodingWorkspaceRunResult,
  type CanvasSession,
  type ToolCall,
  type ToolResult,
  type AgentChatStreamEvent,
} from './lib/canvasApi';
import {
  importCourseMaterials,
  listCourseMaterials,
  removeCourseMaterial,
} from './lib/courseMaterialsStore';
import {
  clearSharedCanvasSession,
  loadSharedCanvasSession,
  saveSharedCanvasSession,
} from './lib/sharedCanvasSessionStore';

if (started) {
  app.quit();
}

type ListStudyGuides = (courseId: number) => Promise<{
  courseId: number;
  updatedAt: string | null;
  studyGuides: {
    id: string;
    courseId: number;
    title: string;
    createdAt: string;
    markdownRelativePath: string;
  }[];
}>;

type GetStudyGuideMarkdown = (
  courseId: number,
  guideId: string,
) => Promise<{
  guide: {
    id: string;
    courseId: number;
    title: string;
    createdAt: string;
    markdownRelativePath: string;
  };
  markdown: string;
}>;

type ListCodingProblems = (courseId: number) => Promise<CourseCodingProblemList>;

type GetCodingProblem = (courseId: number, problemId: string) => Promise<CodingProblemDocument>;

let studyGuideStorePromise: Promise<{
  getStudyGuideMarkdown: GetStudyGuideMarkdown;
  listStudyGuides: ListStudyGuides;
}> | null = null;

let codingProblemStorePromise: Promise<{
  getCodingProblem: GetCodingProblem;
  listCodingProblems: ListCodingProblems;
}> | null = null;

const OPENAI_RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
const DEFAULT_AGENT_MODEL = process.env.TA_OPENAI_CHAT_MODEL || 'gpt-5.1-codex-mini';
const CODEX_CLI_TIMEOUT_MS = 180000;
const MAIN_WINDOW_DEV_SERVER_URL =
  typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== 'undefined'
    ? MAIN_WINDOW_VITE_DEV_SERVER_URL
    : process.env.MAIN_WINDOW_VITE_DEV_SERVER_URL;
const MAIN_WINDOW_NAME =
  typeof MAIN_WINDOW_VITE_NAME !== 'undefined'
    ? MAIN_WINDOW_VITE_NAME
    : process.env.MAIN_WINDOW_VITE_NAME || 'main_window';

async function loadStudyGuideStore() {
  if (!studyGuideStorePromise) {
    studyGuideStorePromise = (async () => {
      const appPath = app.getAppPath();
      const studyGuideStoreModule = await import(
        pathToFileURL(path.join(appPath, 'mcp-server', 'study-guide-store.mjs')).href
      );

      return {
        getStudyGuideMarkdown: studyGuideStoreModule.getStudyGuideMarkdown as GetStudyGuideMarkdown,
        listStudyGuides: studyGuideStoreModule.listStudyGuides as ListStudyGuides,
      };
    })();
  }

  return studyGuideStorePromise;
}

async function loadCodingProblemStore() {
  if (!codingProblemStorePromise) {
    codingProblemStorePromise = (async () => {
      const appPath = app.getAppPath();
      const codingProblemStoreModule = await import(
        pathToFileURL(path.join(appPath, 'mcp-server', 'coding-problem-store.mjs')).href
      );

      return {
        getCodingProblem: codingProblemStoreModule.getCodingProblem as GetCodingProblem,
        listCodingProblems: codingProblemStoreModule.listCodingProblems as ListCodingProblems,
      };
    })();
  }

  return codingProblemStorePromise;
}

function parseLinkHeader(linkHeader: string | null) {
  if (!linkHeader) {
    return {} as Record<string, string>;
  }

  return linkHeader.split(',').reduce<Record<string, string>>((links, rawPart) => {
    const match = rawPart.match(/<([^>]+)>;\s*rel="([^"]+)"/i);

    if (!match) {
      return links;
    }

    const [, url, rel] = match;
    links[rel] = url;
    return links;
  }, {});
}

async function requestCanvasPage(session: CanvasSession, url: string) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.token}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Canvas request failed with status ${response.status}`);
  }

  return response;
}

async function listCanvasCourses(session: CanvasSession) {
  const endpoint = normalizeCanvasEndpoint(session.endpoint);
  const courses: CanvasCourse[] = [];
  let nextUrl: string | undefined = `${endpoint}${canvasCoursesPath}`;

  while (nextUrl) {
    const response = await requestCanvasPage(session, nextUrl);
    const pageData = (await response.json()) as CanvasCourse[];

    courses.push(...pageData);
    nextUrl = parseLinkHeader(response.headers.get('link')).next;
  }

  return courses;
}

async function listCourseAssignments(session: CanvasSession, courseId: number) {
  const endpoint = normalizeCanvasEndpoint(session.endpoint);
  const assignments: CanvasAssignment[] = [];
  let nextUrl: string | undefined = `${endpoint}${buildCourseAssignmentsPath(courseId)}`;

  while (nextUrl) {
    const response = await requestCanvasPage(session, nextUrl);
    const pageData = (await response.json()) as CanvasAssignment[];

    assignments.push(...pageData);
    nextUrl = parseLinkHeader(response.headers.get('link')).next;
  }

  return assignments;
}

async function runCommand(options: {
  args: string[];
  command: string;
  cwd: string;
  input?: string;
  timeoutMs: number;
}) {
  return new Promise<{
    durationMs: number;
    exitCode: number | null;
    stderr: string;
    stdout: string;
    timedOut: boolean;
  }>((resolve, reject) => {
    const startedAt = Date.now();
    const child = spawn(options.command, options.args, {
      cwd: options.cwd,
      stdio: 'pipe',
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      reject(error);
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, options.timeoutMs);

    if (options.input) {
      child.stdin.write(options.input);
    }
    child.stdin.end();

    child.on('close', (exitCode) => {
      clearTimeout(timer);

      resolve({
        durationMs: Date.now() - startedAt,
        exitCode: timedOut ? null : exitCode,
        stderr: timedOut
          ? `${stderr}${stderr ? '\n' : ''}Process timed out after ${options.timeoutMs}ms.`
          : stderr,
        stdout,
        timedOut,
      });
    });
  });
}

async function runCodingWorkspace(request: CodingWorkspaceRunRequest): Promise<CodingWorkspaceRunResult> {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ta-coding-workspace-'));
  const sourceExtension = request.language === 'cpp' ? 'cpp' : 'txt';
  const sourcePath = path.join(tempDir, `solution.${sourceExtension}`);
  const binaryPath = path.join(tempDir, 'solution.out');

  try {
    await writeFile(sourcePath, request.sourceCode, 'utf8');

    if (request.language !== 'cpp') {
      return {
        durationMs: 0,
        exitCode: null,
        ok: false,
        phase: 'compile',
        stderr: `Unsupported language: ${request.language}`,
        stdout: '',
        timedOut: false,
      };
    }

    const compilerCommand = process.env.CXX || 'g++';
    const compileResult = await runCommand({
      args: ['-std=c++17', '-O2', '-Wall', '-Wextra', sourcePath, '-o', binaryPath],
      command: compilerCommand,
      cwd: tempDir,
      timeoutMs: request.compileTimeoutMs ?? 10000,
    });

    if (compileResult.timedOut || compileResult.exitCode !== 0) {
      return {
        durationMs: compileResult.durationMs,
        exitCode: compileResult.exitCode,
        ok: false,
        phase: 'compile',
        stderr: compileResult.stderr,
        stdout: compileResult.stdout,
        timedOut: compileResult.timedOut,
      };
    }

    const runResult = await runCommand({
      args: [],
      command: binaryPath,
      cwd: tempDir,
      input: request.stdin,
      timeoutMs: request.runTimeoutMs ?? 5000,
    });

    return {
      durationMs: runResult.durationMs,
      exitCode: runResult.exitCode,
      ok: !runResult.timedOut && runResult.exitCode === 0,
      phase: 'run',
      stderr: runResult.stderr,
      stdout: runResult.stdout,
      timedOut: runResult.timedOut,
    };
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

async function resolveEnvAgentCredentials(): Promise<{
  apiKey: string;
  model: string;
  source: 'env';
}> {
  const envApiKey = String(process.env.OPENAI_API_KEY || '').trim();

  if (!envApiKey) {
    throw new Error('OPENAI_API_KEY is not set.');
  }

  return {
    apiKey: envApiKey,
    model: DEFAULT_AGENT_MODEL,
    source: 'env',
  };
}

function resolveCodexExecutable() {
  const pathCandidates = [
    String(process.env.TA_CODEX_BIN || '').trim(),
    ...String(process.env.PATH || '')
      .split(path.delimiter)
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => path.join(segment, 'codex')),
    path.join(os.homedir(), '.local', 'bin', 'codex'),
    path.join(os.homedir(), '.nix-profile', 'bin', 'codex'),
    path.join('/etc', 'profiles', 'per-user', os.userInfo().username, 'bin', 'codex'),
  ].filter(Boolean);

  for (const candidate of pathCandidates) {
    if (candidate === 'codex' || existsSync(candidate)) {
      return candidate;
    }
  }

  return 'codex';
}

async function getCodexLoginStatus() {
  return runCommand({
    args: ['login', 'status'],
    command: resolveCodexExecutable(),
    cwd: app.getPath('home'),
    timeoutMs: 15000,
  });
}

async function isCodexSessionAvailable() {
  try {
    const result = await getCodexLoginStatus();
    const combinedOutput = `${result.stdout}\n${result.stderr}`;
    return result.exitCode === 0 && /Logged in/i.test(combinedOutput);
  } catch {
    return false;
  }
}

async function getAgentAuthStatus(): Promise<AgentAuthStatus> {
  if (await isCodexSessionAvailable()) {
    return {
      available: true,
      model: 'codex-cli',
      source: 'codex_session',
    };
  }

  try {
    const credentials = await resolveEnvAgentCredentials();

    return {
      available: true,
      model: credentials.model,
      source: credentials.source,
    };
  } catch {
    return {
      available: false,
      model: DEFAULT_AGENT_MODEL,
      source: null,
    };
  }
}

function buildAgentSystemPrompt(context: AgentChatRequest['context']) {
  const contextLines = [
    context?.pageTitle ? `Page title: ${context.pageTitle}` : '',
    context?.pageKind ? `Page type: ${context.pageKind}` : '',
    context?.courseName ? `Course: ${context.courseName}` : '',
    context?.guideTitle ? `Study guide: ${context.guideTitle}` : '',
    context?.pagePath ? `Route: ${context.pagePath}` : '',
  ].filter(Boolean);

  return [
    'You are the in-app teaching assistant for a local-first Electron course app.',
    'Be concise, practical, and grounded in the current page context.',
    'If selected text is present, prioritize it over broader page context.',
    'When the user asks for study help, teach directly with examples and clear steps.',
    contextLines.length > 0 ? `Current context:\n${contextLines.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildAgentUserMessage(request: AgentChatRequest) {
  const selectedText = request.context?.selectedText?.trim();

  if (!selectedText) {
    return request.message;
  }

  return `Selected text:\n"""\n${selectedText}\n"""\n\nUser request:\n${request.message}`;
}

function buildCodexPrompt(request: AgentChatRequest) {
  const transcript = (request.history || [])
    .slice(-12)
    .map((message) => `${message.role === 'assistant' ? 'Assistant' : 'User'}: ${message.text}`)
    .join('\n\n');

  return [
    buildAgentSystemPrompt(request.context),
    transcript ? `Conversation so far:\n${transcript}` : '',
    `New user message:\n${buildAgentUserMessage(request)}`,
    'Reply directly to the newest user message. Keep the response concise, useful, and formatted for an in-app chat panel.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function extractResponseText(payload: any): string {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const output = Array.isArray(payload?.output) ? payload.output : [];
  const textParts = output.flatMap((item: any) => {
    const content = Array.isArray(item?.content) ? item.content : [];
    return content
      .map((part: any) => {
        if (typeof part?.text === 'string') {
          return part.text;
        }

        if (typeof part?.output_text === 'string') {
          return part.output_text;
        }

        return '';
      })
      .filter(Boolean);
  });

  return textParts.join('\n\n').trim();
}

// Helper function to emit streaming events to the renderer
function emitAgentChatStream(event: AgentChatStreamEvent) {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach((window) => {
    window.webContents.send('agent-chat-stream', event);
  });
}

// Extract thinking content from response payload
function extractThinkingContent(payload: any): string {
  if (typeof payload?.reasoning?.content === 'string') {
    return payload.reasoning.content;
  }
  
  // Check for reasoning in output items
  const output = Array.isArray(payload?.output) ? payload.output : [];
  const thinkingParts = output.flatMap((item: any) => {
    const content = Array.isArray(item?.content) ? item.content : [];
    return content
      .filter((part: any) => part?.type === 'reasoning')
      .map((part: any) => part.text || part.content || '')
      .filter(Boolean);
  });
  
  return thinkingParts.join('\n\n').trim();
}

// Extract tool calls from response payload
function extractToolCalls(payload: any): ToolCall[] {
  const output = Array.isArray(payload?.output) ? payload.output : [];
  const toolCalls: ToolCall[] = [];
  
  output.forEach((item: any) => {
    const content = Array.isArray(item?.content) ? item.content : [];
    content.forEach((part: any) => {
      if (part?.type === 'tool_use' || part?.type === 'function_call') {
        toolCalls.push({
          id: part.id || `tool-${Date.now()}-${toolCalls.length}`,
          name: part.name || part.function?.name || 'unknown',
          arguments: part.arguments || part.input || part.function?.arguments || {},
        });
      }
    });
  });
  
  return toolCalls;
}

// Retry helper with exponential backoff
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelayMs: number = 1000,
  retryableStatusCodes: number[] = [429, 500, 502, 503, 504]
): Promise<{ result: T; retryCount: number }> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      return { result, retryCount: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // Check if this is the last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Check if error is retryable (rate limit or server error)
      const isRetryable = retryableStatusCodes.some(code => 
        lastError!.message.includes(String(code)) ||
        lastError!.message.toLowerCase().includes('rate limit') ||
        lastError!.message.toLowerCase().includes('too many requests') ||
        lastError!.message.toLowerCase().includes('timeout') ||
        lastError!.message.toLowerCase().includes('network') ||
        lastError!.message.toLowerCase().includes('connection')
      );
      
      if (!isRetryable) {
        throw lastError;
      }
      
      // Exponential backoff with jitter
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000;
      console.log(`[RETRY] Attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Max retries exceeded');
}

async function sendAgentChatMessage(request: AgentChatRequest): Promise<AgentChatResponse> {
  console.log('[DEBUG] sendAgentChatMessage called with provider:', request.provider, 'model:', request.model);
  
  // Handle codex provider - try codex session first, then fall back to API key
  if (request.provider === 'codex') {
    if (await isCodexSessionAvailable()) {
      const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ta-codex-chat-'));
      const outputPath = path.join(tempDir, 'last-message.txt');
      const workspaceDir = path.join(app.getPath('userData'), 'codex-chat-workspace');

      try {
        await mkdir(workspaceDir, { recursive: true });

        // Build args with optional model flag
        const args = ['exec', '--skip-git-repo-check', '-C', workspaceDir, '-o', outputPath];
        if (request.model) {
          args.push('-m', request.model);
        }
        args.push(buildCodexPrompt(request));

        const result = await runCommand({
          args,
          command: resolveCodexExecutable(),
          cwd: workspaceDir,
          timeoutMs: CODEX_CLI_TIMEOUT_MS,
        });

        const combinedOutput = `${result.stdout}\n${result.stderr}`;

        if (result.timedOut || result.exitCode !== 0) {
          throw new Error(
            combinedOutput.trim() || `Codex exec failed with status ${result.exitCode ?? 'unknown'}.`,
          );
        }

        const message = (await readFile(outputPath, 'utf8')).trim();

        if (!message) {
          throw new Error('Codex returned an empty response.');
        }

        const threadMatch = combinedOutput.match(/thread_id":"([^"]+)"/);

        return {
          message,
          model: request.model || 'codex-cli',
          responseId: threadMatch?.[1] || null,
          source: 'codex_session',
        };
      } finally {
        await rm(tempDir, { force: true, recursive: true });
      }
    }

    // Fall back to API key if codex has one configured
    throw new Error('Codex session not available. Please run `codex login` or configure an API key.');
  }

  // Handle OpenCode provider - uses CLI with MCP support and multi-provider routing
  if (request.provider === 'opencode') {
    const opencodePath = process.env.OPENCODE_PATH || 'opencode';
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ta-opencode-chat-'));
    const outputPath = path.join(tempDir, 'last-message.txt');
    const workspaceDir = path.join(app.getPath('userData'), 'opencode-chat-workspace');
    const messageId = `msg-${Date.now()}`;

    try {
      await mkdir(workspaceDir, { recursive: true });

      // Build OpenCode args with model selection
      const args = ['chat', '--workspace', workspaceDir, '--output', outputPath];
      if (request.model) {
        args.push('--model', request.model);
      }
      args.push(buildCodexPrompt(request));

      let streamingStarted = false;
      let accumulatedThinking = '';
      let accumulatedContent = '';

      const { result, retryCount } = await withRetry(async () => {
        return new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve, reject) => {
          const child = spawn(opencodePath, args, {
            cwd: workspaceDir,
            env: {
              ...process.env,
              // Pass through any OpenCode config
              OPENCODE_CONFIG_PATH: process.env.OPENCODE_CONFIG_PATH,
            },
          });

          let stdout = '';
          let stderr = '';

          child.stdout?.on('data', (data) => {
            const chunk = data.toString();
            stdout += chunk;
            
            // Emit streaming content as it arrives
            if (!streamingStarted) {
              streamingStarted = true;
              emitAgentChatStream({
                type: 'thinking',
                data: 'Processing...',
                messageId,
              });
            }
            
            accumulatedContent += chunk;
            emitAgentChatStream({
              type: 'content',
              data: chunk,
              messageId,
            });
          });

          child.stderr?.on('data', (data) => {
            const chunk = data.toString();
            stderr += chunk;
            
            // Emit stderr as thinking/thought process
            if (chunk.trim()) {
              accumulatedThinking += chunk;
              emitAgentChatStream({
                type: 'thinking',
                data: chunk,
                messageId,
              });
            }
          });

          child.on('close', (code) => {
            resolve({ stdout, stderr, exitCode: code ?? 0 });
          });

          child.on('error', (err) => {
            reject(err);
          });
        });
      }, 2, 2000); // 2 retries, 2s base delay

      const combinedOutput = `${result.stdout}\n${result.stderr}`;

      if (result.exitCode !== 0) {
        emitAgentChatStream({
          type: 'error',
          data: { error: combinedOutput.trim() || `OpenCode failed with status ${result.exitCode}.` },
          messageId,
        });
        throw new Error(
          combinedOutput.trim() || `OpenCode failed with status ${result.exitCode}.`,
        );
      }

      const message = (await readFile(outputPath, 'utf8')).trim();

      if (!message) {
        throw new Error('OpenCode returned an empty response.');
      }

      // Emit final content and done event
      if (accumulatedContent !== message) {
        emitAgentChatStream({
          type: 'content',
          data: message.slice(accumulatedContent.length),
          messageId,
        });
      }
      
      emitAgentChatStream({
        type: 'done',
        data: '',
        messageId,
      });

      return {
        message,
        model: request.model || 'opencode-auto',
        responseId: null,
        retryCount,
        source: 'env',
        thinking: accumulatedThinking || undefined,
      };
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  }

  // Handle other providers via API keys
  if (request.provider === 'openai') {
    console.log('[DEBUG] Using OpenAI provider with model:', request.model);
    const apiKey = request.apiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set. Please configure your API key in Settings > AI Agent Providers.');
    }

    const model = request.model || DEFAULT_AGENT_MODEL;
    
    // Generate a message ID for streaming events
    const messageId = `msg-${Date.now()}`;
    
    const { result: response, retryCount } = await withRetry(async () => {
      const res = await fetch(OPENAI_RESPONSES_ENDPOINT, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          previous_response_id: request.previousResponseId || undefined,
          input: [
            {
              role: 'system',
              content: [{ type: 'input_text', text: buildAgentSystemPrompt(request.context) }],
            },
            {
              role: 'user',
              content: [{ type: 'input_text', text: buildAgentUserMessage(request) }],
            },
          ],
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `OpenAI request failed with status ${res.status}`);
      }

      return res;
    });

    const payload = await response.json();
    const message = extractResponseText(payload);
    const thinking = extractThinkingContent(payload);
    const toolCalls = extractToolCalls(payload);

    if (!message && !thinking) {
      throw new Error('OpenAI returned an empty response.');
    }

    // Emit thinking content in chunks to simulate streaming
    let thinkingChunks: string[] = [];
    if (thinking) {
      thinkingChunks = thinking.split(/(?<=[.!?])\s+/);
      thinkingChunks.forEach((chunk, index) => {
        setTimeout(() => {
          emitAgentChatStream({
            type: 'thinking',
            data: chunk + (index < thinkingChunks.length - 1 ? ' ' : ''),
            messageId,
          });
        }, index * 30); // 30ms delay between thinking chunks
      });
    }

    // Wait for thinking to complete before emitting content
    const thinkingDelay = thinking ? thinkingChunks.length * 30 + 100 : 0;

    // Emit tool calls if present
    toolCalls.forEach((toolCall) => {
      setTimeout(() => {
        emitAgentChatStream({
          type: 'tool_call',
          data: toolCall,
          messageId,
        });
      }, thinkingDelay);
    });

    // Emit content in chunks to simulate streaming
    let chunks: string[] = [];
    if (message) {
      chunks = message.split(/(?<=[.!?])\s+/);
      chunks.forEach((chunk, index) => {
        setTimeout(() => {
          emitAgentChatStream({
            type: 'content',
            data: chunk + (index < chunks.length - 1 ? ' ' : ''),
            messageId,
          });
        }, thinkingDelay + (index * 50)); // 50ms delay between chunks after thinking
      });
    }

    // Emit done event after all content
    setTimeout(() => {
      emitAgentChatStream({
        type: 'done',
        data: '',
        messageId,
      });
    }, message ? thinkingDelay + (chunks.length * 50) + 100 : thinkingDelay + 100);

    return {
      message,
      model,
      responseId: typeof payload?.id === 'string' ? payload.id : null,
      retryCount,
      source: 'env',
      thinking,
      toolCalls,
    };
  }

  // Handle Fireworks AI via their chat completions API
  // Legacy fallback: check codex session first, then env
  if (await isCodexSessionAvailable()) {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'ta-codex-chat-'));
    const outputPath = path.join(tempDir, 'last-message.txt');
    const workspaceDir = path.join(app.getPath('userData'), 'codex-chat-workspace');

    try {
      await mkdir(workspaceDir, { recursive: true });

      const result = await runCommand({
        args: ['exec', '--skip-git-repo-check', '-C', workspaceDir, '-o', outputPath, buildCodexPrompt(request)],
        command: resolveCodexExecutable(),
        cwd: workspaceDir,
        timeoutMs: CODEX_CLI_TIMEOUT_MS,
      });

      const combinedOutput = `${result.stdout}\n${result.stderr}`;

      if (result.timedOut || result.exitCode !== 0) {
        throw new Error(
          combinedOutput.trim() || `Codex exec failed with status ${result.exitCode ?? 'unknown'}.`,
        );
      }

      const message = (await readFile(outputPath, 'utf8')).trim();

      if (!message) {
        throw new Error('Codex returned an empty response.');
      }

      const threadMatch = combinedOutput.match(/thread_id":"([^"]+)"/);

      return {
        message,
        model: 'codex-cli',
        responseId: threadMatch?.[1] || null,
        source: 'codex_session',
      };
    } finally {
      await rm(tempDir, { force: true, recursive: true });
    }
  }

  const credentials = await resolveEnvAgentCredentials();
  const response = await fetch(OPENAI_RESPONSES_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${credentials.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: credentials.model,
      previous_response_id: request.previousResponseId || undefined,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: buildAgentSystemPrompt(request.context) }],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: buildAgentUserMessage(request) }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `OpenAI request failed with status ${response.status}`);
  }

  const payload = await response.json();
  const message = extractResponseText(payload);

  if (!message) {
    throw new Error('OpenAI returned an empty response.');
  }

  return {
    message,
    model: credentials.model,
    responseId: typeof payload?.id === 'string' ? payload.id : null,
    source: credentials.source,
  };
}

function registerCanvasHandlers() {
  ipcMain.handle('canvas:get-agent-auth-status', async () => {
    return getAgentAuthStatus();
  });

  ipcMain.handle('canvas:send-agent-chat-message', async (_event, request: AgentChatRequest) => {
    return sendAgentChatMessage(request);
  });

  ipcMain.handle('canvas:load-shared-session', async () => {
    return loadSharedCanvasSession();
  });

  ipcMain.handle('canvas:save-shared-session', async (_event, session: CanvasSession) => {
    return saveSharedCanvasSession(session);
  });

  ipcMain.handle('canvas:clear-shared-session', async () => {
    await clearSharedCanvasSession();
  });

  ipcMain.handle('canvas:list-courses', async (_event, session: CanvasSession) => {
    return listCanvasCourses(session);
  });

  ipcMain.handle(
    'canvas:list-course-assignments',
    async (_event, session: CanvasSession, courseId: number) => {
      return listCourseAssignments(session, courseId);
    },
  );

  ipcMain.handle('canvas:list-course-materials', async (_event, courseId: number) => {
    return listCourseMaterials(courseId);
  });

  ipcMain.handle('canvas:list-coding-problems', async (_event, courseId: number) => {
    const { listCodingProblems } = await loadCodingProblemStore();
    return listCodingProblems(courseId);
  });

  ipcMain.handle('canvas:get-coding-problem', async (_event, courseId: number, problemId: string) => {
    const { getCodingProblem } = await loadCodingProblemStore();
    return getCodingProblem(courseId, problemId);
  });

  ipcMain.handle('canvas:list-study-guides', async (_event, courseId: number) => {
    const { listStudyGuides } = await loadStudyGuideStore();
    return listStudyGuides(courseId);
  });

  ipcMain.handle('canvas:get-study-guide-markdown', async (_event, courseId: number, guideId: string) => {
    const { getStudyGuideMarkdown } = await loadStudyGuideStore();
    return getStudyGuideMarkdown(courseId, guideId);
  });

  ipcMain.handle('canvas:run-coding-workspace', async (_event, request: CodingWorkspaceRunRequest) => {
    return runCodingWorkspace(request);
  });

  ipcMain.handle(
    'canvas:upload-course-materials',
    async (event, courseId: number, filePaths?: string[]) => {
      if (Array.isArray(filePaths) && filePaths.length > 0) {
        return importCourseMaterials(courseId, filePaths);
      }

      const ownerWindow = BrowserWindow.fromWebContents(event.sender);
      const selection = await dialog.showOpenDialog(ownerWindow ?? undefined, {
        buttonLabel: 'Upload to course knowledge base',
        properties: ['openFile', 'multiSelections'],
        title: 'Upload course materials',
      });

      if (selection.canceled || selection.filePaths.length === 0) {
        const knowledgeBase = await listCourseMaterials(courseId);

        return {
          ...knowledgeBase,
          canceled: true,
          imported: [],
          skipped: [],
        };
      }

      return importCourseMaterials(courseId, selection.filePaths);
    },
  );

  ipcMain.handle('canvas:remove-course-material', async (_event, courseId: number, materialId: string) => {
    return removeCourseMaterial(courseId, materialId);
  });

  // Bulk download files from Canvas
  ipcMain.handle('canvas:bulk-download-files', async (_event, courseId: number, fileIds: string[], options?: {
    maxTextChars?: number;
    maxFileSize?: number;
    concurrency?: number;
  }) => {
    try {
      const session = await loadSharedCanvasSession();
      if (!session) {
        throw new Error('No Canvas session available');
      }

      // Import the MCP file downloader dynamically
      const fileDownloaderPath = path.join(__dirname, 'mcp-server', 'file-downloader.mjs');
      const canvasClientPath = path.join(__dirname, 'mcp-server', 'canvas-client.mjs');
      
      const { bulkDownloadFiles, saveMaterialsToManifest } = await import(fileDownloaderPath);
      const { getFileMetadata } = await import(canvasClientPath);

      // Get file metadata for all files
      const files = await Promise.all(
        fileIds.map(async (fileId: string) => {
          try {
            return await getFileMetadata(session, fileId);
          } catch (error: unknown) {
            return { 
              id: fileId, 
              error: error instanceof Error ? error.message : 'Unknown error', 
              display_name: `File ${fileId}` 
            };
          }
        })
      );

      const validFiles = files.filter((f: { error?: string }) => !f.error);
      const failedMetadata = files.filter((f: { error?: string; id: string; display_name: string }) => f.error).map((f: { id: string; display_name: string; error: string }) => ({
        fileId: f.id,
        fileName: f.display_name,
        error: f.error,
      }));

      // Download and extract files
      const result = await bulkDownloadFiles(session, validFiles, {
        courseId,
        maxTextChars: options?.maxTextChars || 12000,
        maxFileSize: options?.maxFileSize || 50 * 1024 * 1024,
        concurrency: options?.concurrency || 3,
      });

      // Save to manifest
      if (result.materials.length > 0) {
        await saveMaterialsToManifest(courseId, result.materials);
      }

      const allErrors = [...failedMetadata, ...result.errors];

      return {
        downloaded: result.downloaded,
        failed: allErrors.length,
        materials: result.materials.map((m: { 
          id: string; 
          displayName: string; 
          sizeBytes: number; 
          textExtracted: boolean;
          textLength: number;
          extractionStatus: string;
        }) => ({
          id: m.id,
          displayName: m.displayName,
          sizeBytes: m.sizeBytes,
          textExtracted: m.textExtracted,
          textLength: m.textLength,
          extractionStatus: m.extractionStatus,
        })),
        errors: allErrors,
      };
    } catch (error) {
      console.error('Bulk download failed:', error);
      return {
        downloaded: 0,
        failed: fileIds.length,
        materials: [],
        errors: fileIds.map(id => ({
          fileId: id,
          fileName: `File ${id}`,
          error: error instanceof Error ? error.message : 'Unknown error',
        })),
      };
    }
  });
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    ...(process.platform !== 'darwin' ? { titleBarOverlay: true } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  if (MAIN_WINDOW_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_NAME}/index.html`),
    );
  }

  if (MAIN_WINDOW_DEV_SERVER_URL || process.env.TA_OPEN_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools();
  }
};

app.on('ready', () => {
  registerCanvasHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
