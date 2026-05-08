// ─── File Types ───

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modifiedAt: string;
}

export interface FileReadResponse {
  path: string;
  content: string;
  encoding: 'utf-8' | 'base64';
}

export interface FileWriteRequest {
  path: string;
  content: string;
}

export interface FileUploadRequest {
  path: string;
  data: string; // base64
  filename: string;
}

export interface WorldInfo {
  name: string;
  size: number;
  lastPlayed: string | null;
  seed?: string;
}
