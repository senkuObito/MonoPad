export interface NoteData {
  content: string;
  drawing?: string; // base64 of canvas
  lastSaved: number;
}

export enum SaveStatus {
  SAVED = 'SAVED',
  SAVING = 'SAVING',
  ERROR = 'ERROR',
  UNSAVED = 'UNSAVED'
}

export type Theme = 'dark-glass' | 'maroon-beige' | 'olive-beige' | 'twilight-vibe';
export type AppMode = 'text' | 'draw';