const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { builtinModules } = require('node:module');

const forgeCommand = process.argv[2];
const rootDir = path.resolve(__dirname, '..');
const viteOutputDir = path.join(rootDir, '.vite');
const buildDir = path.join(viteOutputDir, 'build');
const rendererName = 'main_window';
const rendererDir = path.join(viteOutputDir, 'renderer', rendererName);

if (!forgeCommand) {
  console.error('Usage: node ./scripts/run-forge.cjs <start|package|make|publish|build-app>');
  process.exit(1);
}

async function buildApp() {
  const { rm } = require('node:fs/promises');
  const { build, loadConfigFromFile, mergeConfig } = await import('vite');

  const externalModules = [
    'electron',
    ...builtinModules,
    ...builtinModules.map((moduleName) => `node:${moduleName}`),
  ];

  const resolveConfig = async (configFile) => {
    const resolved = await loadConfigFromFile(
      { command: 'build', mode: 'production' },
      path.join(rootDir, configFile),
    );

    return resolved?.config ?? {};
  };

  const createElectronBuildConfig = (entryFile, outputFile, emptyOutDir) => ({
    root: rootDir,
    publicDir: false,
    define: {
      MAIN_WINDOW_VITE_DEV_SERVER_URL: 'undefined',
      MAIN_WINDOW_VITE_NAME: JSON.stringify(rendererName),
    },
    build: {
      emptyOutDir,
      minify: true,
      outDir: buildDir,
      rollupOptions: {
        external: externalModules,
        output: {
          assetFileNames: 'assets/[name]-[hash][extname]',
          chunkFileNames: '[name]-[hash].js',
          entryFileNames: '[name].js',
          exports: 'auto',
          format: 'cjs',
        },
      },
      sourcemap: false,
      target: 'node20',
      lib: {
        entry: path.join(rootDir, entryFile),
        fileName: () => outputFile,
        formats: ['cjs'],
      },
    },
  });

  await rm(viteOutputDir, { force: true, recursive: true });

  await build(
    mergeConfig(
      await resolveConfig('vite.main.config.ts'),
      createElectronBuildConfig('src/main.ts', 'main.js', true),
    ),
  );

  await build(
    mergeConfig(
      await resolveConfig('vite.preload.config.ts'),
      createElectronBuildConfig('src/preload.ts', 'preload.js', false),
    ),
  );

  await build(
    mergeConfig(await resolveConfig('vite.renderer.config.ts'), {
      root: rootDir,
      base: './',
      publicDir: false,
      build: {
        emptyOutDir: true,
        minify: true,
        outDir: rendererDir,
        rollupOptions: {
          input: path.join(rootDir, 'index.html'),
        },
        sourcemap: false,
      },
    }),
  );
}

if (forgeCommand === 'build-app') {
  buildApp().catch((error) => {
    console.error(error);
    process.exit(1);
  });
  return;
}

const env = { ...process.env };
let mcpChild = null;

const resolveElectronOverrideDist = () => {
  if (env.ELECTRON_OVERRIDE_DIST_PATH) {
    return env.ELECTRON_OVERRIDE_DIST_PATH;
  }

  if (env.NIX_ELECTRON_DIST) {
    return env.NIX_ELECTRON_DIST;
  }

  const pathEntries = (env.PATH || '').split(path.delimiter).filter(Boolean);
  const electronExecutableName = process.platform === 'win32' ? 'electron.cmd' : 'electron';

  for (const pathEntry of pathEntries) {
    if (pathEntry.includes(`${path.sep}node_modules${path.sep}.bin`)) {
      continue;
    }

    const candidate = path.join(pathEntry, electronExecutableName);
    if (!fs.existsSync(candidate)) {
      continue;
    }

    return path.dirname(fs.realpathSync(candidate));
  }

  return undefined;
};

const electronOverrideDist = resolveElectronOverrideDist();
if (electronOverrideDist) {
  env.ELECTRON_OVERRIDE_DIST_PATH = electronOverrideDist;
}

const forgeBinary = path.resolve(
  rootDir,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron-forge.cmd' : 'electron-forge',
);

if (forgeCommand === 'start' && env.TA_DISABLE_MCP_AUTOSTART !== '1') {
  mcpChild = spawn('node', [path.resolve(rootDir, 'mcp-server', 'server.mjs')], {
    stdio: 'inherit',
    env,
  });

  mcpChild.on('error', (error) => {
    console.error('Failed to start Canvas MCP server:', error);
  });
}

const stopMcpChild = () => {
  if (mcpChild && !mcpChild.killed) {
    mcpChild.kill('SIGTERM');
  }
};

for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    stopMcpChild();
    child.kill(signal);
  });
}

const child = spawn(forgeBinary, [forgeCommand], {
  stdio: 'inherit',
  env,
});

child.on('exit', (code, signal) => {
  stopMcpChild();
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});

child.on('error', (error) => {
  stopMcpChild();
  console.error(error);
  process.exit(1);
});
