import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { authApi } from "../api/authApi";
import { isSupabaseConfigured, supabase } from "../api/supabaseClient";
import AccountRestorationModal from "../components/auth/AccountRestorationModal.jsx";
import { completeLogout } from "../utils/authLogout.js";

const AuthContext = createContext(null);

const SUPABASE_CONFIG_ERROR = "Supabase 환경변수가 설정되지 않아 인증 기능을 사용할 수 없습니다.";
const SUPABASE_AUTH_PROVIDERS = ["google", "kakao"];
const AUTH_PROVIDER_ORDER = ["email", "google", "kakao"];
const SUPABASE_TOKEN_ERROR_MESSAGE = "인증번호가 만료되었거나 올바르지 않습니다. 메일함의 최신 인증번호를 다시 입력해주세요.";
const SYNC_RESULT_TTL_MS = 1500;
const LOGIN_PROVIDERS = ["email", "google", "kakao"];
const PENDING_LOGIN_PROVIDER_KEY = "sportsmate_pending_login_provider";
const AUTH_BOUNDARY_ERROR_CODES = new Set(["LOGIN_PROVIDER_MISMATCH", "AUTH_USER_ID_MISMATCH"]);

function normalizeLoginProvider(provider) {
  if (typeof provider !== "string") return null;
  const normalized = provider.trim().toLowerCase();
  return LOGIN_PROVIDERS.includes(normalized) ? normalized : null;
}

function readPendingLoginProvider() {
  const storedProvider = window.sessionStorage.getItem(PENDING_LOGIN_PROVIDER_KEY)
    || window.localStorage.getItem(PENDING_LOGIN_PROVIDER_KEY);
  if (!storedProvider) return null;
  const normalized = normalizeLoginProvider(storedProvider);
  if (!normalized) clearPendingLoginProvider();
  return normalized;
}

function storePendingLoginProvider(provider) {
  const normalized = normalizeLoginProvider(provider);
  clearPendingLoginProvider();
  if (normalized) {
    window.sessionStorage.setItem(PENDING_LOGIN_PROVIDER_KEY, normalized);
    window.localStorage.setItem(PENDING_LOGIN_PROVIDER_KEY, normalized);
  }
  return normalized;
}

function clearPendingLoginProvider() {
  window.sessionStorage.removeItem(PENDING_LOGIN_PROVIDER_KEY);
  window.localStorage.removeItem(PENDING_LOGIN_PROVIDER_KEY);
}

function authBoundaryErrorCode(error) {
  return error?.response?.data?.code || error?.response?.data?.error || "";
}

function isAuthBoundaryError(error) {
  return AUTH_BOUNDARY_ERROR_CODES.has(authBoundaryErrorCode(error));
}

