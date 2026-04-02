#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Find the MCP server path
function getMcpServerPath() {
  // When installed globally via npm/brew, __dirname is in bin/
  // MCP server is at ../mcp-server/server.mjs relative to this script
  const installedPath = path.join(__dirname, '..', 'mcp-server', 'server.mjs');
  
  if (fs.existsSync(installedPath)) {
    return installedPath;
  }
  
  // When running from source/repo
  const devPath = path.join(__dirname, '..', '..', 'mcp-server', 'server.mjs');
  
  if (fs.existsSync(devPath)) {
    return devPath;
  }
  
  // When running from packaged Electron app
  // Resources are typically in: .app/Contents/Resources/ (macOS)
  // or resources/ (Windows/Linux)
  const possibleResourcePaths = [
    // macOS packaged app
    path.join(process.resourcesPath || '', 'mcp-server', 'server.mjs'),
    // Windows/Linux packaged app
    path.join(__dirname, '..', '..', '..', 'resources', 'mcp-server', 'server.mjs'),
    // Alternative locations
    path.join(process.cwd(), 'resources', 'mcp-server', 'server.mjs'),
    path.join(process.cwd(), 'mcp-server', 'server.mjs'),
  ];
  
  for (const resourcePath of possibleResourcePaths) {
    if (resourcePath && fs.existsSync(resourcePath)) {
      return resourcePath;
    }
  }
  
  throw new Error('Could not find MCP server. Is tagent properly installed?');
}

// Get node binary path
function getNodePath() {
  // Use the same node that runs this script
  return process.execPath;
}

// Main MCP server command
function runMcpServer() {
  try {
    const mcpServer = getMcpServerPath();
    const node = getNodePath();
    
    // Spawn MCP server with stdio connected
    const child = spawn(node, [mcpServer], {
      stdio: ['inherit', 'inherit', 'inherit'],
      env: process.env,
    });
    
    child.on('error', (err) => {
      console.error('Failed to start MCP server:', err.message);
      process.exit(1);
    });
    
    child.on('exit', (code) => {
      process.exit(code || 0);
    });
    
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

// Setup command - configures OpenCode
function runSetup() {
  const opencodeConfigDir = path.join(os.homedir(), '.config', 'opencode');
  const configPath = path.join(opencodeConfigDir, 'opencode.json');
  
  // Ensure config directory exists
  if (!fs.existsSync(opencodeConfigDir)) {
    fs.mkdirSync(opencodeConfigDir, { recursive: true });
  }
  
  // Read existing config or create new
  let config = { $schema: 'https://opencode.ai/config.json' };
  
  try {
    if (fs.existsSync(configPath)) {
      const existing = fs.readFileSync(configPath, 'utf8');
      config = JSON.parse(existing);
    }
  } catch (error) {
    console.log('Creating new OpenCode config...');
  }
  
  // Add MCP server config
  config.mcp = config.mcp || {};
  config.mcp['tagent-canvas'] = {
    type: 'local',
    command: ['tagent-mcp'],
    enabled: true,
    description: 'Teaching Assistant Canvas MCP server for study guides and quizzes'
  };
  
  // Write config
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  
  console.log('✓ Added tagent MCP server to OpenCode config');
  console.log(`  Config location: ${configPath}`);
  console.log('');
  console.log('To use it in OpenCode, run:');
  console.log('  opencode');
  console.log('');
  console.log('Then in the TUI, you can say:');
  console.log('  "use tagent-canvas to list my courses"');
  console.log('');
  console.log('Note: Make sure you have logged into the Teaching Assistant desktop app');
  console.log('      or set CANVAS_API_ENDPOINT and CANVAS_API_TOKEN environment variables.');
}

// Main entry point
const command = process.argv[2];

switch (command) {
  case 'setup':
  case 'install':
    runSetup();
    break;
  case 'help':
  case '--help':
  case '-h':
    console.log('tagent-mcp - Teaching Assistant MCP Server');
    console.log('');
    console.log('Usage:');
    console.log('  tagent-mcp           Start the MCP server (for OpenCode)');
    console.log('  tagent-mcp setup     Add MCP server to OpenCode config');
    console.log('  tagent-mcp help      Show this help message');
    console.log('');
    console.log('For OpenCode integration:');
    console.log('  1. Run: tagent-mcp setup');
    console.log('  2. Start OpenCode: opencode');
    console.log('  3. Use in prompts: "use tagent-canvas to..."');
    break;
  default:
    // Default is to run the MCP server
    runMcpServer();
}
