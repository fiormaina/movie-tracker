(() => {
const {
  autoSizeTextarea,
  navigateToPage,
  renderModalShell,
  renderTabs,
  renderToasts,
} = window.MovieTrackerUI;

const ACCESS_TOKEN_STORAGE_KEY = "movieTracker.accessToken";

const initialState = {
  movie: null,
  customFolders: [],
  loading: true,
  loadError: "",
  tabs: [
    { label: "История просмотра", active: true, static: true },
    { label: "Папки", active: false, url: "./folders.html" },
  ],
  ratingOverlay: {
    isOpen: false,
    value: 0,
    comment: "",
    loading: false,
  },
  folderOverlay: {
    isOpen: false,
    selectedFolderId: null,
    loading: false,
  },
  toasts: [],
};

const movieDetailApi = {
  async fetchMovie(id) {
    return requestJson(`${getWatchItemsEndpoint()}/${encodeURIComponent(id)}`);
  },
  async fetchFolders() {
    return requestJson(getFoldersEndpoint());
  },
  async updateMovie(id, patch) {
    return requestJson(`${getWatchItemsEndpoint()}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: patch,
    });
  },
};

let state = cloneState(initialState);
let toastId = 0;
let rootElement = null;

function cloneState(value) {
  return {
    ...value,
    movie: value.movie ? { ...value.movie, genres: [...value.movie.genres] } : null,
    customFolders: value.customFolders.map((folder) => ({ ...folder })),
    tabs: value.tabs.map((tab) => ({ ...tab })),
    ratingOverlay: { ...value.ratingOverlay },
    folderOverlay: { ...value.folderOverlay },
    toasts: [...value.toasts],
  };
}

function readAccessToken() {
  try {
    return localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) ?? "";
  } catch (error) {
    console.warn(error);
    return "";
  }
}

function getApiV1BaseUrl() {
  return `${window.MovieTrackerUI.resolveApiBaseUrl()}/api/v1`;
}

function getWatchItemsEndpoint() {
  return `${getApiV1BaseUrl()}/library/watch-items`;
}

function getFoldersEndpoint() {
  return `${getApiV1BaseUrl()}/library/folders`;
}

async function requestJson(url, options = {}) {
  const configurationError = window.MovieTrackerUI.getApiConfigurationError();
  if (configurationError) {
    throw new Error(configurationError);
  }

  const token = readAccessToken();
  if (!token) {
    throw new Error("Чтобы открыть карточку, сначала войдите в аккаунт.");
  }

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      data?.detail?.message ??
      data?.detail ??
      data?.message ??
      "Не удалось загрузить данные.";
    throw new Error(message);
  }

  return data;
}

function getMovieIdFromUrl() {
  return new URLSearchParams(window.location.search).get("id");
}

function normalizeFolder(folder) {
  return {
    id: String(folder.id),
    title: folder.title,
    description: folder.description ?? "",
    access: folder.access ?? "private",
    isSystem: Boolean(folder.isSystem),
  };
}

function normalizeMovie(movie) {
  const typeLabel = movie.type === "series" ? "Сериал" : "Фильм";
  const year = movie.year ?? "—";
  const duration = movie.duration ?? "—";

  return {
    id: String(movie.id),
    title: movie.title,
    genres: Array.isArray(movie.genres) ? movie.genres : [],
    year: String(year),
    duration,
    type: typeLabel,
    imdbRating: movie.imdbRating ?? "—",
    userRating: Number(movie.userRating ?? 0),
    progress: Number(movie.progress ?? 0),
    progressSeconds: movie.progressSeconds ?? null,
    durationSeconds: movie.durationSeconds ?? null,
    folderId: movie.folderId === null || movie.folderId === undefined ? null : String(movie.folderId),
    watched: Boolean(movie.watched),
    comment: movie.comment ?? "",
    description: movie.description ?? "Описание пока не добавлено.",
    status: movie.status,
    season: movie.season ?? null,
    episode: movie.episode ?? null,
  };
}

function setState(updater, options = {}) {
  state = typeof updater === "function" ? updater(state) : updater;
  renderApp();

  if (options.autosizeTextarea) {
    requestAnimationFrame(autoSizeActiveTextarea);
  }
}

function showToast(message, type = "success") {
  const id = `toast-${++toastId}`;

  setState((currentState) => ({
    ...currentState,
    toasts: [...currentState.toasts, { id, message, type }],
  }));

  window.setTimeout(() => {
    setState((currentState) => ({
      ...currentState,
      toasts: currentState.toasts.filter((toast) => toast.id !== id),
    }));
  }, 3200);
}

function renderLoadingState(title, text) {
  return `
    <section class="movie-detail" aria-label="Состояние карточки">
      <article class="movie-detail__card">
        <section class="movie-detail__comments" aria-label="Статус загрузки">
          <h1 class="movie-detail__title">${title}</h1>
          <p class="movie-detail__description">${text}</p>
        </section>
      </article>
    </section>
  `;
}

function renderCommentSection(movie) {
  if (!movie.comment) {
    return `
      <section class="movie-detail__comments" aria-label="Комментарии">
        <h2 class="movie-detail__comments-title">Комментарии</h2>
        <p class="movie-detail__comments-empty">Комментариев пока нет</p>
      </section>
    `;
  }

  return `
    <section class="movie-detail__comments" aria-label="Комментарии">
      <h2 class="movie-detail__comments-title">Комментарии</h2>
      <p class="movie-detail__description">${movie.comment}</p>
    </section>
  `;
}

function renderMovieDetail(movie) {
  const folderButtonLabel = movie.folderId ? "В папке" : "Добавить в папку";
  const watchedButtonLabel = movie.watched ? "Просмотрено" : "Отметить просмотренным";
  const ratingLabel = movie.userRating ? `Ваша оценка: ${movie.userRating}` : "Оценить";

  return `
    <section class="movie-detail" aria-label="Карточка фильма">
      <a class="movie-detail__back" href="./watch_history_light_v3.html">
        <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M11 4L6 9L11 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
        История просмотра
      </a>

      <article class="movie-detail__card">
        <div class="movie-detail__poster-wrap">
          <div class="movie-detail__poster" aria-label="Постер фильма">
            <div class="movie-detail__poster-mark" aria-hidden="true"></div>
            <div class="movie-detail__progress">
              <div class="movie-detail__progress-text">
                <span>Прогресс</span>
                <strong>${movie.watched ? "100%" : `${movie.progress}%`}</strong>
              </div>
              <div class="movie-detail__progress-track">
                <div class="movie-detail__progress-fill" style="width: ${movie.watched ? 100 : movie.progress}%"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="movie-detail__main">
          <h1 class="movie-detail__title">${movie.title}</h1>
          <div class="movie-detail__genres">
            ${movie.genres.map((genre) => `<span class="movie-detail__chip">${genre}</span>`).join("")}
          </div>

          <ul class="movie-detail__facts" aria-label="Информация о фильме">
            <li class="movie-detail__fact">${movie.type}</li>
            <li class="movie-detail__fact">${movie.year}</li>
            <li class="movie-detail__fact">${movie.duration}</li>
          </ul>

          <p class="movie-detail__description">${movie.description}</p>

          <div class="movie-detail__actions">
            <button class="movie-detail__continue" type="button" data-action="continue">
              <svg width="16" height="16" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
                <path d="M5.5 3.8V14.2L14 9L5.5 3.8Z"></path>
              </svg>
              Продолжить просмотр
            </button>
            <div class="movie-detail__quick-actions">
              <button class="movie-detail__icon-button ${movie.folderId ? "movie-detail__icon-button--active" : ""}" type="button" data-action="add-to-folder" aria-label="${folderButtonLabel}" title="${folderButtonLabel}">
                <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path d="M2.8 5.2H7L8.35 6.7H15.2V13.7C15.2 14.42 14.62 15 13.9 15H4.1C3.38 15 2.8 14.42 2.8 13.7V5.2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"></path>
                  <path d="M2.8 5.2V4.1C2.8 3.38 3.38 2.8 4.1 2.8H6.4L7.9 4.4H13.4C14.12 4.4 14.7 4.98 14.7 5.7V6.7" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"></path>
                </svg>
              </button>
              <button class="movie-detail__icon-button ${movie.watched ? "movie-detail__icon-button--active movie-detail__icon-button--success" : ""}" type="button" data-action="mark-watched" aria-label="${watchedButtonLabel}" title="${watchedButtonLabel}">
                <svg width="20" height="20" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path d="M4 9.5L7.2 12.7L14 5.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>

        <aside class="movie-detail__aside" aria-label="Оценка">
          <section class="movie-detail__rating-card">
            <div class="movie-detail__rating-top">
              <span class="movie-detail__rating-label">Рейтинг</span>
            </div>
            <div class="movie-detail__rating-value">
              <span class="movie-detail__rating-number">${movie.imdbRating}</span>
              <span class="movie-detail__imdb">imdb</span>
            </div>
            <button class="movie-detail__rate" type="button" data-action="rate">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M9 2.3L10.93 6.21L15.25 6.84L12.13 9.88L12.87 14.18L9 12.14L5.13 14.18L5.87 9.88L2.75 6.84L7.07 6.21L9 2.3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"></path>
              </svg>
              ${ratingLabel}
            </button>
          </section>
        </aside>

        ${renderCommentSection(movie)}
      </article>
    </section>
  `;
}

function renderRatingOverlay(overlay) {
  if (!overlay.isOpen) return "";

  const stars = Array.from({ length: 10 }, (_, index) => {
    const value = index + 1;
    const isActive = value <= overlay.value;

    return `
      <button
        class="rating-picker__star ${isActive ? "rating-picker__star--active" : ""}"
        type="button"
        data-rating-value="${value}"
        aria-label="Оценка ${value}"
      >
        <svg width="28" height="28" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
          <path d="M9 2.3L10.93 6.21L15.25 6.84L12.13 9.88L12.87 14.18L9 12.14L5.13 14.18L5.87 9.88L2.75 6.84L7.07 6.21L9 2.3Z"></path>
        </svg>
      </button>
    `;
  }).join("");

  const numbers = Array.from({ length: 10 }, (_, index) => {
    const value = index + 1;
    return `<span class="rating-picker__number ${value <= overlay.value ? "rating-picker__number--active" : ""}">${value}</span>`;
  }).join("");

  return renderModalShell(
    "Оценить",
    `
      <div class="rating-picker">
        <div class="rating-picker__stars">${stars}</div>
        <div class="rating-picker__numbers">${numbers}</div>
      </div>
      <textarea
        class="modal-card__textarea"
        data-rating-comment
        placeholder="Добавьте комментарий (необязательно)"
        maxlength="800"
      >${overlay.comment}</textarea>
    `,
    `
      <div class="modal-card__footer">
        <button class="modal-card__confirm" type="button" data-rating-confirm ${overlay.loading ? "disabled" : ""}>
          ${overlay.loading ? "Сохраняем..." : "Подтвердить"}
        </button>
      </div>
    `,
    "rating",
  );
}

function renderFolderOverlay(overlay) {
  if (!overlay.isOpen) return "";

  const hasFolders = state.customFolders.length > 0;
  const folders = state.customFolders
    .map(
      (folder) => `
        <button
          class="folder-option ${folder.id === overlay.selectedFolderId ? "folder-option--active" : ""}"
          type="button"
          data-folder-id="${folder.id}"
        >
          <span class="folder-option__icon" aria-hidden="true"></span>
          <span>
            <strong>${folder.title}</strong>
            <small>${folder.description || "Пользовательская папка"}</small>
          </span>
        </button>
      `,
    )
    .join("");

  return renderModalShell(
    "Добавить в папку",
    `
      <div class="folder-placeholder">
        <p class="folder-placeholder__hint">
          ${
            hasFolders
              ? "Выберите пользовательскую папку. Системные папки распределяются автоматически по статусу."
              : "Пользовательских папок пока нет. На странице папок уже доступны системные разделы без удаления."
          }
        </p>
        <div class="folder-options">
          ${folders}
        </div>
      </div>
    `,
    `
      <div class="modal-card__footer">
        <button class="modal-card__confirm" type="button" data-folder-confirm ${overlay.loading || !hasFolders ? "disabled" : ""}>
          ${overlay.loading ? "Сохраняем..." : "Подтвердить"}
        </button>
      </div>
    `,
    "folder",
  );
}

function renderOverlays() {
  return `${renderRatingOverlay(state.ratingOverlay)}${renderFolderOverlay(state.folderOverlay)}`;
}

function renderPage() {
  let content = renderLoadingState("Загружаем карточку", "Подтягиваем данные о фильме или сериале.");

  if (!state.loading && state.loadError) {
    content = renderLoadingState("Не удалось загрузить карточку", state.loadError);
  } else if (!state.loading && state.movie) {
    content = renderMovieDetail(state.movie);
  }

  return `
    <div class="history-page movie-detail-page">
      <div class="history-page__shell">
        <header class="history-page__navbar">
          <div class="history-page__logo" aria-hidden="true"></div>
          <nav class="history-page__tabs" aria-label="Навигация по разделам">
            ${renderTabs(state.tabs)}
          </nav>
          <button class="history-page__avatar" type="button" data-nav-url="./profile.html" aria-label="Открыть профиль">
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="7" r="4" fill="rgba(255,255,255,0.92)"></circle>
              <path d="M2 18c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(255,255,255,0.92)" stroke-width="1.5" stroke-linecap="round"></path>
            </svg>
          </button>
        </header>

        <div class="history-page__content">
          ${content}
        </div>
      </div>
      ${renderToasts(state.toasts)}
      ${renderOverlays()}
    </div>
  `;
}

function renderApp() {
  if (!rootElement) return;
  rootElement.innerHTML = renderPage();
}

async function loadMoviePage() {
  const movieId = getMovieIdFromUrl();
  if (!movieId) {
    setState((currentState) => ({
      ...currentState,
      loading: false,
      loadError: "Не передан идентификатор фильма или сериала.",
    }));
    return;
  }

  setState((currentState) => ({
    ...currentState,
    loading: true,
    loadError: "",
  }));

  try {
    const [movieResponse, foldersResponse] = await Promise.all([
      movieDetailApi.fetchMovie(movieId),
      movieDetailApi.fetchFolders(),
    ]);

    setState((currentState) => ({
      ...currentState,
      loading: false,
      loadError: "",
      movie: normalizeMovie(movieResponse),
      customFolders: (foldersResponse.items ?? [])
        .map(normalizeFolder)
        .filter((folder) => !folder.isSystem),
    }));
  } catch (error) {
    console.error(error);
    setState((currentState) => ({
      ...currentState,
      loading: false,
      loadError: error.message || "Не удалось загрузить карточку.",
      movie: null,
      customFolders: [],
    }));
  }
}

function openRatingOverlay() {
  if (!state.movie) return;

  setState((currentState) => ({
    ...currentState,
    ratingOverlay: {
      isOpen: true,
      value: currentState.movie.userRating || 0,
      comment: currentState.movie.comment || "",
      loading: false,
    },
  }), { autosizeTextarea: true });
}

function closeRatingOverlay() {
  if (state.ratingOverlay.loading) return;

  setState((currentState) => ({
    ...currentState,
    ratingOverlay: { ...initialState.ratingOverlay },
  }));
}

async function confirmRating() {
  const { value, comment } = state.ratingOverlay;
  if (!state.movie || !value || state.ratingOverlay.loading) return;

  const previousMovie = { ...state.movie, genres: [...state.movie.genres] };

  setState((currentState) => ({
    ...currentState,
    movie: {
      ...currentState.movie,
      userRating: value,
      comment,
    },
    ratingOverlay: { ...currentState.ratingOverlay, loading: true },
  }));

  try {
    const updatedMovie = await movieDetailApi.updateMovie(state.movie.id, {
      rating: value,
      comment,
    });

    setState((currentState) => ({
      ...currentState,
      movie: normalizeMovie(updatedMovie),
      ratingOverlay: { ...initialState.ratingOverlay },
    }));
    showToast("Оценка сохранена", "success");
  } catch (error) {
    console.error(error);
    setState((currentState) => ({
      ...currentState,
      movie: previousMovie,
      ratingOverlay: { ...currentState.ratingOverlay, loading: false },
    }));
    showToast(error.message || "Не удалось обновить данные", "error");
  }
}

function openFolderOverlay() {
  if (!state.movie) return;

  setState((currentState) => ({
    ...currentState,
    folderOverlay: {
      isOpen: true,
      selectedFolderId: currentState.movie.folderId || currentState.customFolders[0]?.id || null,
      loading: false,
    },
  }));
}

function closeFolderOverlay() {
  if (state.folderOverlay.loading) return;

  setState((currentState) => ({
    ...currentState,
    folderOverlay: { ...initialState.folderOverlay },
  }));
}

async function confirmFolder() {
  if (!state.movie || !state.folderOverlay.selectedFolderId || state.folderOverlay.loading) return;

  const previousMovie = { ...state.movie, genres: [...state.movie.genres] };
  const { selectedFolderId } = state.folderOverlay;

  setState((currentState) => ({
    ...currentState,
    movie: {
      ...currentState.movie,
      folderId: selectedFolderId,
    },
    folderOverlay: { ...currentState.folderOverlay, loading: true },
  }));

  try {
    const updatedMovie = await movieDetailApi.updateMovie(state.movie.id, {
      folderId: Number(selectedFolderId),
    });

    setState((currentState) => ({
      ...currentState,
      movie: normalizeMovie(updatedMovie),
      folderOverlay: { ...initialState.folderOverlay },
    }));
    showToast("Добавлено в папку", "success");
  } catch (error) {
    console.error(error);
    setState((currentState) => ({
      ...currentState,
      movie: previousMovie,
      folderOverlay: { ...currentState.folderOverlay, loading: false },
    }));
    showToast(error.message || "Не удалось обновить данные", "error");
  }
}

async function markWatched() {
  if (!state.movie) return;

  const previousMovie = { ...state.movie, genres: [...state.movie.genres] };

  setState((currentState) => ({
    ...currentState,
    movie: {
      ...currentState.movie,
      watched: true,
      progress: 100,
      status: "completed",
    },
  }));
  showToast("Отмечено как просмотренное", "success");

  try {
    const updatedMovie = await movieDetailApi.updateMovie(state.movie.id, {
      status: "completed",
    });

    setState((currentState) => ({
      ...currentState,
      movie: normalizeMovie(updatedMovie),
    }));
  } catch (error) {
    console.error(error);
    setState((currentState) => ({
      ...currentState,
      movie: previousMovie,
    }));
    showToast(error.message || "Не удалось обновить данные", "error");
  }
}

function autoSizeActiveTextarea() {
  const textarea = rootElement?.querySelector("[data-rating-comment]");
  if (textarea) autoSizeTextarea(textarea);
}

function updateRatingPickerDom(value) {
  rootElement?.querySelectorAll("[data-rating-value]").forEach((button) => {
    const ratingValue = Number(button.dataset.ratingValue);
    button.classList.toggle("rating-picker__star--active", ratingValue <= value);
  });

  rootElement?.querySelectorAll(".rating-picker__number").forEach((numberElement) => {
    const ratingValue = Number(numberElement.textContent);
    numberElement.classList.toggle("rating-picker__number--active", ratingValue <= value);
  });
}

function handleRootClick(event) {
  const navButton = event.target.closest("[data-nav-url]");
  if (navButton) {
    navigateToPage(navButton.dataset.navUrl);
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    const action = actionButton.dataset.action;

    if (action === "continue") {
      showToast("Прогресс просмотра уже сохраняется на сервере", "success");
      return;
    }

    if (action === "rate") {
      openRatingOverlay();
      return;
    }

    if (action === "add-to-folder") {
      openFolderOverlay();
      return;
    }

    if (action === "mark-watched") {
      markWatched();
      return;
    }
  }

  const ratingValueButton = event.target.closest("[data-rating-value]");
  if (ratingValueButton) {
    const value = Number(ratingValueButton.dataset.ratingValue);
    state.ratingOverlay.value = value;
    updateRatingPickerDom(value);
    return;
  }

  const folderButton = event.target.closest("[data-folder-id]");
  if (folderButton) {
    setState((currentState) => ({
      ...currentState,
      folderOverlay: { ...currentState.folderOverlay, selectedFolderId: folderButton.dataset.folderId },
    }));
    return;
  }

  if (event.target.closest("[data-rating-confirm]")) {
    confirmRating();
    return;
  }

  if (event.target.closest("[data-folder-confirm]")) {
    confirmFolder();
    return;
  }

  if (event.target.closest('[data-modal-close="rating"]')) {
    closeRatingOverlay();
    return;
  }

  if (event.target.closest('[data-modal-close="folder"]')) {
    closeFolderOverlay();
    return;
  }

  if (event.target.dataset.modalBackdrop === "rating") {
    closeRatingOverlay();
    return;
  }

  if (event.target.dataset.modalBackdrop === "folder") {
    closeFolderOverlay();
  }
}

function handleRootInput(event) {
  const textarea = event.target.closest("[data-rating-comment]");
  if (!textarea) return;

  autoSizeTextarea(textarea);
  state.ratingOverlay.comment = textarea.value;
}

function initMovieDetailPage() {
  rootElement = document.querySelector("#movie-detail-app");
  if (!rootElement) return;

  rootElement.addEventListener("click", handleRootClick);
  rootElement.addEventListener("input", handleRootInput);
  renderApp();
  loadMoviePage();
}

initMovieDetailPage();
})();
