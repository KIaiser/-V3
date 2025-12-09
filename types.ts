export interface FileMetadata {
  id: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
  category?: string;
  aiDescription?: string;
  aiTags?: string[];
  isDeviceInfo?: boolean;
  isDataMergeFile?: boolean;
  parentFileId?: string;
}

export interface StoredFile extends FileMetadata {
  content: Blob;
}

export enum ViewMode {
  GRID = 'GRID',
  LIST = 'LIST',
}

export type FileFilter = 'ALL' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO' | 'OTHER' | string;

export interface AnalysisState {
  isAnalyzing: boolean;
  error: string | null;
  result: string | null;
  tags: string[];
}