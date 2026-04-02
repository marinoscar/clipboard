import { Command } from 'commander';
import { OutputManager } from '../utils/output.js';
import {
  getClipboardItems,
  getClipboardItem,
  createTextItem,
  deleteClipboardItem,
} from '../lib/api-client.js';
import { formatItemTable, formatItemDetail } from '../lib/formatters.js';
import type { OutputMode, ClipboardItem, PaginatedResponse } from '../utils/types.js';

function getOutput(cmd: Command): OutputManager {
  const root = cmd.optsWithGlobals();
  const mode: OutputMode = root.json ? 'json' : root.quiet ? 'quiet' : 'human';
  return new OutputManager(mode);
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', reject);
  });
}

export function registerClipboardCommands(program: Command): void {
  // clipcli list
  program
    .command('list')
    .description('List clipboard items')
    .option('--type <type>', 'Filter by type (text, image, file, media)')
    .option('--status <status>', 'Filter by status (active, archived, deleted)', 'active')
    .option('--search <term>', 'Search content and filenames')
    .option('--page <n>', 'Page number', '1')
    .option('--page-size <n>', 'Items per page', '20')
    .option('--sort <field>', 'Sort by field (createdAt, updatedAt, fileName)', 'createdAt')
    .option('--order <dir>', 'Sort order (asc, desc)', 'desc')
    .option('--favorites', 'Show only favorites')
    .action(async (opts, cmd) => {
      const output = getOutput(cmd);
      try {
        const result = await getClipboardItems({
          page: parseInt(opts.page, 10),
          pageSize: parseInt(opts.pageSize, 10),
          type: opts.type,
          status: opts.status,
          search: opts.search,
          sortBy: opts.sort,
          sortOrder: opts.order,
          isFavorite: opts.favorites ? true : undefined,
        });

        output.result<PaginatedResponse<ClipboardItem>>(
          result,
          (r) => formatItemTable(r),
          (r) => r.items.forEach((i) => console.log(i.id)),
        );
      } catch (err) {
        output.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // clipcli get <id>
  program
    .command('get <id>')
    .description('Get a clipboard item by ID')
    .action(async (id, _opts, cmd) => {
      const output = getOutput(cmd);
      try {
        const item = await getClipboardItem(id);

        output.result<ClipboardItem>(
          item,
          (i) => formatItemDetail(i),
          (i) => console.log(i.type === 'text' ? (i.content ?? '') : i.id),
        );
      } catch (err) {
        output.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // clipcli copy [text]
  program
    .command('copy [text...]')
    .description('Create a text clipboard item from argument or stdin')
    .action(async (textParts, _opts, cmd) => {
      const output = getOutput(cmd);
      try {
        let content: string;

        if (textParts && textParts.length > 0) {
          content = textParts.join(' ');
        } else if (!process.stdin.isTTY) {
          content = await readStdin();
        } else {
          output.fail('Provide text as argument or pipe via stdin. Example: echo "hello" | clipcli copy');
          process.exit(1);
        }

        content = content.trim();
        if (!content) {
          output.fail('Empty content');
          process.exit(1);
        }

        const item = await createTextItem(content);

        output.result<ClipboardItem>(
          item,
          (i) => {
            console.log(`Created item ${i.id} (${i.type})`);
          },
          (i) => console.log(i.id),
        );
      } catch (err) {
        output.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });

  // clipcli delete <id>
  program
    .command('delete <id>')
    .description('Soft-delete a clipboard item')
    .action(async (id, _opts, cmd) => {
      const output = getOutput(cmd);
      try {
        await deleteClipboardItem(id);

        output.result(
          { id, deleted: true },
          () => console.log(`Deleted item ${id}`),
          () => console.log(id),
        );
      } catch (err) {
        output.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
