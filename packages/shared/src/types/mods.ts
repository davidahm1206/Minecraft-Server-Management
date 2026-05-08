// ─── Mod Types ───

export interface ModInfo {
  modId: string;
  version: string;
  displayName: string;
  description: string;
  authors: string;
  mcVersion: string;
  forgeVersion: string;
  clientOnly: boolean;
  fileName: string;
  enabled: boolean;
  fileSize: number;
  incompatible: boolean;
  incompatibleReason?: string;
}

export interface ModUploadRequest {
  filename: string;
  data: string; // base64
}

export interface ModToggleRequest {
  filename: string;
  enabled: boolean;
}
