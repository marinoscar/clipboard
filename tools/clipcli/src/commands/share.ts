import { Command } from 'commander';
import { OutputManager } from '../utils/output.js';
import { config } from '../utils/config.js';
import {
  getClipboardItem,
  enableSharing,
  disableSharing,
} from '../lib/api-client.js';
import { formatShareInfo } from '../lib/formatters.js';
import type { OutputMode, ShareResult, ClipboardItem } from '../utils/types.js';

function getOutput(cmd: Command): OutputManager {
  const root = cmd.optsWithGlobals();
  const mode: OutputMode = root.json ? 'json' : root.quiet ? 'quiet' : 'human';
  return new OutputManager(mode);
}

export function registerShareCommands(program: Command): void {
  // clipcli share <id>
  program
    .command('share <id>')
    .description('Enable public sharing for a clipboard item and return the share URL')
    .action(async (id, _opts, cmd) => {
      const output = getOutput(cmd);
      try {
        const result = await enableSharing(id);

        output.result<ShareResult>(
          result,
          (r) => console.log(`Share URL: ${r.shareUrl}`),
          (r) => console.log(r.shareUrl),
        );
      } catch (err) {
        output.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // clipcli unshare <id>
  program
    .command('unshare <id>')
    .description('Disable public sharing for a clipboard item')
    .action(async (id, _opts, cmd) => {
      const output = getOutput(cmd);
      try {
        await disableSharing(id);

        output.result(
          { id, shared: false },
          () => console.log(`Sharing disabled for item ${id}`),
          () => console.log(id),
        );
      } catch (err) {
        output.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // clipcli share-info <id>
  program
    .command('share-info <id>')
    .description('Show sharing status and URL for a clipboard item')
    .action(async (id, _opts, cmd) => {
      const output = getOutput(cmd);
      try {
        const item = await getClipboardItem(id);

        output.result<ClipboardItem>(
          item,
          (i) => formatShareInfo(i, config.serverUrl),
          (i) => {
            if (i.isPublic && i.shareToken) {
              console.log(`${config.serverUrl}/share/${i.shareToken}`);
            } else {
              console.log('not_shared');
            }
          },
        );
      } catch (err) {
        output.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
