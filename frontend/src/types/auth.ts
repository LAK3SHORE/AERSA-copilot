export type UserRole = "auditor" | "corporativo";

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
  idempresa: number | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}
