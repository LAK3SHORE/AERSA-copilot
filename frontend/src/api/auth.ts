import type { AuthUser, TokenResponse } from "../types/auth";
import { getJSON, postForm } from "./client";

export async function login(username: string, password: string): Promise<TokenResponse> {
  return postForm<TokenResponse>("/api/auth/login", { username, password });
}

export async function fetchMe(): Promise<AuthUser> {
  return getJSON<AuthUser>("/api/auth/me");
}
