import { Command } from 'commander';
import chalk from 'chalk';
import { registerAuthCommands } from './commands/auth.js';
import { registerClipboardCommands } from './commands/clipboard.js';
import { registerUploadCommand } from './commands/upload.js';
import { registerDownloadCommands } from './commands/download.js';
import { registerShareCommands } from './commands/share.js';
import { registerConfigCommands } from './commands/config.js';
import { VERSION } from './version.js';

const program = new Command();

program
  .name('clipcli')
  .description(
    'Clipboard CLI — Manage your clipboard items from the command line.\n\n' +
    'A CLI tool for the Clipboard web application that lets you upload files, create text items, ' +
    'share items via public URLs, and download files. Designed for both humans and AI agents.\n\n' +
    'Supports three output modes: human-readable (default), --json for machine parsing, ' +
    'and --quiet for bare values ideal for shell piping and agent integration.',
  )
  .version(VERSION, '-V, --version', 'Display the current clipcli version')
  .option(
    '--json',
    'Output all results as machine-readable JSON. ' +
    'Format: {"success": true, "data": ...} or {"success": false, "error": "..."}. ' +
    'Errors go to stderr, data to stdout. Ideal for AI agents — parse with: jq .data',
  )
  .option(
    '-q, --quiet',
    'Minimal output mode. Print only essential values with no formatting. ' +
    'For list commands, prints one ID per line. For copy/upload, prints the item ID. ' +
    'Ideal for shell piping: clipcli copy "hello" -q | xargs clipcli share -q',
  )
  .option(
    '--server <url>',
    'Override the Clipboard server URL for this invocation only. ' +
    'Default: https://clipboard.marin.cr. ' +
    'Persistent override: clipcli config set-url <url>',
  )
  .option(
    '--no-color',
    'Disable all ANSI color codes in output.',
  )
  .option(
    '-v, --verbose',
    'Enable verbose logging. Shows HTTP request details and debug info.',
  );

// Apply global options before any command action runs
program.hook('preAction', (thisCommand) => {
  const opts = thisCommand.opts();

  if (opts.server) {
    process.env.CLIPCLI_SERVER_URL = opts.server;
  }

  if (opts.color === false) {
    chalk.level = 0;
  }
});

// Register all command groups
registerAuthCommands(program);
registerClipboardCommands(program);
registerUploadCommand(program);
registerDownloadCommands(program);
registerShareCommands(program);
registerConfigCommands(program);

// Help examples
program.addHelpText(
  'after',
  `
${chalk.bold('Examples:')}

  ${chalk.dim('# Authentication')}
  $ clipcli auth login                              ${chalk.dim('# Authenticate with a personal access token')}
  $ clipcli auth status                             ${chalk.dim('# Check login state')}
  $ clipcli auth logout                             ${chalk.dim('# Clear stored token')}

  ${chalk.dim('# Create clipboard items')}
  $ clipcli copy "Hello, world!"                    ${chalk.dim('# Create a text item')}
  $ echo "piped text" | clipcli copy                ${chalk.dim('# Create from stdin')}
  $ cat file.log | clipcli copy                     ${chalk.dim('# Pipe file content as text')}
  $ clipcli upload ./screenshot.png                 ${chalk.dim('# Upload a file')}
  $ clipcli upload ./large-video.mp4                ${chalk.dim('# Upload large file (multipart)')}

  ${chalk.dim('# Browse and retrieve')}
  $ clipcli list                                    ${chalk.dim('# List recent items')}
  $ clipcli list --type file --search "report"      ${chalk.dim('# Filter by type and search')}
  $ clipcli get <id>                                ${chalk.dim('# Get item details')}
  $ clipcli download <id>                           ${chalk.dim('# Download file to current dir')}
  $ clipcli download <id> ./output.pdf              ${chalk.dim('# Download to specific path')}
  $ clipcli download-url <id>                       ${chalk.dim('# Get signed download URL')}

  ${chalk.dim('# Sharing')}
  $ clipcli share <id>                              ${chalk.dim('# Enable sharing, get public URL')}
  $ clipcli share-info <id>                         ${chalk.dim('# Check sharing status')}
  $ clipcli unshare <id>                            ${chalk.dim('# Disable sharing')}

  ${chalk.dim('# Configuration')}
  $ clipcli config show                             ${chalk.dim('# Show current configuration')}
  $ clipcli config set-url https://my-server.com    ${chalk.dim('# Set server URL')}

  ${chalk.dim('# AI agent integration')}
  $ ID=$(clipcli copy "data" -q)                    ${chalk.dim('# Capture item ID')}
  $ URL=$(clipcli share "$ID" -q)                   ${chalk.dim('# Get share URL')}
  $ clipcli list --json | jq '.data.items[].id'     ${chalk.dim('# Parse JSON output')}
  $ clipcli upload report.pdf -q | xargs clipcli share -q
`,
);

// Global error handler
process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  const args = process.argv.slice(2);
  const isJson = args.includes('--json');

  if (isJson) {
    process.stderr.write(JSON.stringify({ success: false, error: message }) + '\n');
  } else {
    console.error(chalk.red(`Error: ${message}`));
  }
  process.exit(1);
});

program.parse();
