(() => {
  const projectRootPath = String(window.MovieTrackerConfig?.projectRootPath ?? "/");
  const appBaseUrl = String(
    window.MovieTrackerConfig?.appBaseUrl ?? new URL(projectRootPath, window.location.origin).href,
  );
  const appPagePathByFileName = Object.freeze({
    "index.html": `${projectRootPath}index.html`,
    "watch-history.html": `${projectRootPath}pages/watch-history.html`,
    "watch_history_light_v3.html": `${projectRootPath}pages/watch-history.html`,
    "folders.html": `${projectRootPath}pages/folders.html`,
    "folder-create.html": `${projectRootPath}pages/folder-create.html`,
    "folder-detail.html": `${projectRootPath}pages/folder-detail.html`,
    "movie-detail.html": `${projectRootPath}pages/movie-detail.html`,
    "profile.html": `${projectRootPath}pages/profile.html`,
  });

  function createRelativePath(pathname, params = {}) {
    const url = new URL(pathname, appBaseUrl);
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, value);
    });
    return `${url.pathname}${url.search}${url.hash}`;
  }

  function getNormalizedPathname(pathname) {
    const safePathname = String(pathname ?? "").trim();
    if (!safePathname) return "";

    const normalizedPathname = safePathname.split(/[?#]/, 1)[0];
    const filename = normalizedPathname.split("/").pop() ?? "";
    return appPagePathByFileName[filename] ?? normalizedPathname;
  }

  function isAppPathname(pathname) {
    const normalizedPathname = getNormalizedPathname(pathname);
    return Boolean(normalizedPathname && normalizedPathname.startsWith(projectRootPath));
  }

  function resolveAppUrl(value, fallbackPath = `${projectRootPath}index.html`, options = {}) {
    const fallbackRelativeUrl = createRelativePath(fallbackPath);
    const fallbackAbsoluteUrl = new URL(fallbackRelativeUrl, appBaseUrl);
    const shouldReturnAbsolute = options.absolute === true;

    if (typeof value !== "string" || !value.trim()) {
      return shouldReturnAbsolute
        ? fallbackAbsoluteUrl.href
        : `${fallbackAbsoluteUrl.pathname}${fallbackAbsoluteUrl.search}${fallbackAbsoluteUrl.hash}`;
    }

    try {
      const parsedUrl = new URL(value, window.location.href);
      const normalizedPathname = getNormalizedPathname(parsedUrl.pathname);

      if (isAppPathname(normalizedPathname)) {
        const normalizedUrl = new URL(normalizedPathname, appBaseUrl);
        normalizedUrl.search = parsedUrl.search;
        normalizedUrl.hash = parsedUrl.hash;

        return shouldReturnAbsolute
          ? normalizedUrl.href
          : `${normalizedUrl.pathname}${normalizedUrl.search}${normalizedUrl.hash}`;
      }

      return shouldReturnAbsolute
        ? parsedUrl.href
        : `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
    } catch (error) {
      return shouldReturnAbsolute
        ? fallbackAbsoluteUrl.href
        : `${fallbackAbsoluteUrl.pathname}${fallbackAbsoluteUrl.search}${fallbackAbsoluteUrl.hash}`;
    }
  }

  const routes = Object.freeze({
    home: createRelativePath(`${projectRootPath}index.html`),
    watchHistory: createRelativePath(`${projectRootPath}pages/watch-history.html`),
    folders: createRelativePath(`${projectRootPath}pages/folders.html`),
    folderCreate: createRelativePath(`${projectRootPath}pages/folder-create.html`),
    folderDetail: (params = {}) =>
      createRelativePath(`${projectRootPath}pages/folder-detail.html`, params),
    movieDetail: (params = {}) =>
      createRelativePath(`${projectRootPath}pages/movie-detail.html`, params),
    profile: (params = {}) =>
      createRelativePath(`${projectRootPath}pages/profile.html`, params),
    resolveAppUrl,
  });

  window.MovieTrackerRoutes = routes;
})();
