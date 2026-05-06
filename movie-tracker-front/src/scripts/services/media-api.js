(() => {
  const apiClient = window.MovieTrackerApiClient;

  function cloneWatchItems(items = []) {
    return items.map((item) => ({ ...item }));
  }

  function cloneMovie(movie) {
    if (!movie || typeof movie !== "object") return movie;

    return {
      ...movie,
      genres: Array.isArray(movie.genres) ? [...movie.genres] : [],
    };
  }

  function unwrapEntity(data, fallbackValue) {
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.results)) return data.results;
    if (data?.item) return data.item;
    if (data?.movie) return data.movie;
    if (data?.history) return data.history;
    return data ?? fallbackValue;
  }

  function createFallbackWatchItem(payload) {
    return {
      id: `manual-${Date.now()}`,
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  function createFallbackMoviePatch(id, patch) {
    return {
      id,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
  }

  const mediaApi = {
    async listWatchHistory(fallbackItems = []) {
      return apiClient.withLocalFallback(
        async () => {
          const data = await apiClient.request("/watch-history", { method: "GET" }, { namespace: "watch-history" });
          const items = unwrapEntity(data, fallbackItems);
          return Array.isArray(items) ? items : cloneWatchItems(fallbackItems);
        },
        async () => cloneWatchItems(fallbackItems),
      );
    },

    async createWatchItem(payload) {
      return apiClient.withLocalFallback(
        async () => {
          const data = await apiClient.request("/watch-history", {
            method: "POST",
            body: JSON.stringify(payload),
          }, { namespace: "watch-history" });
          return unwrapEntity(data, null) ?? createFallbackWatchItem(payload);
        },
        async () => createFallbackWatchItem(payload),
      );
    },

    async updateWatchItem(id, patch) {
      return apiClient.withLocalFallback(
        async () => {
          const data = await apiClient.request(`/watch-history/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: JSON.stringify(patch),
          }, { namespace: "watch-history" });
          return unwrapEntity(data, null) ?? createFallbackMoviePatch(id, patch);
        },
        async () => createFallbackMoviePatch(id, patch),
      );
    },

    async getMovieDetail(id, fallbackMovie = null) {
      return apiClient.withLocalFallback(
        async () => {
          const data = await apiClient.request(`/media/${encodeURIComponent(id)}`, { method: "GET" }, { namespace: "media" });
          return cloneMovie(unwrapEntity(data, fallbackMovie));
        },
        async () => cloneMovie(fallbackMovie),
      );
    },

    async updateMovie(id, patch) {
      return apiClient.withLocalFallback(
        async () => {
          const data = await apiClient.request(`/media/${encodeURIComponent(id)}`, {
            method: "PATCH",
            body: JSON.stringify(patch),
          }, { namespace: "media" });
          return unwrapEntity(data, null) ?? createFallbackMoviePatch(id, patch);
        },
        async () => createFallbackMoviePatch(id, patch),
      );
    },
  };

  window.MovieTrackerMediaApi = Object.freeze(mediaApi);
})();
