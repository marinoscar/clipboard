import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClipboardPaste } from './useClipboardPaste';
import type { ClipboardItem } from '../types';

vi.mock('../services/api', () => ({
  createTextItem: vi.fn(),
  uploadFile: vi.fn(),
}));

import { createTextItem, uploadFile } from '../services/api';

const mockedCreateTextItem = vi.mocked(createTextItem);
const mockedUploadFile = vi.mocked(uploadFile);

function makeItem(overrides: Partial<ClipboardItem> = {}): ClipboardItem {
  return {
    id: 'item-1',
    userId: 'user-1',
    type: 'text',
    content: 'hello',
    fileName: null,
    fileSize: null,
    mimeType: null,
    storageKey: null,
    status: 'active',
    isPublic: false,
    shareToken: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makePasteEvent(overrides: {
  text?: string;
  files?: File[];
  targetTagName?: string;
  isContentEditable?: boolean;
}): ClipboardEvent {
  const { text, files = [], targetTagName = 'BODY', isContentEditable = false } = overrides;

  const dataTransferItems: DataTransferItem[] = [];

  if (files.length > 0) {
    files.forEach((file) => {
      dataTransferItems.push({
        kind: 'file',
        type: file.type,
        getAsFile: () => file,
        getAsString: () => {},
        webkitGetAsEntry: () => null,
      } as unknown as DataTransferItem);
    });
  }

  if (text !== undefined && files.length === 0) {
    dataTransferItems.push({
      kind: 'string',
      type: 'text/plain',
      getAsFile: () => null,
      getAsString: () => {},
      webkitGetAsEntry: () => null,
    } as unknown as DataTransferItem);
  }

  const event = new Event('paste', { bubbles: true }) as ClipboardEvent;

  Object.defineProperty(event, 'clipboardData', {
    value: {
      items: dataTransferItems,
      getData: (type: string) => (type === 'text/plain' ? (text ?? '') : ''),
    },
  });

  Object.defineProperty(event, 'target', {
    value: {
      tagName: targetTagName,
      isContentEditable,
    },
  });

  return event;
}

describe('useClipboardPaste', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers paste event listener on mount', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const onItemCreated = vi.fn();

    renderHook(() => useClipboardPaste(onItemCreated));

    expect(addSpy).toHaveBeenCalledWith('paste', expect.any(Function));
    addSpy.mockRestore();
  });

  it('removes paste event listener on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const onItemCreated = vi.fn();

    const { unmount } = renderHook(() => useClipboardPaste(onItemCreated));
    unmount();

    expect(removeSpy).toHaveBeenCalledWith('paste', expect.any(Function));
    removeSpy.mockRestore();
  });

  it('on text paste: calls createTextItem and invokes callback', async () => {
    const createdItem = makeItem({ content: 'pasted text' });
    mockedCreateTextItem.mockResolvedValue(createdItem);

    const onItemCreated = vi.fn();
    renderHook(() => useClipboardPaste(onItemCreated));

    const event = makePasteEvent({ text: 'pasted text' });

    await act(async () => {
      document.dispatchEvent(event);
      // allow async handler to complete
      await Promise.resolve();
    });

    expect(mockedCreateTextItem).toHaveBeenCalledWith('pasted text');
    expect(onItemCreated).toHaveBeenCalledWith(createdItem);
  });

  it('on file paste: calls uploadFile and invokes callback', async () => {
    const file = new File(['data'], 'test.png', { type: 'image/png' });
    const uploadedItem = makeItem({ id: 'file-item', type: 'image', fileName: 'test.png' });
    mockedUploadFile.mockResolvedValue(uploadedItem);

    const onItemCreated = vi.fn();
    renderHook(() => useClipboardPaste(onItemCreated));

    const event = makePasteEvent({ files: [file] });

    await act(async () => {
      document.dispatchEvent(event);
      await Promise.resolve();
    });

    expect(mockedUploadFile).toHaveBeenCalledWith(file);
    expect(onItemCreated).toHaveBeenCalledWith(uploadedItem);
    expect(mockedCreateTextItem).not.toHaveBeenCalled();
  });

  it('ignores paste events when target is an INPUT element', async () => {
    const onItemCreated = vi.fn();
    renderHook(() => useClipboardPaste(onItemCreated));

    const event = makePasteEvent({ text: 'some text', targetTagName: 'INPUT' });

    await act(async () => {
      document.dispatchEvent(event);
      await Promise.resolve();
    });

    expect(mockedCreateTextItem).not.toHaveBeenCalled();
    expect(onItemCreated).not.toHaveBeenCalled();
  });

  it('ignores paste events when target is a TEXTAREA element', async () => {
    const onItemCreated = vi.fn();
    renderHook(() => useClipboardPaste(onItemCreated));

    const event = makePasteEvent({ text: 'some text', targetTagName: 'TEXTAREA' });

    await act(async () => {
      document.dispatchEvent(event);
      await Promise.resolve();
    });

    expect(mockedCreateTextItem).not.toHaveBeenCalled();
    expect(onItemCreated).not.toHaveBeenCalled();
  });

  it('ignores paste events when target is contentEditable', async () => {
    const onItemCreated = vi.fn();
    renderHook(() => useClipboardPaste(onItemCreated));

    const event = makePasteEvent({ text: 'some text', isContentEditable: true });

    await act(async () => {
      document.dispatchEvent(event);
      await Promise.resolve();
    });

    expect(mockedCreateTextItem).not.toHaveBeenCalled();
    expect(onItemCreated).not.toHaveBeenCalled();
  });

  it('does nothing when clipboard data has no items', async () => {
    const onItemCreated = vi.fn();
    renderHook(() => useClipboardPaste(onItemCreated));

    const event = new Event('paste', { bubbles: true }) as ClipboardEvent;
    Object.defineProperty(event, 'clipboardData', { value: null });
    Object.defineProperty(event, 'target', {
      value: { tagName: 'BODY', isContentEditable: false },
    });

    await act(async () => {
      document.dispatchEvent(event);
      await Promise.resolve();
    });

    expect(mockedCreateTextItem).not.toHaveBeenCalled();
    expect(mockedUploadFile).not.toHaveBeenCalled();
  });
});
