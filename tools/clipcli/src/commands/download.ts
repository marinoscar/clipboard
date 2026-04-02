import { Command } from 'commander';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { OutputManager, info, blank } from '../utils/output.js';
import { getClipboardItem, getDownloadUrl } from '../lib/api-client.js';
import { formatBytes } from '../lib/formatters.js';
import type { OutputMode, DownloadUrlResult } from '../utils/types.js';

function getOutput(cmd: Command): OutputManager {
  const root = cmd.optsWithGlobals();
  const mode: OutputMode = root.json ? 'json' : root.quiet ? 'quiet' : 'human';
  return new OutputManager(mode);
}

export function registerDownloadCommands(program: Command): void {
  // clipcli download <id> [output-path]
  program
    .command('download <id> [output]')
    .description('Download a file item to a local path')
    .action(async (id, outputPath, _opts, cmd) => {
      const output = getOutput(cmd);
      try {
        const item = await getClipboardItem(id);
        if (!item.storageKey) {
          output.fail('Item has no downloadable file');
          process.exit(1);
        }

        const { url } = await getDownloadUrl(id);
        const destPath = outputPath || join(process.cwd(), item.fileName || `download-${id}`);

        output.humanOnly(() => {
          info(`Downloading: ${item.fileName} (${formatBytes(item.fileSize ? Number(item.fileSize) : null)})`);
        });

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Download failed: ${res.status}`);

        const buffer = Buffer.from(await res.arrayBuffer());
        writeFileSync(destPath, buffer);

        output.result(
          { id, path: destPath, size: buffer.length },
          (d) => {
            blank();
            console.log(`Saved to: ${d.path}`);
            console.log(`  Size: ${formatBytes(d.size)}`);
          },
          (d) => console.log(d.path),
        );
      } catch (err) {
        output.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // clipcli download-url <id>
  program
    .command('download-url <id>')
    .description('Get a signed download URL for a file item')
    .action(async (id, _opts, cmd) => {
      const output = getOutput(cmd);
      try {
        const result = await getDownloadUrl(id);

        output.result<DownloadUrlResult>(
          result,
          (r) => console.log(r.url),
          (r) => console.log(r.url),
        );
      } catch (err) {
        output.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
