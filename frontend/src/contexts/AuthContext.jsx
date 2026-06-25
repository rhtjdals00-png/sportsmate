import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../api/authApi";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem("sportsmate_token")));

  useEffect(() => {
    if (!localStorage.getItem("sportsmate_token")) return;

    authApi
      .me()
      .then((data) => setUser(data.user))
      .catch(() => localStorage.removeItem("sportsmate_token"))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      async login(payload) {
        const data = await authApi.login(payload);
        localStorage.setItem("sportsmate_token", data.access_token);
        setUser(data.user);
        return data;
      },
      async register(payload) {
        const data = await authApi.register(payload);
        localStorage.setItem("sportsmate_token", data.access_token);
        setUser(data.user);
        return data;
      },
      logout() {
        localStorage.removeItem("sportsmate_token");
        setUser(null);
      },
      setCurrentUser(nextUser) {
        setUser(nextUser);
      }
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
