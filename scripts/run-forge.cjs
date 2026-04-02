const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const forgeCommand = process.argv[2];

if (!forgeCommand) {
  console.error('Usage: node ./scripts/run-forge.cjs <start|package|make|publish>');
  process.exit(1);
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
  __dirname,
  '..',
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'electron-forge.cmd' : 'electron-forge',
);

if (forgeCommand === 'start' && env.TA_DISABLE_MCP_AUTOSTART !== '1') {
  mcpChild = spawn('node', [path.resolve(__dirname, '..', 'mcp-server', 'server.mjs')], {
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
