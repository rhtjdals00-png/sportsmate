import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../api/authApi";
import { isSupabaseConfigured, supabase } from "../api/supabaseClient";

const AuthContext = createContext(null);

const SUPABASE_CONFIG_ERROR = "Supabase 환경변수가 설정되지 않아 인증 기능을 사용할 수 없습니다.";
const SUPABASE_AUTH_PROVIDERS = ["google", "kakao"];
const AUTH_PROVIDER_ORDER = ["email", "google", "kakao"];
const SUPABASE_TOKEN_ERROR_MESSAGE = "인증번호가 만료되었거나 올바르지 않습니다. 메일함의 최신 인증번호를 다시 입력해주세요.";

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(SUPABASE_CONFIG_ERROR);
  }
  return supabase;
}

function normalizeAuthProvider(provider) {
  const nextProvider = typeof provider === "string" ? provider : provider?.id;
  if (!SUPABASE_AUTH_PROVIDERS.includes(nextProvider)) {
    throw new Error("지원하지 않는 소셜 로그인 제공자입니다.");
  }
  return nextProvider;
}

function getAuthRedirectUrl(path = "/auth/callback") {
  return `${window.location.origin}${path}`;
}

function providerListFromSupabaseUser(user, fallback = {}) {
  const providers = new Set();
  const addProvider = (value) => {
    if (typeof value !== "string") return;
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => providers.add(item));
  };

  // 2026-07-06: Supabase에 email+google처럼 여러 identity가 연결된 경우 SportsMate provider도 같은 목록으로 동기화.
  user?.identities?.forEach((identity) => addProvider(identity?.provider));
  addProvider(user?.app_metadata?.provider);
  addProvider(fallback.provider);
  if (!providers.size && user?.email) providers.add("email");

  return AUTH_PROVIDER_ORDER.filter((provider) => providers.has(provider))
    .concat([...providers].filter((provider) => !AUTH_PROVIDER_ORDER.includes(provider)))
    .join(",") || "email";
}

