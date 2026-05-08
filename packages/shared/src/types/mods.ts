// ─── Mod Types ───

export interface ModInfo {
  modId: string;
  version: string;
  displayName: string;
  description: string;
  authors: string;
  mcVersion: string;
  fabricVersion?: string;     // Fabric loader version requirement
  environment: 'server' | 'client' | 'both'; // Fabric environment field
  clientOnly: boolean;
  fileName: string;
  enabled: boolean;
  fileSize: number;
  incompatible: boolean;
  incompatibleReason?: string;
  depends?: Record<string, string>; // raw depends from fabric.mod.json
}

export interface ModUploadRequest {
  filename: string;
  data: string; // base64
}

export interface ModToggleRequest {
  filename: string;
  enabled: boolean;
}
