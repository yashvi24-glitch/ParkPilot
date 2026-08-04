import { createContext, useContext, useState } from "react";
import * as authApi from "../api/auth";
import { clearAuthTokens, setAuthTokens } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // No persistence to localStorage/sessionStorage on purpose: the session
  // lives only in memory, so any full page reload (including after the
  // backend/frontend dev servers restart) always requires logging in again.
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const data = await authApi.login({ email, password });
      setAuthTokens({ access: data.access, refresh: data.refresh });
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (payload) => {
    setLoading(true);
    try {
      await authApi.signup(payload);
      return login(payload.email, payload.password);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearAuthTokens();
    setUser(null);
  };

  const updateUser = (partial) => {
    setUser((prev) => ({ ...prev, ...partial }));
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
