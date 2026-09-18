const AUTH_STORAGE_KEYS = [
  "accessToken",
  "refreshToken",
  "tokenExpiresAt",
  "user",
  "role",
  "isAuth",
];

const canUseBrowserStorage = () =>
  typeof window !== "undefined";

const decodeJwtPayload = (token) => {
  try {
    const encodedPayload = String(token || "").split(".")[1];
    if (!encodedPayload || typeof window.atob !== "function") return null;

    const base64 = encodedPayload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");

    return JSON.parse(window.atob(base64));
  } catch {
    return null;
  }
};

export const getStoredAccessToken = () => {
  if (!canUseBrowserStorage()) return "";

  return String(
    window.sessionStorage.getItem("accessToken") ||
      window.localStorage.getItem("accessToken") ||
      "",
  ).trim();
};

export const getAccessTokenExpiresAt = (token = getStoredAccessToken()) => {
  const payload = decodeJwtPayload(token);
  const jwtExpiresAt = Number(payload?.exp);

  if (Number.isFinite(jwtExpiresAt) && jwtExpiresAt > 0) {
    return jwtExpiresAt * 1000;
  }

  if (!canUseBrowserStorage()) return null;

  const storedExpiresAt =
    window.sessionStorage.getItem("tokenExpiresAt") ||
    window.localStorage.getItem("tokenExpiresAt");

  if (!storedExpiresAt) return null;

  const numericExpiresAt = Number(storedExpiresAt);
  if (Number.isFinite(numericExpiresAt) && numericExpiresAt > 0) {
    return numericExpiresAt < 10_000_000_000
      ? numericExpiresAt * 1000
      : numericExpiresAt;
  }

  const parsedExpiresAt = Date.parse(storedExpiresAt);
  return Number.isFinite(parsedExpiresAt) ? parsedExpiresAt : null;
};

export const isAccessTokenExpired = (
  token = getStoredAccessToken(),
  now = Date.now(),
) => {
  if (!token) return true;

  const expiresAt = getAccessTokenExpiresAt(token);
  return expiresAt !== null && expiresAt <= now;
};

export const clearAuthSession = () => {
  if (!canUseBrowserStorage()) return;

  AUTH_STORAGE_KEYS.forEach((key) => {
    window.sessionStorage.removeItem(key);
    window.localStorage.removeItem(key);
  });
};

export const redirectToLogin = () => {
  if (!canUseBrowserStorage() || window.location.pathname === "/login") {
    return;
  }

  window.location.replace("/login");
};

export const expireAuthSession = () => {
  clearAuthSession();
  redirectToLogin();
};

export const isAuthenticationError = (error) =>
  error?.code === "AUTH_SESSION_EXPIRED" ||
  error?.response?.status === 401;

