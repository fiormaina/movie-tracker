(() => {
const {
  autoSizeTextarea,
  escapeHtml,
  navigateToPage,
  renderModalShell,
  renderToasts,
} = window.MovieTrackerUI;
const { createToastController } = window.MovieTrackerHelpers;
const { createPrimaryTabs, renderAppFooter, renderAppHeader } = window.MovieTrackerAppShell;
const {
  addItemToFolder,
  listFolderOptions,
} = window.MovieTrackerFolders;
const watchHistoryApi = window.MovieTrackerMediaApi;
const routes = window.MovieTrackerRoutes;
const OPEN_CREATE_MODAL_KEY = "movieTracker.openCreateFolderModal";
const PENDING_CREATE_SOURCE_KEY = "movieTracker.pendingCreateFolderSource";

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
  tabs: createPrimaryTabs("history"),
  filters: [
    { label: "Все", value: "all", active: true },
    { label: "Фильмы", value: "movie", active: false },
    { label: "Сериалы", value: "series", active: false },
  ],
  query: "",
  activeFilter: "all",
  items: [
    {
      id: "series-1",
      title: "Название сериала 1",
      status: "watching",
      progress: 72,
      rating: 4,
      comment: "",
      folderId: null,
      badge: "Сезон 1, серия 6",
      meta: "Фантастика · 2022 · 45 мин/эп",
      updatedAt: "2026-04-20T12:00:00.000Z",
      watchedAt: null,
    },
    {
      id: "movie-2",
      title: "Название фильма 2",
      status: "watching",
      progress: 72,
      rating: 4,
      comment: "",
      folderId: null,
      badge: "",
      meta: "Фантастика · 2014 · 169 мин",
      updatedAt: "2026-04-20T13:00:00.000Z",
      watchedAt: null,
    },
    {
      id: "series-3",
      title: "Название сериала 3",
      status: "watching",
      progress: 30,
      rating: 4,
      comment: "",
      folderId: null,
      badge: "Сезон 1, серия 3",
      meta: "Драма · 2022 · 58 мин/эп",
      updatedAt: "2026-04-19T18:00:00.000Z",
      watchedAt: null,
    },
    {
      id: "series-7",
      title: "Название сериала 7",
      status: "watching",
      progress: 48,
      rating: 0,
      comment: "",
      folderId: null,
      badge: "Сезон 1, серия 8",
      meta: "Приключения · 2023 · 47 мин/эп",
      updatedAt: "2026-04-21T15:30:00.000Z",
      watchedAt: null,
    },
    {
      id: "movie-8",
      title: "Название фильма 8",
      status: "watching",
      progress: 61,
      rating: 0,
      comment: "",
      folderId: null,
      badge: "",
      meta: "Фэнтези · 2020 · 126 мин",
      updatedAt: "2026-04-21T16:15:00.000Z",
      watchedAt: null,
    },
    {
      id: "series-9",
      title: "Название сериала 9",
      status: "watching",
      progress: 24,
      rating: 0,
      comment: "",
      folderId: null,
      badge: "Сезон 2, серия 4",
      meta: "Комедия · 2024 · 32 мин/эп",
      updatedAt: "2026-04-21T17:00:00.000Z",
      watchedAt: null,
    },
    {
      id: "movie-10",
      title: "Название фильма 10",
      status: "watching",
      progress: 88,
      rating: 0,
      comment: "",
      folderId: null,
      badge: "",
      meta: "Драма · 2021 · 118 мин",
      updatedAt: "2026-04-21T18:40:00.000Z",
      watchedAt: null,
    },
    {
      id: "series-4",
      title: "Название сериала 4",
      status: "completed",
      progress: 100,
      rating: 5,
      comment: "",
      folderId: null,
      badge: "Сезон 2, серия 1",
      meta: "Триллер · 2021 · 50 мин/эп",
      updatedAt: "2026-04-18T20:00:00.000Z",
      watchedAt: "2026-04-18T20:00:00.000Z",
    },
    {
      id: "movie-5",
      title: "Название фильма 5",
      status: "completed",
      progress: 100,
      rating: 4,
      comment: "",
      folderId: null,
      badge: "",
      meta: "Детектив · 2019 · 130 мин",
      updatedAt: "2026-04-17T20:00:00.000Z",
      watchedAt: "2026-04-17T20:00:00.000Z",
    },
    {
      id: "series-6",
      title: "Название сериала 6",
      status: "completed",
      progress: 100,
      rating: 5,
      comment: "",
      folderId: null,
      badge: "Сезон 3, серия 7",
      meta: "Криминал · 2020 · 42 мин/эп",
      updatedAt: "2026-04-16T20:00:00.000Z",
      watchedAt: "2026-04-16T20:00:00.000Z",
    },
  ],
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
    selectedFolderId: "",
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

let state = structuredCloneWithSet(initialState);
let rootElement = null;
const showToast = createToastController(setState);

function structuredCloneWithSet(value) {
  return {
    ...value,
    items: value.items.map((item) => ({ ...item })),
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

function setState(updater, options = {}) {
  state = typeof updater === "function" ? updater(state) : updater;
  renderApp();

  if (options.autosizeTextarea) {
    requestAnimationFrame(autoSizeActiveTextarea);
  }
}

function getItemById(id) {
  return state.items.find((item) => item.id === id);
}

function getMovieDetailUrl(id) {
  return routes.movieDetail({ id });
}

function openMovieDetail(id) {
  navigateToPage(getMovieDetailUrl(id));
}

function updateItemInState(id, patch) {
  return {
    ...state,
    items: state.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
  };
}

function addPendingAction(key) {
  state.pendingActions.add(key);
}

function removePendingAction(key) {
  state.pendingActions.delete(key);
}

function getSections(items) {
  const watchingItems = items.filter((item) => item.status !== "completed");
  const completedItems = items
    .filter((item) => item.status === "completed")
    .sort((a, b) => new Date(b.watchedAt ?? b.updatedAt) - new Date(a.watchedAt ?? a.updatedAt));

  return [
    { title: "Продолжить просмотр", items: watchingItems },
    { title: "Недавно просмотрено", items: completedItems },
  ];
}

function getItemType(item) {
  if (String(item.id ?? "").startsWith("series-")) return "series";
  return "movie";
}

function getVisibleItems() {
  const normalizedQuery = state.query.trim().toLowerCase();

  return state.items.filter((item) => {
    const matchesFilter = state.activeFilter === "all" || getItemType(item) === state.activeFilter;
    const haystack = `${item.title} ${item.meta} ${item.badge}`.toLowerCase();
    const matchesQuery = !normalizedQuery || haystack.includes(normalizedQuery);
    return matchesFilter && matchesQuery;
  });
}

function getHistoryStats(items) {
  const watchingCount = items.filter((item) => item.status !== "completed").length;
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
        <button class="history-toolbar__filter ${filter.active ? "history-toolbar__filter--active" : ""}" type="button" data-filter="${filter.value}">
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
  return sections
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

function renderEmptyHistoryState() {
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
          <a href="${routes.profile()}#extension" data-nav-url="${routes.profile()}#extension">Открыть инструкцию</a>
        </div>
      </div>
    </section>
  `;
}

function renderFilteredEmptyState() {
  return `
    <section class="history-empty" aria-live="polite">
      <div class="history-empty__icon" aria-hidden="true"></div>
      <h2 class="history-empty__title">Ничего не найдено</h2>
      <p class="history-empty__text">Попробуйте изменить поиск или фильтр.</p>
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

  const folderOptions = listFolderOptions();

  if (!folderOptions.length) {
    return renderModalShell(
      "Добавить в папку",
      `
        <div class="folder-placeholder">
          <p class="folder-placeholder__hint">У вас пока нет ни одной собственной папки. Сначала создайте папку, а потом вернитесь сюда.</p>
          <div class="modal-card__footer">
            <button class="modal-card__confirm" type="button" data-action="create-folder-from-overlay">Создать папку</button>
          </div>
        </div>
      `,
      "",
      "folder",
    );
  }

  const folders = folderOptions
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
            <small>${folder.description}</small>
          </span>
        </button>
      `,
    )
    .join("");

  return renderModalShell(
    "Добавить в папку",
    `
      <div class="folder-placeholder">
        <p class="folder-placeholder__hint">Выберите одну из своих папок. Если элемент уже есть в выбранной папке, дубликат не будет создан.</p>
        <div class="folder-options">
          ${folders}
        </div>
      </div>
    `,
    `
      <div class="modal-card__footer">
        <button class="modal-card__confirm" type="button" data-folder-confirm ${overlay.loading ? "disabled" : ""}>
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
        <span class="manual-form__label">Оценка</span>
        ${renderManualRatingPicker(form.rating)}
        ${renderFieldError(errors, "rating")}
      </section>
      <label class="manual-form__field">
        <span class="manual-form__label">Заметки</span>
        <textarea class="modal-card__textarea manual-form__notes" data-manual-field="comment" placeholder="Добавьте заметки (необязательно)" maxlength="800">${form.comment}</textarea>
      </label>
    `;
  }

  return "";
}

function renderManualOverlay(overlay) {
  if (!overlay.isOpen) return "";

  const { form, errors } = overlay;
  const statuses = manualStatuses
    .map(
      (status) => `
        <button
          class="manual-form__chip ${form.status === status.value ? "manual-form__chip--active" : ""}"
          type="button"
          data-manual-status="${status.value}"
        >
          ${status.label}
        </button>
      `,
    )
    .join("");

  return renderModalShell(
    "Добавить вручную",
    `
      <form class="manual-form" data-manual-form novalidate>
        <section class="manual-form__section" aria-label="Тип контента">
          <span class="manual-form__label">Тип контента</span>
          <div class="manual-form__switch">
            <button class="manual-form__switch-button ${form.type === "movie" ? "manual-form__switch-button--active" : ""}" type="button" data-manual-type="movie">Фильм</button>
            <button class="manual-form__switch-button ${form.type === "series" ? "manual-form__switch-button--active" : ""}" type="button" data-manual-type="series">Сериал</button>
          </div>
          ${renderFieldError(errors, "type")}
        </section>

        <label class="manual-form__field">
          <span class="manual-form__label">Название <span aria-hidden="true">*</span></span>
          <input class="manual-form__input" type="text" value="${form.title}" placeholder="Введите название" data-manual-field="title" />
          ${renderFieldError(errors, "title")}
        </label>

        <section class="manual-form__section" aria-label="Статус">
          <span class="manual-form__label">Статус <span aria-hidden="true">*</span></span>
          <div class="manual-form__chips">
            ${statuses}
          </div>
          ${renderFieldError(errors, "status")}
        </section>

        <div class="manual-form__extra" data-manual-extra>
          ${renderManualExtraFields(form, errors)}
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
  const stats = getHistoryStats(state.items);
  const visibleItems = getVisibleItems();
  const content = state.items.length
    ? visibleItems.length
      ? renderSections(getSections(visibleItems))
      : renderFilteredEmptyState()
    : renderEmptyHistoryState();

  return `
    <div class="history-page">
      <h1 class="sr-only">Страница истории просмотра Movie Tracker</h1>
      <div class="history-page__shell">
        ${renderAppHeader({ tabs: state.tabs })}

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
              <input class="history-toolbar__input" type="text" placeholder="Поиск по названию" value="${escapeHtml(state.query)}" data-history-search />
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

          ${content}

          ${renderAppFooter()}
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

async function hydrateWatchHistory() {
  try {
    const items = await watchHistoryApi.listWatchHistory(state.items);
    if (!Array.isArray(items)) return;

    setState((currentState) => ({
      ...currentState,
      items: items.map((item) => ({ ...item })),
    }));
  } catch (error) {
    console.error(error);
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
      progress: 100,
      watchedAt: now,
      updatedAt: now,
    });
  } catch (error) {
    console.error(error);
    setState((currentState) => ({
      ...currentState,
      items: previousItems,
    }));
    showToast("Не удалось обновить данные", "error");
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
      updatedAt: now,
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
    showToast("Не удалось обновить данные", "error");
  }
}

function openFolderOverlay(id) {
  const item = getItemById(id);
  if (!item) return;
  const folderOptions = listFolderOptions();

  setState((currentState) => ({
    ...currentState,
    folderOverlay: {
      isOpen: true,
      itemId: id,
      selectedFolderId: item.folderId || folderOptions[0]?.id || "",
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

function openCreateFolderModal() {
  const sourceItem = state.folderOverlay.itemId ? getItemById(state.folderOverlay.itemId) : null;
  if (sourceItem) {
    window.sessionStorage.setItem(
      PENDING_CREATE_SOURCE_KEY,
      JSON.stringify({
        mediaId: sourceItem.id,
        title: sourceItem.title,
      }),
    );
  }
  window.sessionStorage.setItem(OPEN_CREATE_MODAL_KEY, "1");
  navigateToPage(routes.folders);
}

function updateFolderSelectionDom(selectedFolderId) {
  rootElement?.querySelectorAll("[data-folder-id]").forEach((button) => {
    button.classList.toggle("folder-option--active", button.dataset.folderId === selectedFolderId);
  });
}

async function confirmFolder() {
  const { itemId, selectedFolderId } = state.folderOverlay;
  if (!itemId || !selectedFolderId || state.folderOverlay.loading) return;

  setState((currentState) => ({
    ...currentState,
    folderOverlay: { ...currentState.folderOverlay, loading: true },
  }));

  try {
    const result = await addItemToFolder(selectedFolderId, itemId);

    setState((currentState) => ({
      ...currentState,
      items: currentState.items.map((item) =>
        item.id === itemId ? { ...item, folderId: selectedFolderId } : item,
      ),
      folderOverlay: { ...initialState.folderOverlay },
    }));
    showToast(result.status === "duplicate" ? "Элемент уже добавлен" : "Добавлено в папку", "success");
  } catch (error) {
    console.error(error);
    setState((currentState) => ({
      ...currentState,
      folderOverlay: { ...currentState.folderOverlay, loading: false },
    }));
    showToast(error.code === "access" ? "Ошибка доступа" : "Не удалось обновить данные", "error");
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
    year: null,
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
    const now = createdItem.createdAt || new Date().toISOString();
    const typeLabel = payload.type === "series" ? "Сериал" : "Фильм";
    const badge = payload.type === "series" && payload.status === "watching" && payload.season !== null && payload.episode !== null
      ? `Сезон ${payload.season}, серия ${payload.episode}`
      : "";
    const nextItem = {
      id: createdItem.id,
      title: payload.title,
      status: payload.status,
      progress: payload.status === "completed" ? 100 : payload.status === "watching" ? 36 : 0,
      rating: payload.rating ?? 0,
      comment: payload.comment ?? "",
      folderId: payload.folderId,
      badge,
      meta: `${typeLabel} · Добавлено вручную`,
      updatedAt: now,
      watchedAt: payload.status === "completed" ? now : null,
    };

    setState((currentState) => ({
      ...currentState,
      items: [nextItem, ...currentState.items],
      manualOverlay: { ...initialState.manualOverlay, form: { ...defaultManualForm }, errors: {} },
    }));
    showToast("Добавлено вручную", "success");
  } catch (error) {
    console.error(error);
    setState((currentState) => ({
      ...currentState,
      manualOverlay: { ...currentState.manualOverlay, loading: false },
    }));
    showToast("Не удалось обновить данные", "error");
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

function handleRootClick(event) {
  const navButton = event.target.closest("[data-nav-url]");
  if (navButton) {
    navigateToPage(navButton.dataset.navUrl);
    return;
  }

  const filterButton = event.target.closest("[data-filter]");
  if (filterButton) {
    const nextFilterValue = filterButton.dataset.filter;
    setState((currentState) => ({
      ...currentState,
      activeFilter: nextFilterValue,
      filters: currentState.filters.map((filter) => ({
        ...filter,
        active: filter.value === nextFilterValue,
      })),
    }));
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

    if (action === "create-folder-from-overlay") {
      openCreateFolderModal();
      return;
    }
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
    state.folderOverlay.selectedFolderId = folderButton.dataset.folderId;
    updateFolderSelectionDom(folderButton.dataset.folderId);
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
  const historySearch = event.target.closest("[data-history-search]");
  if (historySearch) {
    state.query = historySearch.value;
    renderApp();
    const nextInput = rootElement?.querySelector("[data-history-search]");
    nextInput?.focus();
    const valueLength = nextInput?.value.length ?? 0;
    nextInput?.setSelectionRange(valueLength, valueLength);
    return;
  }

  const textarea = event.target.closest("[data-rating-comment]");
  if (textarea) {
    autoSizeTextarea(textarea);
    state.ratingOverlay.comment = textarea.value;
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
  hydrateWatchHistory();
}

initWatchHistoryPage();
})();
