import chalk from 'chalk';
import { header, keyValue, tableHeader, tableRow, blank } from '../utils/output.js';
import type { ClipboardItem, PaginatedResponse } from '../utils/types.js';

export function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '-';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function truncate(s: string, len: number): string {
  if (s.length <= len) return s;
  return s.slice(0, len - 1) + '\u2026';
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}

export function formatItemTable(result: PaginatedResponse<ClipboardItem>): void {
  const widths = [10, 6, 40, 10, 18];
  header(`Clipboard Items (${result.total} total, page ${result.page}/${result.totalPages})`);
  tableHeader(['ID', 'Type', 'Content / File', 'Size', 'Created'], widths);

  for (const item of result.items) {
    const label = item.type === 'text'
      ? truncate((item.content ?? '').replace(/\n/g, ' '), 40)
      : item.fileName ?? '-';

    tableRow(
      [
        shortId(item.id),
        item.type,
        label,
        formatBytes(item.fileSize ? Number(item.fileSize) : null),
        shortDate(item.createdAt),
      ],
      widths,
    );
  }
  blank();
}

export function formatItemDetail(item: ClipboardItem): void {
  header('Clipboard Item');
  keyValue('ID', item.id);
  keyValue('Type', item.type);
  keyValue('Status', item.status);
  keyValue('Created', formatDate(item.createdAt));
  keyValue('Updated', formatDate(item.updatedAt));
  keyValue('Favorite', item.isFavorite ? 'Yes' : 'No');
  keyValue('Public', item.isPublic ? 'Yes' : 'No');

  if (item.shareToken) {
    keyValue('Share Token', item.shareToken);
  }

  if (item.type === 'text') {
    blank();
    console.log(chalk.dim('  Content:'));
    console.log('  ' + (item.content ?? ''));
  } else {
    keyValue('File Name', item.fileName ?? '-');
    keyValue('File Size', formatBytes(item.fileSize ? Number(item.fileSize) : null));
    keyValue('MIME Type', item.mimeType ?? '-');
  }
  blank();
}

export function formatShareInfo(item: ClipboardItem, serverUrl: string): void {
  header('Share Info');
  keyValue('ID', item.id);
  keyValue('Public', item.isPublic ? 'Yes' : 'No');

  if (item.isPublic && item.shareToken) {
    keyValue('Share URL', `${serverUrl}/share/${item.shareToken}`);
  }
  blank();
}
