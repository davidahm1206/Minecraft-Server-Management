// ─── Auth Types ───

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: UserInfo;
}

export interface UserInfo {
  id: string;
  username: string;
  role: 'admin' | 'viewer';
}

export interface JWTPayload {
  sub: string;
  username: string;
  role: 'admin' | 'viewer';
  iat: number;
  exp: number;
}
