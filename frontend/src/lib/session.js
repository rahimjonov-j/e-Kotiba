const AUTH_TOKEN_KEY = "kotiba-auth-token";

export const getStoredAuthToken = () => {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(AUTH_TOKEN_KEY) || "";
};

export const setStoredAuthToken = (token) => {
  if (typeof window === "undefined") return;
  if (!token) {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    return;
  }
  localStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const clearStoredAuthToken = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_TOKEN_KEY);
};
