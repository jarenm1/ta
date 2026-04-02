#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Find electron binary
function findElectron() {
  // First check if electron is in PATH
  const electronInPath = process.platform === 'win32' ? 'electron.cmd' : 'electron';
  
  // Check node_modules/.bin
  const localElectron = path.join(__dirname, '..', 'node_modules', '.bin', electronInPath);
  if (fs.existsSync(localElectron)) {
    return localElectron;
  }
  
  // Check for system electron (NixOS, etc)
  if (process.env.ELECTRON_OVERRIDE_DIST_PATH) {
    const electronPath = path.join(process.env.ELECTRON_OVERRIDE_DIST_PATH, electronInPath);
    if (fs.existsSync(electronPath)) {
      return electronPath;
    }
  }
  
  // Fall back to electron in PATH
  return electronInPath;
}

// Get the app directory
const appDir = path.join(__dirname, '..');
const electron = findElectron();

// Spawn electron with the app
const child = spawn(electron, [appDir], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'production'
  }
});

child.on('exit', (code) => {
  process.exit(code);
});

child.on('error', (err) => {
  console.error('Failed to start Teaching Assistant:', err.message);
  if (err.code === 'ENOENT') {
    console.error('\nElectron not found. Please install dependencies:');
    console.error('  npm install');
  }
  process.exit(1);
});
