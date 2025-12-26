
import { NoteData } from '../types';
import saveAs from 'file-saver';

const LOCAL_STORAGE_KEY = 'monopad_universal_data';

export const storageService = {
  saveLocal: (content: string, drawing?: string): void => {
    const data: NoteData = {
      content,
      drawing,
      lastSaved: Date.now(),
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
  },

  loadLocal: (): NoteData | null => {
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (data) {
      try {
        return JSON.parse(data);
      } catch (e) {
        return null;
      }
    }
    return null;
  },

  exportAsJson: (content: string, drawing?: string) => {
    const data = JSON.stringify({ content, drawing, lastSaved: Date.now() });
    const blob = new Blob([data], { type: 'application/json' });
    saveAs(blob, `monopad-backup-${Date.now()}.json`);
  },

  importFile: async (file: File): Promise<{content: string, drawing?: string}> => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension === 'json') {
      const json = JSON.parse(await file.text());
      return { content: json.content || '', drawing: json.drawing };
    }
    throw new Error('Please select a .json backup file');
  },

  generateWirelessLink: (content: string, drawing?: string): string => {
    const data = JSON.stringify({ content, drawing });
    // Using btoa for a simple wireless "transfer" string
    const encoded = btoa(unescape(encodeURIComponent(data)));
    const url = new URL(window.location.href);
    url.hash = `share=${encoded}`;
    return url.toString();
  },

  parseWirelessLink: (hash: string): { content: string, drawing?: string } | null => {
    if (!hash.startsWith('#share=')) return null;
    try {
      const encoded = hash.replace('#share=', '');
      const decoded = decodeURIComponent(escape(atob(encoded)));
      return JSON.parse(decoded);
    } catch (e) {
      console.error("Failed to parse wireless link", e);
      return null;
    }
  }
};
