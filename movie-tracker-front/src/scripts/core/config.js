(() => {
  const API_BASE_URL_STORAGE_KEY = "movieTracker.apiBaseUrl";
  const ACCESS_TOKEN_STORAGE_KEY = "movieTracker.accessToken";
  const CURRENT_USER_STORAGE_KEY = "movieTracker.currentUser";
  const APP_STATE_TRANSFER_HASH_KEY = "movieTrackerState";
  const LOCAL_API_BASE_URL = "http://127.0.0.1:8000";
  const DEFAULT_APP_BASE_URL = "https://fiormaina.github.io/movie-tracker/";
  const currentUrl = new URL(window.location.href);
  const currentPath = window.location.pathname;
  const pagesMarker = "/pages/";

  function normalizeUrl(value) {
    return String(value ?? "").trim().replace(/\/+$/, "");
  }

  function normalizeAppBaseUrl(value) {
    const trimmedValue = String(value ?? "").trim();
    if (!trimmedValue) return "";

    try {
      const normalizedUrl = new URL(trimmedValue, window.location.href);
      normalizedUrl.pathname = normalizedUrl.pathname.replace(/\/?$/, "/");
      normalizedUrl.search = "";
      normalizedUrl.hash = "";
      return normalizedUrl.href;
    } catch (error) {
      return "";
    }
  }

  function getProjectRootPath(pathname) {
    const safePathname = String(pathname ?? "");
    return safePathname.includes(pagesMarker)
      ? `${safePathname.slice(0, safePathname.indexOf(pagesMarker) + 1)}`
      : safePathname.replace(/[^/]*$/, "");
  }

  function readStoredApiBaseUrl() {
    try {
      return normalizeUrl(window.localStorage.getItem(API_BASE_URL_STORAGE_KEY));
    } catch (error) {
      return "";
    }
  }

  function persistApiBaseUrl(value) {
    try {
      if (value) {
        window.localStorage.setItem(API_BASE_URL_STORAGE_KEY, value);
      } else {
        window.localStorage.removeItem(API_BASE_URL_STORAGE_KEY);
      }
    } catch (error) {
      return;
    }
  }

  function persistTransferredState(state) {
    if (!state || typeof state !== "object") return;

    try {
      if (typeof state.apiBaseUrl === "string" && normalizeUrl(state.apiBaseUrl)) {
        window.localStorage.setItem(API_BASE_URL_STORAGE_KEY, normalizeUrl(state.apiBaseUrl));
      }

      if (typeof state.accessToken === "string" && state.accessToken.trim()) {
        window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, state.accessToken.trim());
      }

      if (state.currentUser && typeof state.currentUser === "object") {
        window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(state.currentUser));
      }
    } catch (error) {
      console.warn(error);
    }
  }

  function consumeTransferredState() {
    const hashValue = currentUrl.hash.startsWith("#") ? currentUrl.hash.slice(1) : currentUrl.hash;
    if (!hashValue) return;

    const hashParams = new URLSearchParams(hashValue);
    const encodedState = hashParams.get(APP_STATE_TRANSFER_HASH_KEY);
    if (!encodedState) return;

    try {
      const normalizedBase64 = encodedState.replace(/-/g, "+").replace(/_/g, "/");
      const decodedJson = window.atob(normalizedBase64);
      const parsedState = JSON.parse(decodedJson);
      persistTransferredState(parsedState);
    } catch (error) {
      console.warn(error);
    }

    hashParams.delete(APP_STATE_TRANSFER_HASH_KEY);
    const nextHash = hashParams.toString();
    currentUrl.hash = nextHash ? `#${nextHash}` : "";
    window.history.replaceState({}, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
  }

  function resolveAppBaseUrl() {
    const metaValue = normalizeAppBaseUrl(
      document.querySelector('meta[name="movie-tracker-app-base-url"]')?.content,
    );
    if (metaValue) {
      return metaValue;
    }

    const globalValue = normalizeAppBaseUrl(window.__MOVIE_TRACKER_CONFIG__?.appBaseUrl);
    if (globalValue) {
      return globalValue;
    }

    return normalizeAppBaseUrl(DEFAULT_APP_BASE_URL);
  }

  consumeTransferredState();

  function resolveApiBaseUrl() {
    const queryValue = normalizeUrl(currentUrl.searchParams.get("apiBaseUrl"));

    if (queryValue) {
      persistApiBaseUrl(queryValue);
      currentUrl.searchParams.delete("apiBaseUrl");
      window.history.replaceState({}, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
      return queryValue;
    }

    const globalValue = normalizeUrl(window.__MOVIE_TRACKER_CONFIG__?.apiBaseUrl);
    if (globalValue) {
      return globalValue;
    }

    const storedValue = readStoredApiBaseUrl();
    if (storedValue) {
      return storedValue;
    }

    return LOCAL_API_BASE_URL;
  }

  const appBaseUrl = resolveAppBaseUrl();
  const projectRootPath = getProjectRootPath(new URL(appBaseUrl).pathname) || getProjectRootPath(currentPath);

  window.MovieTrackerConfig = Object.freeze({
    apiBaseUrl: resolveApiBaseUrl(),
    apiBaseUrlStorageKey: API_BASE_URL_STORAGE_KEY,
    appBaseUrl,
    appStateTransferHashKey: APP_STATE_TRANSFER_HASH_KEY,
    projectRootPath,
  });
})();
