import { Command } from 'commander';
import { readFileSync, statSync } from 'fs';
import { basename, extname } from 'path';
import { OutputManager, info, blank } from '../utils/output.js';
import {
  uploadFileSmall,
  initMultipartUpload,
  getPartUploadUrl,
  recordUploadPart,
  completeMultipartUpload,
} from '../lib/api-client.js';
import { formatBytes } from '../lib/formatters.js';
import type { OutputMode, ClipboardItem } from '../utils/types.js';

function getOutput(cmd: Command): OutputManager {
  const root = cmd.optsWithGlobals();
  const mode: OutputMode = root.json ? 'json' : root.quiet ? 'quiet' : 'human';
  return new OutputManager(mode);
}

const MIME_TYPES: Record<string, string> = {
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.csv': 'text/csv',
  '.md': 'text/markdown',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.tar': 'application/x-tar',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

const SMALL_FILE_LIMIT = 100 * 1024 * 1024; // 100MB

export function registerUploadCommand(program: Command): void {
  program
    .command('upload <file>')
    .description('Upload a file to the clipboard')
    .action(async (filePath, _opts, cmd) => {
      const output = getOutput(cmd);
      try {
        const stats = statSync(filePath);
        const fileSize = stats.size;
        const fileName = basename(filePath);
        const mimeType = getMimeType(filePath);

        output.humanOnly(() => {
          info(`Uploading: ${fileName} (${formatBytes(fileSize)}, ${mimeType})`);
        });

        let item: ClipboardItem;

        if (fileSize < SMALL_FILE_LIMIT) {
          // Simple upload
          const buffer = readFileSync(filePath);
          item = await uploadFileSmall(filePath, buffer, fileName, mimeType);
        } else {
          // Multipart S3 upload
          output.humanOnly(() => info('Using multipart upload for large file...'));

          const init = await initMultipartUpload(fileName, fileSize, mimeType);
          const { itemId, totalParts, partSize } = init;

          output.humanOnly(() => info(`Parts: ${totalParts}, Part size: ${formatBytes(partSize)}`));

          const parts: { partNumber: number; eTag: string }[] = [];
          const fileBuffer = readFileSync(filePath);

          for (let i = 1; i <= totalParts; i++) {
            const start = (i - 1) * partSize;
            const end = Math.min(start + partSize, fileSize);
            const partData = fileBuffer.subarray(start, end);

            output.humanOnly(() => {
              process.stderr.write(`\r  Part ${i}/${totalParts} (${formatBytes(partData.length)})...`);
            });

            // Get presigned URL for this part
            const uploadUrl = await getPartUploadUrl(itemId, i);

            // Upload part directly to S3
            const uploadRes = await fetch(uploadUrl, {
              method: 'PUT',
              body: partData,
              headers: { 'Content-Length': String(partData.length) },
            });

            if (!uploadRes.ok) {
              throw new Error(`Failed to upload part ${i}: ${uploadRes.status}`);
            }

            const eTag = uploadRes.headers.get('etag') || '';

            // Record the part with the API
            await recordUploadPart(itemId, i, eTag, partData.length);
            parts.push({ partNumber: i, eTag });
          }

          output.humanOnly(() => {
            process.stderr.write('\n');
            info('Completing multipart upload...');
          });

          item = await completeMultipartUpload(itemId, parts);
        }

        output.result<ClipboardItem>(
          item,
          (i) => {
            blank();
            console.log(`Uploaded: ${i.id}`);
            console.log(`  File: ${i.fileName}`);
            console.log(`  Size: ${formatBytes(i.fileSize ? Number(i.fileSize) : null)}`);
            console.log(`  Type: ${i.mimeType}`);
          },
          (i) => console.log(i.id),
        );
      } catch (err) {
        output.fail(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    });
}
