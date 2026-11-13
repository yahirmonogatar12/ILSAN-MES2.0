import { createContext, useContext } from "react";
import type { RuntimeMode } from "../runtime";
import type { AuthGateway, Profile, ProfileUpdate } from "./types";

export interface AuthState {
  mode: RuntimeMode;
  profile: Profile | null;
  scope: string;
  checking: boolean;
  error: Error | null;
  gateway: AuthGateway;
  switchMode: (mode: RuntimeMode) => void;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  saveProfile: (values: ProfileUpdate) => Promise<void>;
  retry: () => Promise<unknown>;
}

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth requiere AuthProvider.");
  return value;
}
