(() => {
const {
  autoSizeTextarea,
  navigateToPage,
  renderModalShell,
  renderTabs,
  renderToasts,
} = window.MovieTrackerUI;

const API_BASE_URL = "http://127.0.0.1:8000";
const API_V1_BASE_URL = `${API_BASE_URL}/api/v1`;
const WATCH_ITEMS_ENDPOINT = `${API_V1_BASE_URL}/library/watch-items`;
const FOLDERS_ENDPOINT = `${API_V1_BASE_URL}/library/folders`;
const ACCESS_TOKEN_STORAGE_KEY = "movieTracker.accessToken";
const MOVIE_DETAIL_PAGE_URL = "./movie-detail.html";

const manualStatuses = [
  { value: "planned", label: "Планирую смотреть" },
  { value: "watching", label: "Смотрю" },
  { value: "completed", label: "Просмотрено" },
];

const defaultManualForm = {
  type: "movie",
  title: "",
  status: "planned",
  season: "",
  episode: "",
  rating: "",
  comment: "",
};

const cardActions = {
  rate: {
    label: "Оценить",
    action: "rate",
    icon: `
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M9 2.3L10.93 6.21L15.25 6.84L12.13 9.88L12.87 14.18L9 12.14L5.13 14.18L5.87 9.88L2.75 6.84L7.07 6.21L9 2.3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"></path>
      </svg>
    `,
  },
  "add-to-folder": {
    label: "Добавить в папку",
    action: "add-to-folder",
    icon: `
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M9 3V15M3 9H15" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
      </svg>
    `,
  },
  "mark-watched": {
    label: "Отметить как просмотренное",
    action: "mark-watched",
    icon: `
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path d="M4 9.5L7.2 12.7L14 5.9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
    `,
  },
};

const initialState = {
  tabs: [
    { label: "История просмотра", active: true, static: true },
    { label: "Папки", active: false, url: "./folders.html" },
  ],
  filters: [
    { label: "Все", value: "all", active: true },
    { label: "Фильмы", value: "movie", active: false },
    { label: "Сериалы", value: "series", active: false },
  ],
  query: "",
  loading: true,
  loadError: "",
  items: [],
  customFolders: [],
  ratingOverlay: {
    isOpen: false,
    itemId: null,
    value: 0,
    comment: "",
    loading: false,
  },
  folderOverlay: {
    isOpen: false,
    itemId: null,
    selectedFolderId: null,
    loading: false,
  },
  manualOverlay: {
    isOpen: false,
    form: { ...defaultManualForm },
    errors: {},
    loading: false,
  },
  toasts: [],
  pendingActions: new Set(),
};

const watchHistoryApi = {
  async fetchWatchItems() {
    return requestJson(WATCH_ITEMS_ENDPOINT);
  },
  async fetchFolders() {
    return requestJson(FOLDERS_ENDPOINT);
  },
  async updateWatchItem(id, patch) {
    return requestJson(`${WATCH_ITEMS_ENDPOINT}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: patch,
    });
  },
  async createWatchItem(payload) {
    return requestJson(WATCH_ITEMS_ENDPOINT, {
      method: "POST",
      body: payload,
    });
  },
};

let state = structuredCloneWithSet(initialState);
let toastId = 0;
let rootElement = null;

function structuredCloneWithSet(value) {
  return {
    ...value,
    items: value.items.map((item) => ({ ...item })),
    customFolders: value.customFolders.map((folder) => ({ ...folder })),
    tabs: value.tabs.map((tab) => ({ ...tab })),
    filters: value.filters.map((filter) => ({ ...filter })),
    ratingOverlay: { ...value.ratingOverlay },
    folderOverlay: { ...value.folderOverlay },
    manualOverlay: {
      ...value.manualOverlay,
      form: { ...value.manualOverlay.form },
      errors: { ...value.manualOverlay.errors },
    },
    toasts: [...value.toasts],
    pendingActions: new Set(value.pendingActions ?? []),
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

async function requestJson(url, options = {}) {
  const token = readAccessToken();
  if (!token) {
    throw new Error("Чтобы открыть эту страницу, сначала войдите в аккаунт.");
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

function normalizeFolder(folder) {
  return {
    id: String(folder.id),
    title: folder.title,
    description: folder.description ?? "",
    access: folder.access ?? "private",
    isSystem: Boolean(folder.isSystem),
    canDelete: Boolean(folder.canDelete),
    itemsCount: Number(folder.itemsCount ?? 0),
  };
}

function normalizeHistoryItem(item) {
  return {
    id: String(item.id),
    type: item.type,
    title: item.title,
    status: item.status,
    progress: Number(item.progress ?? 0),
    rating: Number(item.rating ?? 0),
    comment: item.comment ?? "",
    folderId: item.folderId === null || item.folderId === undefined ? null : String(item.folderId),
    systemFolderId: String(item.systemFolderId),
    badge: item.badge ?? "",
    meta: item.meta ?? "",
    updatedAt: item.updatedAt ?? new Date().toISOString(),
    watchedAt: item.watchedAt ?? null,
  };
}

function setState(updater, options = {}) {
  state = typeof updater === "function" ? updater(state) : updater;
  renderApp();

  if (options.autosizeTextarea) {
    requestAnimationFrame(autoSizeActiveTextarea);
  }
}

function getItemById(id) {
  return state.items.find((item) => item.id === String(id));
}

function getMovieDetailUrl(id) {
  return `${MOVIE_DETAIL_PAGE_URL}?id=${encodeURIComponent(id)}`;
}

function openMovieDetail(id) {
  navigateToPage(getMovieDetailUrl(id));
}

function updateItemInState(id, patch) {
  return {
    ...state,
    items: state.items.map((item) => (item.id === String(id) ? { ...item, ...patch } : item)),
  };
}

function addPendingAction(key) {
  state.pendingActions.add(key);
}

function removePendingAction(key) {
  state.pendingActions.delete(key);
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

function getVisibleItems() {
  const query = state.query.trim().toLowerCase();
  const activeFilter = state.filters.find((filter) => filter.active)?.value ?? "all";

  return state.items.filter((item) => {
    const matchesFilter = activeFilter === "all" || item.type === activeFilter;
    const matchesQuery =
      !query ||
      item.title.toLowerCase().includes(query) ||
      item.meta.toLowerCase().includes(query);

    return matchesFilter && matchesQuery;
  });
}

function getSections(items) {
  const watchingItems = items.filter((item) => item.status === "watching");
  const plannedItems = items.filter((item) => item.status === "planned");
  const completedItems = items
    .filter((item) => item.status === "completed")
    .sort((a, b) => new Date(b.watchedAt ?? b.updatedAt) - new Date(a.watchedAt ?? a.updatedAt));

  return [
    { title: "Продолжить просмотр", items: watchingItems },
    { title: "Буду смотреть", items: plannedItems },
    { title: "Недавно просмотрено", items: completedItems },
  ];
}

function getHistoryStats(items) {
  const watchingCount = items.filter((item) => item.status === "watching").length;
  const completedCount = items.filter((item) => item.status === "completed").length;
  return { watchingCount, completedCount };
}

function getActionsForItem(item) {
  if (item.status === "completed") {
    return ["rate", "add-to-folder"];
  }

  return ["rate", "add-to-folder", "mark-watched"];
}

function renderFilters(filters) {
  return filters
    .map(
      (filter) => `
        <button
          class="history-toolbar__filter ${filter.active ? "history-toolbar__filter--active" : ""}"
          type="button"
          data-filter="${filter.value}"
        >
          ${filter.label}
        </button>
      `,
    )
    .join("");
}

function renderRating(value) {
  return `
    <span class="watch-card__rating">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
        <polygon points="7,1 8.8,5 13,5.5 10,8.4 10.9,12.5 7,10.5 3.1,12.5 4,8.4 1,5.5 5.2,5"></polygon>
      </svg>
      ${value || "—"}
    </span>
  `;
}

function renderCardActions(item) {
  return getActionsForItem(item)
    .map((actionKey) => {
      const action = cardActions[actionKey];
      if (!action) return "";

      const pendingKey = `${item.id}:${action.action}`;
      const isLoading = state.pendingActions.has(pendingKey);

      return `
        <div class="watch-card__action">
          <span class="watch-card__tooltip">${action.label}</span>
          <button
            class="watch-card__icon-button ${isLoading ? "watch-card__icon-button--loading" : ""}"
            type="button"
            data-action="${action.action}"
            data-id="${item.id}"
            aria-label="${action.label}"
            ${isLoading ? "disabled" : ""}
          >
            ${action.icon}
          </button>
        </div>
      `;
    })
    .join("");
}

function renderCard(item) {
  const shouldShowBadge = item.status !== "completed" && item.badge;
  const shouldShowContinue = item.status !== "completed";

  return `
    <article
      class="watch-card"
      data-card-id="${item.id}"
      data-detail-url="${getMovieDetailUrl(item.id)}"
      role="link"
      tabindex="0"
      aria-label="Открыть страницу: ${item.title}"
    >
      <div class="watch-card__media">
        ${shouldShowBadge ? `<span class="watch-card__badge">${item.badge}</span>` : ""}
        <div class="watch-card__actions">
          ${renderCardActions(item)}
        </div>
        <div class="watch-card__poster" aria-hidden="true"></div>
        <div class="watch-card__progress">
          <div class="watch-card__progress-fill" style="width: ${item.progress}%"></div>
        </div>
      </div>
      <div class="watch-card__body">
        <h3 class="watch-card__title">${item.title}</h3>
        <p class="watch-card__meta">${item.meta}</p>
        <div class="watch-card__footer">
          ${renderRating(item.rating)}
          ${
            shouldShowContinue
              ? `<button class="watch-card__continue" type="button" data-action="open-detail" data-id="${item.id}">▶ Продолжить просмотр</button>`
              : ``
          }
        </div>
      </div>
    </article>
  `;
}

function renderSections(sections) {
  const hasItems = sections.some((section) => section.items.length > 0);
  if (!hasItems) return renderEmptyHistoryState();

  return sections
    .filter((section) => section.items.length > 0)
    .map(
      (section) => `
        <section class="history-section">
          <h2 class="history-section__label">${section.title}</h2>
          <div class="history-grid">
            ${section.items.map(renderCard).join("")}
          </div>
        </section>
      `,
    )
    .join("");
}

function renderStatusState(title, text) {
  return `
    <section class="history-empty" aria-live="polite">
      <div class="history-empty__icon" aria-hidden="true"></div>
      <h2 class="history-empty__title">${title}</h2>
      <p class="history-empty__text">${text}</p>
    </section>
  `;
}

function renderEmptyHistoryState() {
  if (state.loading) {
    return renderStatusState("Загружаем историю", "Подтягиваем фильмы, сериалы и прогресс просмотра.");
  }

  if (state.loadError) {
    return renderStatusState("Не удалось загрузить историю", state.loadError);
  }

  return `
    <section class="history-empty" aria-live="polite">
      <div class="history-empty__icon" aria-hidden="true"></div>
      <h2 class="history-empty__title">Тут пока ничего нет</h2>
      <p class="history-empty__text">
        Добавьте вручную или начните смотреть что-нибудь с подключенным расширением.
      </p>
      <div class="extension-help">
        <button class="extension-help__label" type="button" aria-describedby="extension-help-tooltip">
          Подключенное расширение
        </button>
        <div class="extension-help__tooltip" id="extension-help-tooltip" role="tooltip">
          Расширение автоматически добавляет просмотр в историю.
          <a href="./profile.html#extension" data-nav-url="./profile.html#extension">Открыть инструкцию</a>
        </div>
      </div>
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
              ? "Выберите пользовательскую папку. Системные папки распределяются автоматически по статусу просмотра."
              : "Пользовательских папок пока нет. На этой странице можно только просмотреть системные папки."
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

function renderFieldError(errors, fieldName) {
  return errors[fieldName] ? `<span class="manual-form__error">${errors[fieldName]}</span>` : "";
}

function renderManualRatingPicker(value) {
  const rating = Number(value) || 0;
  const stars = Array.from({ length: 10 }, (_, index) => {
    const starValue = index + 1;
    const isActive = starValue <= rating;

    return `
      <button
        class="rating-picker__star ${isActive ? "rating-picker__star--active" : ""}"
        type="button"
        data-manual-rating-value="${starValue}"
        aria-label="Оценка ${starValue}"
      >
        <svg width="28" height="28" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">
          <path d="M9 2.3L10.93 6.21L15.25 6.84L12.13 9.88L12.87 14.18L9 12.14L5.13 14.18L5.87 9.88L2.75 6.84L7.07 6.21L9 2.3Z"></path>
        </svg>
      </button>
    `;
  }).join("");

  const numbers = Array.from({ length: 10 }, (_, index) => {
    const numberValue = index + 1;
    return `<span class="rating-picker__number ${numberValue <= rating ? "rating-picker__number--active" : ""}">${numberValue}</span>`;
  }).join("");

  return `
    <div class="rating-picker manual-rating">
      <div class="rating-picker__stars">${stars}</div>
      <div class="rating-picker__numbers">${numbers}</div>
    </div>
  `;
}

function renderManualExtraFields(form, errors) {
  if (form.type === "series" && form.status === "watching") {
    return `
      <div class="manual-form__grid manual-form__grid--compact">
        <label class="manual-form__field">
          <span class="manual-form__label">Сезон</span>
          <input class="manual-form__input" type="number" min="0" inputmode="numeric" value="${form.season}" data-manual-field="season" />
          ${renderFieldError(errors, "season")}
        </label>
        <label class="manual-form__field">
          <span class="manual-form__label">Серия</span>
          <input class="manual-form__input" type="number" min="0" inputmode="numeric" value="${form.episode}" data-manual-field="episode" />
          ${renderFieldError(errors, "episode")}
        </label>
      </div>
    `;
  }

  if (form.status === "completed") {
    return `
      <section class="manual-form__section" aria-label="Оценка">
        <span class="manual-form__label">Оценка <span aria-hidden="true">*</span></span>
        ${renderManualRatingPicker(form.rating)}
        ${renderFieldError(errors, "rating")}
      </section>
      <label class="manual-form__field">
        <span class="manual-form__label">Комментарий</span>
        <textarea class="modal-card__textarea" maxlength="800" data-manual-field="comment" placeholder="Добавьте комментарий (необязательно)">${form.comment}</textarea>
        ${renderFieldError(errors, "comment")}
      </label>
    `;
  }

  return "";
}

function renderManualOverlay(overlay) {
  if (!overlay.isOpen) return "";

  const types = [
    { value: "movie", label: "Фильм" },
    { value: "series", label: "Сериал" },
  ];

  const statuses = manualStatuses
    .map(
      (statusItem) => `
        <button
          class="manual-form__chip ${overlay.form.status === statusItem.value ? "manual-form__chip--active" : ""}"
          type="button"
          data-manual-status="${statusItem.value}"
        >
          ${statusItem.label}
        </button>
      `,
    )
    .join("");

  return renderModalShell(
    "Добавить вручную",
    `
      <form class="manual-form" data-manual-form novalidate>
        <section class="manual-form__section" aria-label="Тип контента">
          <span class="manual-form__label">Тип</span>
          <div class="manual-form__switch">
            ${types
              .map(
                (type) => `
                  <button
                    class="manual-form__switch-button ${overlay.form.type === type.value ? "manual-form__switch-button--active" : ""}"
                    type="button"
                    data-manual-type="${type.value}"
                  >
                    ${type.label}
                  </button>
                `,
              )
              .join("")}
          </div>
          ${renderFieldError(overlay.errors, "type")}
        </section>

        <label class="manual-form__field">
          <span class="manual-form__label">Название <span aria-hidden="true">*</span></span>
          <input class="manual-form__input" type="text" value="${overlay.form.title}" placeholder="Введите название" data-manual-field="title" />
          ${renderFieldError(overlay.errors, "title")}
        </label>

        <section class="manual-form__section" aria-label="Статус">
          <span class="manual-form__label">Статус <span aria-hidden="true">*</span></span>
          <div class="manual-form__chips">
            ${statuses}
          </div>
          ${renderFieldError(overlay.errors, "status")}
        </section>

        <div class="manual-form__extra" data-manual-extra>
          ${renderManualExtraFields(overlay.form, overlay.errors)}
        </div>
      </form>
    `,
    `
      <div class="modal-card__footer modal-card__footer--split">
        <button class="modal-card__cancel" type="button" data-manual-cancel>Отмена</button>
        <button class="modal-card__confirm" type="button" data-manual-confirm ${overlay.loading ? "disabled" : ""}>
          ${overlay.loading ? "Добавляем..." : "Добавить"}
        </button>
      </div>
    `,
    "manual",
  );
}

function renderOverlays() {
  return `${renderRatingOverlay(state.ratingOverlay)}${renderFolderOverlay(state.folderOverlay)}${renderManualOverlay(state.manualOverlay)}`;
}

function renderPage() {
  const visibleItems = getVisibleItems();
  const stats = getHistoryStats(state.items);

  return `
    <div class="history-page">
      <h1 class="sr-only">Страница истории просмотра Movie Tracker</h1>
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
          <section class="history-heading" aria-label="Обзор истории просмотра">
            <div>
              <h2 class="history-heading__title">История просмотра</h2>
              <p class="history-heading__text">Отслеживайте прогресс фильмов и сериалов, возвращайтесь к незавершенному просмотру и быстро переносите завершенные позиции в просмотренное.</p>
            </div>
            <div class="history-heading__stats" aria-label="Статистика истории просмотра">
              <span class="history-heading__stat"><strong>${stats.watchingCount}</strong> в процессе</span>
              <span class="history-heading__stat"><strong>${stats.completedCount}</strong> просмотрено</span>
            </div>
          </section>

          <section class="history-toolbar" aria-label="Поиск и фильтры">
            <div class="history-toolbar__search">
              <input class="history-toolbar__input" type="text" placeholder="Поиск по названию" value="${state.query}" data-history-search />
              <span class="history-toolbar__icon" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.5"></circle>
                  <path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
                </svg>
              </span>
            </div>
            <button class="history-toolbar__add" type="button" data-action="open-manual">+ Добавить вручную</button>
            <div class="history-toolbar__filters">
              ${renderFilters(state.filters)}
            </div>
          </section>

          ${renderSections(getSections(visibleItems))}

          <footer class="history-footer">
            <div class="history-footer__links">
              <a href="#">О проекте</a>
              <a href="#">Контакты</a>
            </div>
            <div class="history-footer__year">2026</div>
          </footer>
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

async function loadPageData() {
  setState((currentState) => ({
    ...currentState,
    loading: true,
    loadError: "",
  }));

  try {
    const [watchItemsResponse, foldersResponse] = await Promise.all([
      watchHistoryApi.fetchWatchItems(),
      watchHistoryApi.fetchFolders(),
    ]);

    setState((currentState) => ({
      ...currentState,
      loading: false,
      loadError: "",
      items: (watchItemsResponse.items ?? []).map(normalizeHistoryItem),
      customFolders: (foldersResponse.items ?? [])
        .map(normalizeFolder)
        .filter((folder) => !folder.isSystem),
    }));
  } catch (error) {
    console.error(error);
    setState((currentState) => ({
      ...currentState,
      loading: false,
      loadError: error.message || "Не удалось загрузить историю просмотра.",
      items: [],
      customFolders: [],
    }));
  }
}

async function markAsCompleted(id) {
  const previousItems = state.items.map((item) => ({ ...item }));
  const currentItem = getItemById(id);
  if (!currentItem) return;

  const now = new Date().toISOString();
  const pendingKey = `${id}:mark-watched`;

  addPendingAction(pendingKey);
  setState(updateItemInState(id, {
    status: "completed",
    progress: 100,
    badge: "",
    watchedAt: now,
    updatedAt: now,
  }));

  showToast("Перемещено в просмотренное", "success");

  try {
    await watchHistoryApi.updateWatchItem(id, {
      status: "completed",
      watchedAt: now,
    });
  } catch (error) {
    console.error(error);
    setState((currentState) => ({
      ...currentState,
      items: previousItems,
    }));
    showToast(error.message || "Не удалось обновить данные", "error");
  } finally {
    removePendingAction(pendingKey);
    renderApp();
  }
}

function openRatingOverlay(id) {
  const item = getItemById(id);
  if (!item) return;

  setState((currentState) => ({
    ...currentState,
    ratingOverlay: {
      isOpen: true,
      itemId: id,
      value: item.rating || 0,
      comment: item.comment || "",
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
  const { itemId, value, comment } = state.ratingOverlay;
  if (!itemId || !value || state.ratingOverlay.loading) return;

  const previousItems = state.items.map((item) => ({ ...item }));
  const now = new Date().toISOString();

  setState((currentState) => ({
    ...currentState,
    items: currentState.items.map((item) =>
      item.id === itemId ? { ...item, rating: value, comment, updatedAt: now } : item,
    ),
    ratingOverlay: { ...currentState.ratingOverlay, loading: true },
  }));

  try {
    await watchHistoryApi.updateWatchItem(itemId, {
      rating: value,
      comment,
    });

    setState((currentState) => ({
      ...currentState,
      ratingOverlay: { ...initialState.ratingOverlay },
    }));
    showToast("Оценка сохранена", "success");
  } catch (error) {
    console.error(error);
    setState((currentState) => ({
      ...currentState,
      items: previousItems,
      ratingOverlay: { ...currentState.ratingOverlay, loading: false },
    }));
    showToast(error.message || "Не удалось обновить данные", "error");
  }
}

function openFolderOverlay(id) {
  const item = getItemById(id);
  if (!item) return;

  const selectedFolderId =
    item.folderId ||
    state.customFolders[0]?.id ||
    null;

  setState((currentState) => ({
    ...currentState,
    folderOverlay: {
      isOpen: true,
      itemId: id,
      selectedFolderId,
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
  const { itemId, selectedFolderId } = state.folderOverlay;
  if (!itemId || !selectedFolderId || state.folderOverlay.loading) return;

  const previousItems = state.items.map((item) => ({ ...item }));
  const now = new Date().toISOString();

  setState((currentState) => ({
    ...currentState,
    items: currentState.items.map((item) =>
      item.id === itemId ? { ...item, folderId: selectedFolderId, updatedAt: now } : item,
    ),
    folderOverlay: { ...currentState.folderOverlay, loading: true },
  }));

  try {
    await watchHistoryApi.updateWatchItem(itemId, {
      folderId: Number(selectedFolderId),
    });

    setState((currentState) => ({
      ...currentState,
      folderOverlay: { ...initialState.folderOverlay },
    }));
    showToast("Добавлено в папку", "success");
  } catch (error) {
    console.error(error);
    setState((currentState) => ({
      ...currentState,
      items: previousItems,
      folderOverlay: { ...currentState.folderOverlay, loading: false },
    }));
    showToast(error.message || "Не удалось обновить данные", "error");
  }
}

function openManualOverlay() {
  setState((currentState) => ({
    ...currentState,
    manualOverlay: {
      isOpen: true,
      form: { ...defaultManualForm },
      errors: {},
      loading: false,
    },
  }));
}

function closeManualOverlay() {
  if (state.manualOverlay.loading) return;

  setState((currentState) => ({
    ...currentState,
    manualOverlay: { ...initialState.manualOverlay, form: { ...defaultManualForm }, errors: {} },
  }));
}

function updateManualFormDom() {
  if (!state.manualOverlay.isOpen) return;

  rootElement?.querySelectorAll("[data-manual-type]").forEach((button) => {
    button.classList.toggle("manual-form__switch-button--active", button.dataset.manualType === state.manualOverlay.form.type);
  });

  rootElement?.querySelectorAll("[data-manual-status]").forEach((button) => {
    button.classList.toggle("manual-form__chip--active", button.dataset.manualStatus === state.manualOverlay.form.status);
  });

  const extraFields = rootElement?.querySelector("[data-manual-extra]");
  if (extraFields) {
    extraFields.innerHTML = renderManualExtraFields(state.manualOverlay.form, state.manualOverlay.errors);
  }

  requestAnimationFrame(autoSizeManualTextarea);
}

function setManualFormPatch(patch, shouldRender = true) {
  const nextForm = { ...state.manualOverlay.form, ...patch };

  if (patch.type) {
    nextForm.season = "";
    nextForm.episode = "";
    nextForm.rating = "";
    nextForm.comment = "";
  }

  if (patch.status) {
    nextForm.season = "";
    nextForm.episode = "";
    nextForm.rating = "";
    nextForm.comment = "";
  }

  state.manualOverlay.form = nextForm;
  state.manualOverlay.errors = {};

  if (shouldRender) updateManualFormDom();
}

function parseOptionalNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  return Number(value);
}

function validateManualForm(form) {
  const errors = {};
  const season = parseOptionalNumber(form.season);
  const episode = parseOptionalNumber(form.episode);
  const rating = parseOptionalNumber(form.rating);

  if (!form.type) errors.type = "Выберите тип";
  if (!form.title.trim()) errors.title = "Введите название";
  if (!form.status) errors.status = "Выберите статус";
  if (season !== null && (!Number.isFinite(season) || season < 0)) errors.season = "Сезон должен быть 0 или больше";
  if (episode !== null && (!Number.isFinite(episode) || episode < 0)) errors.episode = "Серия должна быть 0 или больше";
  if (form.status === "completed" && (rating === null || !Number.isFinite(rating) || rating < 1 || rating > 10)) {
    errors.rating = "Выберите оценку от 1 до 10";
  }

  return errors;
}

function getManualPayload(form) {
  return {
    type: form.type,
    title: form.title.trim(),
    status: form.status,
    season: form.type === "series" && form.status === "watching" ? parseOptionalNumber(form.season) : null,
    episode: form.type === "series" && form.status === "watching" ? parseOptionalNumber(form.episode) : null,
    rating: form.status === "completed" ? parseOptionalNumber(form.rating) : null,
    comment: form.status === "completed" ? form.comment.trim() || null : null,
    folderId: null,
  };
}

async function confirmManualAdd() {
  if (state.manualOverlay.loading) return;

  const form = state.manualOverlay.form;
  const errors = validateManualForm(form);

  if (Object.keys(errors).length) {
    setState((currentState) => ({
      ...currentState,
      manualOverlay: {
        ...currentState.manualOverlay,
        errors,
      },
    }));
    return;
  }

  const payload = getManualPayload(form);

  setState((currentState) => ({
    ...currentState,
    manualOverlay: {
      ...currentState.manualOverlay,
      loading: true,
    },
  }));

  try {
    const createdItem = await watchHistoryApi.createWatchItem(payload);

    setState((currentState) => ({
      ...currentState,
      items: [normalizeHistoryItem(createdItem), ...currentState.items],
      manualOverlay: { ...initialState.manualOverlay, form: { ...defaultManualForm }, errors: {} },
    }));
    showToast("Добавлено вручную", "success");
  } catch (error) {
    console.error(error);
    setState((currentState) => ({
      ...currentState,
      manualOverlay: { ...currentState.manualOverlay, loading: false },
    }));
    showToast(error.message || "Не удалось обновить данные", "error");
  }
}

function autoSizeActiveTextarea() {
  const textarea = rootElement?.querySelector("[data-rating-comment]");
  if (textarea) autoSizeTextarea(textarea);
}

function autoSizeManualTextarea() {
  const textarea = rootElement?.querySelector("[data-manual-field=\"comment\"]");
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

function updateManualRatingPickerDom(value) {
  rootElement?.querySelectorAll("[data-manual-rating-value]").forEach((button) => {
    const ratingValue = Number(button.dataset.manualRatingValue);
    button.classList.toggle("rating-picker__star--active", ratingValue <= value);
  });

  rootElement?.querySelectorAll(".manual-rating .rating-picker__number").forEach((numberElement) => {
    const ratingValue = Number(numberElement.textContent);
    numberElement.classList.toggle("rating-picker__number--active", ratingValue <= value);
  });
}

function setActiveFilter(value) {
  setState((currentState) => ({
    ...currentState,
    filters: currentState.filters.map((filter) => ({
      ...filter,
      active: filter.value === value,
    })),
  }));
}

function handleRootClick(event) {
  const navButton = event.target.closest("[data-nav-url]");
  if (navButton) {
    navigateToPage(navButton.dataset.navUrl);
    return;
  }

  const actionButton = event.target.closest("[data-action]");
  if (actionButton) {
    const id = actionButton.dataset.id;
    const action = actionButton.dataset.action;

    if (action === "open-manual") {
      openManualOverlay();
      return;
    }

    if (action === "open-detail") {
      openMovieDetail(id);
      return;
    }

    if (action === "mark-watched") {
      markAsCompleted(id);
      return;
    }

    if (action === "rate") {
      openRatingOverlay(id);
      return;
    }

    if (action === "add-to-folder") {
      openFolderOverlay(id);
      return;
    }
  }

  const filterButton = event.target.closest("[data-filter]");
  if (filterButton) {
    setActiveFilter(filterButton.dataset.filter);
    return;
  }

  const detailCard = event.target.closest("[data-card-id]");
  if (detailCard && !event.target.closest("button, a, input, textarea, select")) {
    openMovieDetail(detailCard.dataset.cardId);
    return;
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

  const manualTypeButton = event.target.closest("[data-manual-type]");
  if (manualTypeButton) {
    setManualFormPatch({ type: manualTypeButton.dataset.manualType });
    return;
  }

  const manualStatusButton = event.target.closest("[data-manual-status]");
  if (manualStatusButton) {
    setManualFormPatch({ status: manualStatusButton.dataset.manualStatus });
    return;
  }

  const manualRatingButton = event.target.closest("[data-manual-rating-value]");
  if (manualRatingButton) {
    const value = Number(manualRatingButton.dataset.manualRatingValue);
    state.manualOverlay.form.rating = String(value);
    state.manualOverlay.errors = {};
    updateManualRatingPickerDom(value);
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

  if (event.target.closest("[data-manual-confirm]")) {
    confirmManualAdd();
    return;
  }

  if (event.target.closest("[data-manual-cancel]")) {
    closeManualOverlay();
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

  if (event.target.closest('[data-modal-close="manual"]')) {
    closeManualOverlay();
    return;
  }

  if (event.target.dataset.modalBackdrop === "rating") {
    closeRatingOverlay();
    return;
  }

  if (event.target.dataset.modalBackdrop === "folder") {
    closeFolderOverlay();
    return;
  }

  if (event.target.dataset.modalBackdrop === "manual") {
    closeManualOverlay();
  }
}

function handleRootKeydown(event) {
  const detailCard = event.target.closest("[data-card-id]");
  if (!detailCard || event.target !== detailCard) return;
  if (event.key !== "Enter" && event.key !== " ") return;

  event.preventDefault();
  openMovieDetail(detailCard.dataset.cardId);
}

function handleRootInput(event) {
  const textarea = event.target.closest("[data-rating-comment]");
  if (textarea) {
    autoSizeTextarea(textarea);
    state.ratingOverlay.comment = textarea.value;
    return;
  }

  const searchInput = event.target.closest("[data-history-search]");
  if (searchInput) {
    state.query = searchInput.value;
    renderApp();
    return;
  }

  const manualInput = event.target.closest("[data-manual-field]");
  if (manualInput) {
    setManualFormPatch({ [manualInput.dataset.manualField]: manualInput.value }, false);
    if (manualInput.matches("textarea")) autoSizeTextarea(manualInput);
  }
}

function initWatchHistoryPage() {
  rootElement = document.querySelector("#watch-history-app");
  if (!rootElement) return;

  rootElement.addEventListener("click", handleRootClick);
  rootElement.addEventListener("keydown", handleRootKeydown);
  rootElement.addEventListener("input", handleRootInput);
  renderApp();
  loadPageData();
}

initWatchHistoryPage();
})();
