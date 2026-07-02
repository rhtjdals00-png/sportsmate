const PROFILE_EDIT_VERIFIED_KEY = "sportsmate_profile_edit_verified_until";
const PROFILE_EDIT_VERIFIED_DURATION_MS = 5 * 60 * 1000;

export function markProfileEditVerified() {
  // 2026-07-02: 비밀번호 확인 성공 후 짧은 시간 동안만 프로필 수정 직접 접근을 허용.
  sessionStorage.setItem(PROFILE_EDIT_VERIFIED_KEY, String(Date.now() + PROFILE_EDIT_VERIFIED_DURATION_MS));
}

export function clearProfileEditVerified() {
  sessionStorage.removeItem(PROFILE_EDIT_VERIFIED_KEY);
}

export function isProfileEditVerified() {
  const expiresAt = Number(sessionStorage.getItem(PROFILE_EDIT_VERIFIED_KEY) || 0);
  if (!expiresAt || expiresAt <= Date.now()) {
    clearProfileEditVerified();
    return false;
  }
  return true;
}