function metadataFromSupabaseUser(user, fallback = {}) {
  const metadata = user?.user_metadata || {};
  const provider = providerListFromSupabaseUser(user, fallback);
  const providerId = user?.identities?.[0]?.id || user?.id || "user";
  const email = user?.email || metadata.email || fallback.email || `${providerId}@${provider}.sportsmate.local`;
  const emailName = email.split("@")[0];
  const displayName = fallback.name || metadata.name || metadata.full_name || metadata.nickname || metadata.preferred_username || emailName;
  const defaultNickname = fallback.nickname || metadata.nickname || metadata.name || metadata.full_name || metadata.preferred_username || emailName;
  return {
    auth_user_id: user?.id,
    email,
    name: displayName,
    nickname: defaultNickname,
    phone_number: fallback.phone_number || metadata.phone_number || user?.phone || "",
    provider,
    provider_id: providerId,
    profile_image_url: metadata.avatar_url || metadata.picture || "",
    allow_nickname_suffix: Boolean(fallback.allow_nickname_suffix),
    force_profile_update: Boolean(fallback.force_profile_update)
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [backendTokenReady, setBackendTokenReady] = useState(false);

  const syncProfile = async (supabaseUser, fallback = {}) => {
    if (!supabaseUser) return null;
    setAuthError("");
    const data = await authApi.sync(metadataFromSupabaseUser(supabaseUser, fallback));
    if (data.access_token) {
      // 2026-07-01: 보호 API 호출은 백엔드 토큰 발급 이후에만 허용.
      localStorage.setItem("sportsmate_token", data.access_token);
      setBackendTokenReady(true);
    } else {
      localStorage.removeItem("sportsmate_token");
      setBackendTokenReady(false);
    }
    if (typeof data.is_new_user === "boolean") {
      const currentRedirect = localStorage.getItem("sportsmate_post_auth_redirect");
      const needsProfile = data.profile_intro_required ?? (data.is_new_user || data.profile_complete === false);
      if (needsProfile) {
        localStorage.setItem("sportsmate_post_auth_redirect", "/profile/intro");
      } else if (currentRedirect !== "/profile/intro" && currentRedirect !== "/profile/setup") {
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
      setBackendTokenReady(false);
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
      setBackendTokenReady(false);
      if (currentSession?.user) {
        try {
          await syncProfile(currentSession.user, { allow_nickname_suffix: true });
        } catch (error) {
          const msg = error?.response?.data?.message || error?.message || "로그인 동기화에 실패했습니다.";
          if (msg === "정지된 회원입니다.") {
            alert("정지된 회원입니다.");
          }
          setAuthError(msg);
          setBackendTokenReady(false);
          setUser(null);
          if (supabase) {
            await supabase.auth.signOut().catch(() => {});
          }
        }
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      localStorage.removeItem("sportsmate_token");
      setBackendTokenReady(false);
      if (nextSession?.user) {
        try {
          await syncProfile(nextSession.user, { allow_nickname_suffix: true });
        } catch (error) {
          const msg = error?.response?.data?.message || error?.message || "로그인 동기화에 실패했습니다.";
          if (msg === "정지된 회원입니다.") {
            alert("정지된 회원입니다.");
          }
          setAuthError(msg);
          setBackendTokenReady(false);
          setUser(null);
          if (supabase) {
            await supabase.auth.signOut().catch(() => {});
          }
        }
      } else {
        setAuthError("");
        setBackendTokenReady(false);
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
      authError,
      backendTokenReady,
      loading,
      isAuthenticated: Boolean(user),
      async login(payload) {
        localStorage.removeItem("sportsmate_post_auth_redirect");
        const client = requireSupabase();
        const { data, error } = await client.auth.signInWithPassword({
          email: payload.email,
          password: payload.password
        });
        if (error) throw error;
        try {
          await syncProfile(data.user, { allow_nickname_suffix: true });
        } catch (syncError) {
          await client.auth.signOut().catch(() => {});
          throw syncError;
        }
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
      async verifySignupEmailCode(email, token) {
        const client = requireSupabase();
        const { data, error } = await client.auth.verifyOtp({
          email,
          token,
          type: "email"
        });
        if (error) {
          const { data: signupData, error: signupError } = await client.auth.verifyOtp({
            email,
            token,
            type: "signup"
          });
          if (signupError) {
            const message = signupError.message || "";
            if (message.toLowerCase().includes("token")) {
              throw new Error(SUPABASE_TOKEN_ERROR_MESSAGE);
            }
            throw signupError;
          }
          const nextSession = signupData.session || (await client.auth.getSession()).data.session;
          setSession(nextSession);
          return signupData;
        }
        const nextSession = data.session || (await client.auth.getSession()).data.session;
        setSession(nextSession);
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
        const synced = await syncProfile(data.user || currentUser, { ...payload, force_profile_update: true });
        return synced;
      },
      async socialLogin(provider) {
        localStorage.removeItem("sportsmate_post_auth_redirect");
        const client = requireSupabase();
        const nextProvider = normalizeAuthProvider(provider);
        const { data, error } = await client.auth.signInWithOAuth({
          provider: nextProvider,
          options: {
            redirectTo: getAuthRedirectUrl("/auth/callback")
          }
        });
        if (error) throw error;
        return data;
      },
      async completeOAuthCallback(callbackUrl = window.location.href) {
        const client = requireSupabase();
        const url = new URL(callbackUrl);
        const searchParams = url.searchParams;
        let nextUser = null;

        if (searchParams.has("code")) {
          const { data, error } = await client.auth.exchangeCodeForSession(callbackUrl);
          if (error) throw error;
          nextUser = data.session?.user || data.user || null;
        }

        if (!nextUser) {
          const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");

          if (accessToken && refreshToken) {
            const { data, error } = await client.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken
            });

            if (error) throw error;
            nextUser = data.session?.user || data.user || null;
          }
        }

        if (!nextUser) {
          await new Promise((resolve) => window.setTimeout(resolve, 300));
          const { data } = await client.auth.getSession();
          nextUser = data.session?.user || null;
        }

        if (!nextUser) {
          throw new Error("로그인 세션을 확인하지 못했습니다. 다시 로그인해주세요.");
        }

        return syncProfile(nextUser, { allow_nickname_suffix: true });
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
        setBackendTokenReady(false);
        setAuthError("");
        setUser(null);
        setSession(null);
        alert("로그아웃 되었습니다.");
      },
      setCurrentUser(nextUser) {
        setUser(nextUser);
      }
    }),
    [user, session, authError, backendTokenReady, loading]
  );

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        await authApi.me();
      } catch (err) {
        if (err.response?.status === 401) {
          const msg = err.response.data?.message || err.response.data?.msg;
          if (msg === "정지된 회원입니다.") {
            clearInterval(interval);
          }
        }
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
