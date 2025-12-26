
import { NoteData } from '../types';
import * as docx from 'docx';
import saveAs from 'file-saver';
import mammoth from 'mammoth';

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

  exportAsDocx: async (content: string) => {
    const doc = new docx.Document({
      sections: [{
        properties: {},
        children: content.split('\n').map(line => 
          new docx.Paragraph({
            children: [new docx.TextRun(line)],
          })
        ),
      }],
    });

    const blob = await docx.Packer.toBlob(doc);
    saveAs(blob, `monopad-export-${Date.now()}.docx`);
  },

  exportAsJson: (content: string, drawing?: string) => {
    const data = JSON.stringify({ content, drawing, lastSaved: Date.now() });
    const blob = new Blob([data], { type: 'application/json' });
    saveAs(blob, `monopad-backup-${Date.now()}.json`);
  },

  exportAsFile: (content: string): void => {
    const blob = new Blob([content], { type: 'text/plain' });
    saveAs(blob, `monopad-note-${Date.now()}.txt`);
  },

  importFile: async (file: File): Promise<{content: string, drawing?: string}> => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    if (extension === 'docx') {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return { content: result.value };
    } else if (extension === 'txt' || extension === 'md') {
      const text = await file.text();
      return { content: text };
    } else if (extension === 'json') {
      const json = JSON.parse(await file.text());
      return { content: json.content || '', drawing: json.drawing };
    }
    
    throw new Error('Unsupported file format');
  }
};
