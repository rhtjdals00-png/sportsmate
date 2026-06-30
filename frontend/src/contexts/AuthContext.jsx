import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../api/authApi";
import { isSupabaseConfigured, supabase } from "../api/supabaseClient";

const AuthContext = createContext(null);

const SUPABASE_CONFIG_ERROR = "Supabase 환경변수가 설정되지 않아 인증 기능을 사용할 수 없습니다.";

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(SUPABASE_CONFIG_ERROR);
  }
  return supabase;
}

function getAuthRedirectUrl(path = "/auth/callback") {
  return `${window.location.origin}${path}`;
}

function metadataFromSupabaseUser(user, fallback = {}) {
  const metadata = user?.user_metadata || {};
  const provider = user?.app_metadata?.provider || fallback.provider || "email";
  const providerId = user?.identities?.[0]?.id || user?.id || "user";
  const email = user?.email || metadata.email || fallback.email || `${providerId}@${provider}.sportsmate.local`;
  const emailName = email.split("@")[0];
  const displayName = fallback.name || metadata.name || metadata.full_name || metadata.nickname || metadata.preferred_username || emailName;
  return {
    auth_user_id: user?.id,
    email,
    name: displayName,
    nickname: fallback.nickname || metadata.nickname || metadata.name || metadata.full_name || metadata.preferred_username || emailName,
    phone_number: fallback.phone_number || metadata.phone_number || user?.phone || "",
    provider,
    provider_id: providerId,
    profile_image_url: metadata.avatar_url || metadata.picture || "",
    allow_nickname_suffix: Boolean(fallback.allow_nickname_suffix)
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const syncProfile = async (supabaseUser, fallback = {}) => {
    if (!supabaseUser) return null;
    const data = await authApi.sync(metadataFromSupabaseUser(supabaseUser, fallback));
    if (data.access_token) {
      localStorage.setItem("sportsmate_token", data.access_token);
    }
    if (typeof data.is_new_user === "boolean") {
      const currentRedirect = localStorage.getItem("sportsmate_post_auth_redirect");
      if (data.is_new_user) {
        localStorage.setItem("sportsmate_post_auth_redirect", "/mypage/profile");
      } else if (currentRedirect !== "/mypage/profile") {
        localStorage.setItem("sportsmate_post_auth_redirect", "/");
      }
    }
    setUser(data.user);
    return data;
  };

  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured || !supabase) {
      setSession(null);
      setUser(null);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      const currentSession = data.session;
      setSession(currentSession);
      localStorage.removeItem("sportsmate_token");
      if (currentSession?.user) {
        try {
          await syncProfile(currentSession.user, { allow_nickname_suffix: true });
        } catch {
          setUser(null);
        }
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      localStorage.removeItem("sportsmate_token");
      if (nextSession?.user) {
        try {
          await syncProfile(nextSession.user, { allow_nickname_suffix: true });
        } catch {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      isAuthenticated: Boolean(session?.user),
      async login(payload) {
        localStorage.removeItem("sportsmate_post_auth_redirect");
        const client = requireSupabase();
        const { data, error } = await client.auth.signInWithPassword({
          email: payload.email,
          password: payload.password
        });
        if (error) throw error;
        await syncProfile(data.user, { allow_nickname_suffix: true });
        return data;
      },
      async register(payload) {
        localStorage.removeItem("sportsmate_post_auth_redirect");
        const client = requireSupabase();
        const { data, error } = await client.auth.signUp({
          email: payload.email,
          password: payload.password,
          options: {
            emailRedirectTo: getAuthRedirectUrl("/auth/callback"),
            data: {
              name: payload.name,
              nickname: payload.nickname,
              phone_number: payload.phone_number
            }
          }
        });
        if (error) throw error;
        if (data.user) {
          await syncProfile(data.user, payload);
        }
        return data;
      },

      async requestSignupEmailVerification(email) {
        const client = requireSupabase();
        const { data, error } = await client.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: getAuthRedirectUrl("/register"),
            shouldCreateUser: true
          }
        });
        if (error) throw error;
        return data;
      },
      async registerVerifiedEmail(payload) {
        const client = requireSupabase();
        const { data: sessionData } = await client.auth.getSession();
        const currentSession = sessionData.session;
        const currentUser = currentSession?.user;
        const confirmedAt = currentUser?.email_confirmed_at || currentUser?.confirmed_at;
        if (!currentUser || currentUser.email?.toLowerCase() !== payload.email.toLowerCase() || !confirmedAt) {
          throw new Error("이메일 인증을 완료해주세요.");
        }
        const { data, error } = await client.auth.updateUser({
          password: payload.password,
          data: {
            name: payload.name,
            nickname: payload.nickname,
            phone_number: payload.phone_number
          }
        });
        if (error) throw error;
        const synced = await syncProfile(data.user || currentUser, payload);
        return synced;
      },
      async socialLogin(provider) {
        localStorage.removeItem("sportsmate_post_auth_redirect");
        const client = requireSupabase();
        const { data, error } = await client.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: getAuthRedirectUrl("/auth/callback")
          }
        });
        if (error) throw error;
        return data;
      },
      async resendSignupEmail(email) {
        const client = requireSupabase();
        const { data, error } = await client.auth.resend({
          type: "signup",
          email,
          options: {
            emailRedirectTo: getAuthRedirectUrl("/auth/callback")
          }
        });
        if (error) throw error;
        return data;
      },
      async logout() {
        if (isSupabaseConfigured && supabase) {
          await supabase.auth.signOut();
        }
        localStorage.removeItem("sportsmate_token");
        setUser(null);
        setSession(null);
      },
      setCurrentUser(nextUser) {
        setUser(nextUser);
      }
    }),
    [user, session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}



