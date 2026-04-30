(() => {
  const projectRootPath = String(window.MovieTrackerConfig?.projectRootPath ?? "/");

  function createRelativePath(pathname, params = {}) {
    const url = new URL(pathname, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      url.searchParams.set(key, value);
    });
    return `${url.pathname}${url.search}${url.hash}`;
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
  });

  window.MovieTrackerRoutes = routes;
})();