function createAuthBoundaryError(responseData) {
  const error = new Error(responseData?.message || "계정 연결 정보를 확인할 수 없습니다. 관리자에게 문의해 주세요.");
  error.response = { status: 409, data: responseData };
  return error;
}

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
    force_profile_update: Boolean(fallback.force_profile_update),
    login_provider: normalizeLoginProvider(fallback.login_provider)
  };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [backendTokenReady, setBackendTokenReady] = useState(false);
  const [restorationState, setRestorationState] = useState(null);
  const activeSyncsRef = useRef(new Map());
  const currentSyncTokenRef = useRef("");
  const authBoundaryErrorRef = useRef(null);

  const clearSyncCache = () => {
    activeSyncsRef.current.forEach((entry) => {
      if (entry.cleanupTimer) window.clearTimeout(entry.cleanupTimer);
    });
    activeSyncsRef.current.clear();
  };

  const clearAuthenticationAfterBoundaryError = (error, supabaseAccessToken) => {
    const message = error?.response?.data?.message || "계정 연결 정보를 확인할 수 없습니다. 관리자에게 문의해 주세요.";
    authBoundaryErrorRef.current = {
      accessToken: supabaseAccessToken,
      responseData: error?.response?.data || { code: authBoundaryErrorCode(error), message }
    };
    clearPendingLoginProvider();
    currentSyncTokenRef.current = "";
    clearSyncCache();
    localStorage.removeItem("sportsmate_token");
    setBackendTokenReady(false);
    setUser(null);
    setSession(null);
    // This helper can run inside Supabase's onAuthStateChange callback. Awaiting
    // signOut there deadlocks because signOut waits for the current auth event
    // callback to finish. Schedule it after the callback has unwound instead.
    if (supabase) {
      window.setTimeout(() => {
        supabase.auth.signOut().catch(() => {});
      }, 0);
    }
    setAuthError(message);
    sessionStorage.setItem("sportsmate_auth_error", message);
  };

  const syncProfile = (supabaseUser, fallback = {}, supabaseAccessToken = "") => {
    if (!supabaseUser) return Promise.resolve(null);
    if (!supabaseAccessToken) {
      return Promise.reject(new Error("Supabase 로그인 세션을 확인할 수 없습니다."));
    }
    const boundaryError = authBoundaryErrorRef.current;
    if (boundaryError?.accessToken === supabaseAccessToken) {
      return Promise.reject(createAuthBoundaryError(boundaryError.responseData));
    }

    const syncPayload = metadataFromSupabaseUser(supabaseUser, fallback);
    const sessionKey = `${supabaseUser.id}:${supabaseAccessToken}:${JSON.stringify(syncPayload)}`;
    const activeSync = activeSyncsRef.current.get(sessionKey);
    if (activeSync) {
      const isReusable = activeSync.status === "pending"
        || Date.now() - activeSync.completedAt < SYNC_RESULT_TTL_MS;
      if (isReusable) return activeSync.promise;
      if (activeSync.cleanupTimer) window.clearTimeout(activeSync.cleanupTimer);
      activeSyncsRef.current.delete(sessionKey);
    }

    currentSyncTokenRef.current = supabaseAccessToken;
    const syncEntry = {
      promise: null,
      status: "pending",
      completedAt: 0,
      cleanupTimer: null
    };
    const syncRequest = (async () => {
      let data;
      try {
        data = await authApi.sync(syncPayload, supabaseAccessToken);
      } catch (error) {
        if (isAuthBoundaryError(error)) {
          clearAuthenticationAfterBoundaryError(error, supabaseAccessToken);
          throw createAuthBoundaryError(error.response.data);
        }
        throw error;
      }

      // 로그아웃 또는 다른 세션 전환 뒤 도착한 이전 응답은 인증 상태에 반영하지 않는다.
      if (currentSyncTokenRef.current !== supabaseAccessToken) return data;

      if (data.account_restoration_required) {
        localStorage.removeItem("sportsmate_token");
        setRestorationState({
          user: data.user,
          remainingDays: data.remaining_days,
          supabaseAccessToken
        });
        setBackendTokenReady(false);
        setUser(null);
        return data;
      }

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
      setAuthError("");
      sessionStorage.removeItem("sportsmate_auth_error");
      return data;
    })();

    const finishSync = (status) => {
      syncEntry.status = status;
      syncEntry.completedAt = Date.now();
      if (activeSyncsRef.current.get(sessionKey) !== syncEntry) return;
      syncEntry.cleanupTimer = window.setTimeout(() => {
        if (activeSyncsRef.current.get(sessionKey) === syncEntry) {
          activeSyncsRef.current.delete(sessionKey);
        }
      }, SYNC_RESULT_TTL_MS);
    };
    const sharedSyncRequest = syncRequest.then(
      (data) => {
        finishSync("fulfilled");
        return data;
      },
      (error) => {
        finishSync("rejected");
        throw error;
      }
    );
    syncEntry.promise = sharedSyncRequest;
    activeSyncsRef.current.set(sessionKey, syncEntry);
    return sharedSyncRequest;
  };

  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured || !supabase) {
      currentSyncTokenRef.current = "";
      clearSyncCache();
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
      const isOAuthCallback = window.location.pathname === "/auth/callback";
      setSession(currentSession);
      localStorage.removeItem("sportsmate_token");
      setBackendTokenReady(false);
      // OAuth 콜백에서는 exchangeCodeForSession/onAuthStateChange가 provider와 함께 동기화한다.
      // 초기 세션 복원이 먼저 provider 없는 /auth/sync를 보내고 세션을 로그아웃시키는 경쟁을 막는다.
      if (currentSession?.user && !isOAuthCallback) {
        try {
          await syncProfile(currentSession.user, { allow_nickname_suffix: true }, currentSession.access_token);
        } catch (error) {
          const msg = error?.response?.data?.message || error?.message || "로그인 동기화에 실패했습니다.";
          if (isAuthBoundaryError(error)) {
            setAuthError(msg);
            setLoading(false);
            return;
          }
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

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      localStorage.removeItem("sportsmate_token");
      setBackendTokenReady(false);

      // The callback page completes OAuth and reports provider mismatches itself.
      // Starting another sync from the auth event makes setSession wait for this
      // callback, so the page cannot receive the 409 and navigate to /login.
      if (nextSession?.user && window.location.pathname === "/auth/callback") {
        setLoading(false);
        return;
      }

      if (nextSession?.user) {
        // Never await asynchronous work from inside onAuthStateChange. Supabase
        // auth methods may wait for this callback to return before resolving.
        window.setTimeout(async () => {
          if (!mounted) return;
          try {
            await syncProfile(nextSession.user, {
              allow_nickname_suffix: true,
              login_provider: readPendingLoginProvider()
            }, nextSession.access_token);
          } catch (error) {
            const msg = error?.response?.data?.message || error?.message || "로그인 동기화에 실패했습니다.";
            if (isAuthBoundaryError(error)) {
              setAuthError(msg);
              setLoading(false);
              return;
            }
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
          setLoading(false);
        }, 0);
      } else {
        if (window.location.pathname !== "/auth/callback") {
          clearPendingLoginProvider();
        }
        currentSyncTokenRef.current = "";
        clearSyncCache();
        setAuthError("");
        setBackendTokenReady(false);
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
      currentSyncTokenRef.current = "";
      clearSyncCache();
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
        authBoundaryErrorRef.current = null;
        setAuthError("");
        sessionStorage.removeItem("sportsmate_auth_error");
        storePendingLoginProvider("email");
        try {
          const { data, error } = await client.auth.signInWithPassword({
            email: payload.email,
            password: payload.password
          });
          if (error) throw error;
          try {
            await syncProfile(data.user, {
              allow_nickname_suffix: true,
              login_provider: "email"
            }, data.session?.access_token);
          } catch (syncError) {
            if (!isAuthBoundaryError(syncError)) {
              await client.auth.signOut().catch(() => {});
            }
            throw syncError;
          }
          return data;
        } finally {
          authBoundaryErrorRef.current = null;
          clearPendingLoginProvider();
        }
      },
      async register(payload) {
        localStorage.removeItem("sportsmate_post_auth_redirect");
        const client = requireSupabase();
        setAuthError("");
        sessionStorage.removeItem("sportsmate_auth_error");
        storePendingLoginProvider("email");
        try {
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
          if (data.user && data.session?.access_token) {
            await syncProfile(data.user, { ...payload, login_provider: "email" }, data.session.access_token);
          }
          return data;
        } finally {
          clearPendingLoginProvider();
        }
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
        storePendingLoginProvider("email");
        try {
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
        } catch (error) {
          clearPendingLoginProvider();
          throw error;
        }
      },
      async registerVerifiedEmail(payload) {
        const client = requireSupabase();
        storePendingLoginProvider("email");
        try {
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
          const synced = await syncProfile(data.user || currentUser, {
            ...payload,
            force_profile_update: true,
            login_provider: "email"
          }, currentSession.access_token);
          return synced;
        } finally {
          clearPendingLoginProvider();
        }
      },
      async socialLogin(provider) {
        const client = requireSupabase();
        authBoundaryErrorRef.current = null;
        setAuthError("");
        sessionStorage.removeItem("sportsmate_auth_error");
        clearPendingLoginProvider();
        const nextProvider = normalizeAuthProvider(provider);
        storePendingLoginProvider(nextProvider);
        try {
          const { data, error } = await client.auth.signInWithOAuth({
            provider: nextProvider,
            options: {
              redirectTo: getAuthRedirectUrl(`/auth/callback?login_provider=${encodeURIComponent(nextProvider)}`)
            }
          });
          if (error) throw error;
          return data;
        } catch (error) {
          clearPendingLoginProvider();
          throw error;
        }
      },
      async completeOAuthCallback(callbackUrl = window.location.href) {
        const client = requireSupabase();
        const url = new URL(callbackUrl);
        const searchParams = url.searchParams;
        const callbackProvider = normalizeLoginProvider(searchParams.get("login_provider"));
        const pendingProvider = callbackProvider || readPendingLoginProvider();
        const loginProvider = SUPABASE_AUTH_PROVIDERS.includes(pendingProvider) ? pendingProvider : null;
        let nextUser = null;
        let nextAccessToken = "";

        try {
        if (searchParams.has("code")) {
          const authCode = searchParams.get("code");
          const { data, error } = await client.auth.exchangeCodeForSession(authCode);
          if (error) throw error;
          nextUser = data.session?.user || data.user || null;
          nextAccessToken = data.session?.access_token || "";
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
            nextAccessToken = data.session?.access_token || "";
          }
        }

        if (!nextUser || !nextAccessToken) {
          await new Promise((resolve) => window.setTimeout(resolve, 300));
          const { data } = await client.auth.getSession();
          nextUser = nextUser || data.session?.user || null;
          nextAccessToken = nextAccessToken || data.session?.access_token || "";
        }

        if (!nextUser) {
          throw new Error("로그인 세션을 확인하지 못했습니다. 다시 로그인해주세요.");
        }

        return await syncProfile(nextUser, {
          allow_nickname_suffix: true,
          login_provider: loginProvider
        }, nextAccessToken);
        } finally {
          authBoundaryErrorRef.current = null;
          clearPendingLoginProvider();
        }
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
        return completeLogout({
          beforeTasks: [
            () => {
              authBoundaryErrorRef.current = null;
            },
            clearPendingLoginProvider,
            () => {
              currentSyncTokenRef.current = "";
            },
            clearSyncCache,
          ],
          signOut: isSupabaseConfigured && supabase
            ? () => supabase.auth.signOut()
            : null,
          cleanupTasks: [
            () => localStorage.removeItem("sportsmate_token"),
            () => setBackendTokenReady(false),
            () => setAuthError(""),
            () => sessionStorage.removeItem("sportsmate_auth_error"),
            () => setUser(null),
            () => setSession(null),
          ],
        });
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
      const token = localStorage.getItem("sportsmate_token");
      if (!token) {
        clearInterval(interval);
        return;
      }
      try {
        await authApi.me();
      } catch (err) {
        if (err.response?.status === 401) {
          clearInterval(interval);
          const msg = err.response.data?.message || err.response.data?.msg;
          if (msg === "정지된 회원입니다.") {
            // Optional specific logic for suspended users if needed in the future
          }
        }
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const handleAccountRestored = (res) => {
    setRestorationState(null);
    if (res?.access_token) {
      localStorage.setItem("sportsmate_token", res.access_token);
      setBackendTokenReady(true);
    }
    if (res?.user) {
      setUser(res.user);
    }
  };

  const handleCancelRestoration = async () => {
    setRestorationState(null);
    localStorage.removeItem("sportsmate_token");
    setBackendTokenReady(false);
    setUser(null);
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <AccountRestorationModal
        restorationState={restorationState}
        onRestored={handleAccountRestored}
        onCancel={handleCancelRestoration}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
