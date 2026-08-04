import { createContext, useContext, useState } from "react";
import * as ownerApi from "../api/owner";
import { clearOwnerAuthTokens, setOwnerAuthTokens } from "../api/ownerClient";

const OwnerAuthContext = createContext(null);

export function OwnerAuthProvider({ children }) {
  // No persistence to localStorage/sessionStorage on purpose, matching the
  // User Portal's AuthContext: the session lives only in memory, so any full
  // page reload always requires logging in again.
  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(false);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const data = await ownerApi.ownerLogin({ email, password });
      setOwnerAuthTokens({ access: data.access, refresh: data.refresh });
      setOwner(data.owner);
      return data.owner;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (payload) => {
    setLoading(true);
    try {
      await ownerApi.ownerSignup(payload);
      return login(payload.email, payload.password);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearOwnerAuthTokens();
    setOwner(null);
  };

  const updateOwner = (partial) => {
    setOwner((prev) => ({ ...prev, ...partial }));
  };

  return (
    <OwnerAuthContext.Provider
      value={{ owner, isOwnerAuthenticated: !!owner, loading, login, signup, logout, updateOwner }}
    >
      {children}
    </OwnerAuthContext.Provider>
  );
}

export const useOwnerAuth = () => useContext(OwnerAuthContext);
