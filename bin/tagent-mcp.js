#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Configuration for different MCP clients
const CLIENT_CONFIGS = {
  opencode: {
    name: 'OpenCode',
    configPath: () => path.join(os.homedir(), '.config', 'opencode', 'opencode.json'),
    setup: (configPath, mcpConfig) => {
      let config = { $schema: 'https://opencode.ai/config.json' };
      
      try {
        if (fs.existsSync(configPath)) {
          config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
      } catch (e) {
        console.log('Creating new OpenCode config...');
      }
      
      config.mcp = config.mcp || {};
      config.mcp['tagent-canvas'] = {
        type: 'local',
        command: ['tagent-mcp'],
        enabled: true
      };
      
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
      return true;
    }
  },
  
  claude: {
    name: 'Claude Desktop',
    configPath: () => {
      switch (os.platform()) {
        case 'darwin':
          return path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
        case 'win32':
          return path.join(os.homedir(), 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json');
        default: // linux
          return path.join(os.homedir(), '.config', 'Claude', 'claude_desktop_config.json');
      }
    },
    setup: (configPath, mcpConfig) => {
      let config = {};
      
      try {
        if (fs.existsSync(configPath)) {
          config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
      } catch (e) {
        console.log('Creating new Claude Desktop config...');
      }
      
      config.mcpServers = config.mcpServers || {};
      config.mcpServers['tagent-canvas'] = {
        command: 'tagent-mcp',
        args: [],
        description: 'Teaching Assistant Canvas MCP server'
      };
      
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
      return true;
    }
  },
  
  cursor: {
    name: 'Cursor',
    configPath: () => path.join(os.homedir(), '.cursor', 'mcp.json'),
    setup: (configPath, mcpConfig) => {
      let config = { mcpServers: {} };
      
      try {
        if (fs.existsSync(configPath)) {
          config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
      } catch (e) {
        console.log('Creating new Cursor config...');
      }
      
      config.mcpServers = config.mcpServers || {};
      config.mcpServers['tagent-canvas'] = {
        command: 'tagent-mcp',
        args: [],
        description: 'Teaching Assistant Canvas MCP server'
      };
      
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
      return true;
    }
  },
  
  vscode: {
    name: 'VS Code (Cline/Roo Code)',
    configPath: () => path.join(os.homedir(), '.vscode', 'mcp.json'),
    setup: (configPath, mcpConfig) => {
      let config = {};
      
      try {
        if (fs.existsSync(configPath)) {
          config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
      } catch (e) {
        console.log('Creating new VS Code MCP config...');
      }
      
      config.servers = config.servers || [];
      // Remove existing if present
      config.servers = config.servers.filter(s => s.name !== 'tagent-canvas');
      config.servers.push({
        name: 'tagent-canvas',
        command: 'tagent-mcp',
        args: [],
        description: 'Teaching Assistant Canvas MCP server'
      });
      
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
      return true;
    }
  }
};

// Find the MCP server path
function getMcpServerPath() {
  // When installed globally via npm, __dirname is in bin/
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
  const possibleResourcePaths = [
    path.join(process.resourcesPath || '', 'mcp-server', 'server.mjs'),
    path.join(__dirname, '..', '..', '..', 'resources', 'mcp-server', 'server.mjs'),
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
  return process.execPath;
}

// Run the MCP server
function runMcpServer() {
  try {
    const mcpServer = getMcpServerPath();
    const node = getNodePath();
    
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

// Setup for a specific client
function setupClient(clientKey) {
  const client = CLIENT_CONFIGS[clientKey];
  if (!client) {
    console.error(`Unknown client: ${clientKey}`);
    console.log(`Supported clients: ${Object.keys(CLIENT_CONFIGS).join(', ')}`);
    return false;
  }
  
  const configPath = client.configPath();
  const configDir = path.dirname(configPath);
  
  // Ensure config directory exists
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  try {
    const success = client.setup(configPath);
    if (success) {
      console.log(`✓ Added tagent MCP server to ${client.name}`);
      console.log(`  Config: ${configPath}`);
      return true;
    }
  } catch (error) {
    console.error(`✗ Failed to setup ${client.name}:`, error.message);
    return false;
  }
}

// Setup all detected clients
function setupAll() {
  console.log('Setting up tagent MCP server for all detected clients...\n');
  
  let successCount = 0;
  
  for (const [key, client] of Object.entries(CLIENT_CONFIGS)) {
    const configPath = client.configPath();
    const configDir = path.dirname(configPath);
    
    // Only setup if the config directory exists (client is installed)
    if (fs.existsSync(configDir)) {
      if (setupClient(key)) {
        successCount++;
        console.log('');
      }
    }
  }
  
  if (successCount === 0) {
    console.log('No MCP clients detected. Setup a specific client with:');
    console.log('  tagent-mcp setup <client>');
    console.log('');
    console.log('Available clients: ' + Object.keys(CLIENT_CONFIGS).join(', '));
  } else {
    console.log(`Successfully configured ${successCount} client(s).`);
    console.log('');
    console.log('To use the MCP server:');
    console.log('  1. Restart your MCP client if it\'s running');
    console.log('  2. The "tagent-canvas" server should now be available');
    console.log('');
    console.log('Note: Make sure you have logged into the Teaching Assistant desktop app');
    console.log('      or set CANVAS_API_ENDPOINT and CANVAS_API_TOKEN environment variables.');
  }
}

// Print JSON config for manual setup
function printJsonConfig() {
  console.log('Add this to your MCP client configuration:\n');
  console.log(JSON.stringify({
    mcpServers: {
      'tagent-canvas': {
        command: 'tagent-mcp',
        args: [],
        description: 'Teaching Assistant Canvas MCP server'
      }
    }
  }, null, 2));
  console.log('');
  console.log('Or for OpenCode, add this to ~/.config/opencode/opencode.json:');
  console.log(JSON.stringify({
    mcp: {
      'tagent-canvas': {
        type: 'local',
        command: ['tagent-mcp'],
        enabled: true
      }
    }
  }, null, 2));
}

// Show help
function showHelp() {
  console.log('tagent-mcp - Teaching Assistant MCP Server');
  console.log('');
  console.log('USAGE:');
  console.log('  tagent-mcp                    Start the MCP server (stdio mode)');
  console.log('  tagent-mcp setup              Auto-setup for all detected clients');
  console.log('  tagent-mcp setup <client>     Setup for specific client');
  console.log('  tagent-mcp json               Print JSON config for manual setup');
  console.log('  tagent-mcp help               Show this help');
  console.log('');
  console.log('SUPPORTED CLIENTS:');
  Object.entries(CLIENT_CONFIGS).forEach(([key, client]) => {
    console.log(`  ${key.padEnd(10)} - ${client.name}`);
  });
  console.log('');
  console.log('EXAMPLES:');
  console.log('  # Setup for OpenCode only');
  console.log('  tagent-mcp setup opencode');
  console.log('');
  console.log('  # Setup for Claude Desktop only');
  console.log('  tagent-mcp setup claude');
  console.log('');
  console.log('  # Auto-detect and setup all installed clients');
  console.log('  tagent-mcp setup');
  console.log('');
  console.log('INSTALLATION:');
  console.log('  npm install -g tagent    # Makes tagent-mcp available globally');
}

// Main entry point
const command = process.argv[2];
const subCommand = process.argv[3];

switch (command) {
  case 'setup':
  case 'install':
    if (subCommand) {
      // Setup specific client
      if (setupClient(subCommand)) {
        console.log('');
        console.log('Restart your MCP client to use the new server.');
      }
    } else {
      // Auto-detect and setup all
      setupAll();
    }
    break;
    
  case 'json':
  case 'config':
    printJsonConfig();
    break;
    
  case 'help':
  case '--help':
  case '-h':
    showHelp();
    break;
    
  default:
    // Default: run the MCP server
    runMcpServer();
}
