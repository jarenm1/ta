import 'monaco-editor/min/vs/editor/editor.main.css';
import { useEffect, useRef, useCallback } from 'react';
import type * as MonacoEditor from 'monaco-editor/esm/vs/editor/editor.api';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

type MonacoCodeEditorProps = {
  language: string;
  value: string;
  onChange: (value: string) => void;
  vimEnabled?: boolean;
};

type MonacoEnvironmentHost = typeof self & {
  MonacoEnvironment?: {
    getWorker: (_: string, label: string) => Worker;
  };
};

const monacoEnvironmentHost = self as MonacoEnvironmentHost;

if (!monacoEnvironmentHost.MonacoEnvironment) {
  monacoEnvironmentHost.MonacoEnvironment = {
    getWorker(_: string, label: string) {
      switch (label) {
        case 'css':
        case 'scss':
        case 'less':
          return new cssWorker();
        case 'handlebars':
        case 'html':
        case 'razor':
          return new htmlWorker();
        case 'json':
          return new jsonWorker();
        case 'javascript':
        case 'typescript':
          return new tsWorker();
        default:
          return new editorWorker();
      }
    },
  };
}

function resolveEditorTheme() {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'vs-dark';
  }
  return 'vs';
}

function configureMipsLanguage() {
  if (!monaco.languages.getLanguages().some((l) => l.id === 'mips')) {
    monaco.languages.register({ id: 'mips', extensions: ['.asm', '.s', '.mips'] });
    monaco.languages.setMonarchTokensProvider('mips', {
      tokenizer: {
        root: [
          [/\.[a-zA-Z_]\w*/, 'directive'],
          [/#.*$/, 'comment'],
          [/\b(add|addu|addi|addiu|sub|subu|and|andi|or|ori|xor|xori|nor|slt|sltu|slti|sltiu|sll|srl|sra|sllv|srlv|srav|beq|bne|bgtz|blez|j|jal|jr|jalr|lw|sw|lb|sb|lbu|lui|mfhi|mflo|mthi|mtlo|mult|multu|div|divu|syscall)\b/, 'keyword'],
          [/\b(zero|at|v0|v1|a0|a1|a2|a3|t0|t1|t2|t3|t4|t5|t6|t7|s0|s1|s2|s3|s4|s5|s6|s7|t8|t9|k0|k1|gp|sp|fp|ra|\$\w+)\b/, 'variable.predefined'],
          [/\b\d+\b/, 'number'],
          [/".*?"/, 'string'],
          [/[a-zA-Z_]\w*:/, 'type.identifier'],
          [/[a-zA-Z_]\w*/, 'identifier'],
        ],
      },
    });
    monaco.languages.setLanguageConfiguration('mips', {
      comments: { lineComment: '#' },
      brackets: [['(', ')']],
      autoClosingPairs: [{ open: '(', close: ')' }],
    });
  }
}

// Track mounted instances to prevent double initialization in StrictMode
const mountedInstances = new Set<string>();

function MonacoCodeEditor({ language, value, onChange, vimEnabled = false }: MonacoCodeEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<MonacoEditor.editor.IStandaloneCodeEditor | null>(null);
  const statusBarRef = useRef<HTMLDivElement | null>(null);
  const vimModeRef = useRef<{ dispose: () => void } | null>(null);
  const changeSubscriptionRef = useRef<MonacoEditor.IDisposable | null>(null);
  const instanceIdRef = useRef(`monaco-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  const onChangeRef = useRef(onChange);
  const mountedRef = useRef(false);

  onChangeRef.current = onChange;

  const performCleanup = useCallback(() => {
    const id = instanceIdRef.current;
    mountedInstances.delete(id);
    mountedRef.current = false;
    
    // Dispose change subscription first
    if (changeSubscriptionRef.current) {
      try {
        changeSubscriptionRef.current.dispose();
      } catch (e) {
        // Ignore
      }
      changeSubscriptionRef.current = null;
    }
    
    // Cleanup vim mode
    if (vimModeRef.current) {
      try {
        vimModeRef.current.dispose();
      } catch (e) {
        // Ignore
      }
      vimModeRef.current = null;
    }

    // Cleanup editor
    if (editorRef.current) {
      try {
        editorRef.current.dispose();
      } catch (e) {
        // Ignore
      }
      editorRef.current = null;
    }
  }, []);

  // Main initialization effect
  useEffect(() => {
    const id = instanceIdRef.current;
    
    // Prevent double initialization from StrictMode
    if (mountedInstances.has(id) || mountedRef.current) {
      return performCleanup;
    }

    if (!containerRef.current) {
      return performCleanup;
    }

    // Mark as mounted
    mountedInstances.add(id);
    mountedRef.current = true;

    // Small delay to ensure DOM is ready and avoid race conditions
    const initTimeout = setTimeout(() => {
      if (!mountedRef.current || !containerRef.current) return;

      configureMipsLanguage();

      // Clear any existing content in container (from StrictMode double-mount)
      containerRef.current.innerHTML = '';

      const editor = monaco.editor.create(containerRef.current, {
        automaticLayout: true,
        fontFamily: 'ui-monospace, SFMono-Regular, SF Mono, Menlo, monospace',
        fontSize: 14,
        language,
        lineNumbersMinChars: 3,
        minimap: { enabled: false },
        padding: { bottom: 16, top: 16 },
        scrollBeyondLastLine: false,
        tabSize: 2,
        value,
        readOnly: false,
      });

      monaco.editor.setTheme(resolveEditorTheme());
      editorRef.current = editor;

      // Set up change listener
      changeSubscriptionRef.current = editor.onDidChangeModelContent(() => {
        if (mountedRef.current) {
          const newValue = editor.getValue();
          // Only call onChange if value actually changed
          if (newValue !== value) {
            onChangeRef.current?.(newValue);
          }
        }
      });

      // Focus editor
      editor.focus();

      // Initialize vim mode if enabled
      if (vimEnabled && statusBarRef.current) {
        import('monaco-vim').then((vimModule) => {
          if (mountedRef.current && editorRef.current && statusBarRef.current && !vimModeRef.current) {
            vimModeRef.current = vimModule.initVimMode(editorRef.current, statusBarRef.current);
          }
        }).catch((error) => {
          console.error('Failed to load Vim mode:', error);
        });
      }
    }, 0);

    return () => {
      clearTimeout(initTimeout);
      performCleanup();
    };
  }, []); // Run once on mount

  // Handle vimEnabled changes after mount
  useEffect(() => {
    // Skip on initial mount - vim is handled in init effect
    if (!mountedRef.current || !editorRef.current) return;

    const setupVim = async () => {
      if (vimEnabled && !vimModeRef.current) {
        try {
          const vimModule = await import('monaco-vim');
          if (mountedRef.current && editorRef.current && statusBarRef.current) {
            vimModeRef.current = vimModule.initVimMode(editorRef.current, statusBarRef.current);
          }
        } catch (error) {
          console.error('Failed to load Vim mode:', error);
        }
      } else if (!vimEnabled && vimModeRef.current) {
        vimModeRef.current.dispose();
        vimModeRef.current = null;
      }
    };

    setupVim();
  }, [vimEnabled]);

  // Handle external value updates
  useEffect(() => {
    if (!mountedRef.current || !editorRef.current) return;

    const currentValue = editorRef.current.getValue();
    if (currentValue !== value) {
      const position = editorRef.current.getPosition();
      editorRef.current.setValue(value);
      if (position) {
        editorRef.current.setPosition(position);
      }
    }
  }, [value]);

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div 
        className="flex-1 min-h-0 overflow-hidden" 
        ref={containerRef}
        style={{ position: 'relative' }}
      />
      {vimEnabled && (
        <div
          ref={statusBarRef}
          className="h-6 shrink-0 border-t border-neutral-300 bg-neutral-100 px-2 text-xs leading-6 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400"
          style={{ minHeight: '24px' }}
        />
      )}
    </div>
  );
}

export default MonacoCodeEditor;
