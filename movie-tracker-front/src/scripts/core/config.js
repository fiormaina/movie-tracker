(() => {
  const API_BASE_URL_STORAGE_KEY = "movieTracker.apiBaseUrl";
  const LOCAL_API_BASE_URL = "http://127.0.0.1:8000";
  const currentUrl = new URL(window.location.href);
  const currentPath = window.location.pathname;
  const pagesMarker = "/pages/";
  const projectRootPath = currentPath.includes(pagesMarker)
    ? `${currentPath.slice(0, currentPath.indexOf(pagesMarker) + 1)}`
    : currentPath.replace(/[^/]*$/, "");

  function normalizeUrl(value) {
    return String(value ?? "").trim().replace(/\/+$/, "");
  }

  function isLocalHostname(hostname) {
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
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

    return isLocalHostname(window.location.hostname) ? LOCAL_API_BASE_URL : "";
  }

  window.MovieTrackerConfig = Object.freeze({
    apiBaseUrl: resolveApiBaseUrl(),
    apiBaseUrlStorageKey: API_BASE_URL_STORAGE_KEY,
    projectRootPath,
  });
})();
