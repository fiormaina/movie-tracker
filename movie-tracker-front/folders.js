(() => {
const {
  escapeHtml,
  navigateToPage,
  renderModalShell,
  renderTabs,
  renderToasts,
  writeClipboardText,
} = window.MovieTrackerUI;

const ACCESS_TOKEN_STORAGE_KEY = "movieTracker.accessToken";

const initialState = {
  tabs: [
    { label: "История просмотра", active: false, url: "./watch_history_light_v3.html" },
    { label: "Папки", active: true, static: true },
  ],
  filters: [
    { label: "Все", value: "all", active: true },
    { label: "Личные", value: "private", active: false },
    { label: "Сохраненные", value: "shared", active: false },
  ],
  folders: [],
  query: "",
  activeFilter: "all",
  loading: true,
  loadError: "",
  deleteOverlay: {
    isOpen: false,
    folderId: null,
  },
  toasts: [],
};

const foldersApi = {
  async fetchFolders() {
    return requestJson(getFoldersEndpoint());
  },
  async deleteFolder(id) {
    return requestJson(`${getFoldersEndpoint()}/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },
};

let state = cloneState(initialState);
let toastId = 0;
let rootElement = null;

function cloneState(value) {
  return {
    ...value,
    tabs: value.tabs.map((tab) => ({ ...tab })),
    filters: value.filters.map((filter) => ({ ...filter })),
    folders: value.folders.map((folder) => ({ ...folder })),
    deleteOverlay: { ...value.deleteOverlay },
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
    throw new Error("Чтобы открыть папки, сначала войдите в аккаунт.");
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

  if (response.status === 204) {
    return null;
  }

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
    itemsCount: Number(folder.itemsCount ?? 0),
    access: folder.access ?? "private",
    description: folder.description ?? "",
    canDelete: Boolean(folder.canDelete),
    isSystem: Boolean(folder.isSystem),
    systemKey: folder.systemKey ?? null,
  };
}

function setState(updater) {
  state = typeof updater === "function" ? updater(state) : updater;
  renderApp();
}

function getFolderById(id) {
  return state.folders.find((folder) => folder.id === String(id));
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

function renderFilters(filters) {
  return filters
    .map(
      (filter) => `
        <button
          class="history-toolbar__filter ${filter.active ? "history-toolbar__filter--active" : ""}"
          type="button"
          data-filter="${filter.value}"
        >
          ${escapeHtml(filter.label)}
        </button>
      `,
    )
    .join("");
}

function getVisibleFolders() {
  const normalizedQuery = state.query.trim().toLowerCase();

  return state.folders.filter((folder) => {
    const matchesFilter = state.activeFilter === "all" || folder.access === state.activeFilter;
    const matchesQuery = !normalizedQuery || folder.title.toLowerCase().includes(normalizedQuery);

    return matchesFilter && matchesQuery;
  });
}

function renderFolderCard(folder) {
  const owner = folder.isSystem
    ? `
      <div class="folder-card__owner">
        <span>${escapeHtml(folder.description || "Системная папка")}</span>
      </div>
    `
    : "";

  const deleteAction = folder.canDelete
    ? `
      <div class="folder-card__action">
        <span class="folder-card__tooltip">Удалить</span>
        <button class="folder-card__icon-button folder-card__icon-button--danger" type="button" data-action="delete-folder" data-id="${folder.id}" aria-label="Удалить">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M4.2 5.6H13.8" stroke="currentColor" stroke-width="1.55" stroke-linecap="round"></path>
            <path d="M7.2 3.8H10.8M6 5.6L6.45 14.1C6.49 14.73 7 15.2 7.63 15.2H10.37C11 15.2 11.51 14.73 11.55 14.1L12 5.6" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
        </button>
      </div>
    `
    : "";

  return `
    <article class="folder-card" tabindex="0" aria-label="Папка ${escapeHtml(folder.title)}">
      <div class="folder-card__top">
        <div class="folder-card__posters" aria-hidden="true">
          <span class="folder-card__poster"></span>
          <span class="folder-card__poster"></span>
          <span class="folder-card__poster"></span>
          <span class="folder-card__poster"></span>
        </div>
        <div class="folder-card__actions">
          <div class="folder-card__action">
            <span class="folder-card__tooltip">Копировать ссылку</span>
            <button class="folder-card__icon-button" type="button" data-action="copy-link" data-id="${folder.id}" aria-label="Копировать ссылку">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M7.4 10.6C6.25 9.45 6.25 7.6 7.4 6.45L9.65 4.2C10.8 3.05 12.65 3.05 13.8 4.2C14.95 5.35 14.95 7.2 13.8 8.35L12.78 9.37" stroke="currentColor" stroke-width="1.55" stroke-linecap="round"></path>
                <path d="M10.6 7.4C11.75 8.55 11.75 10.4 10.6 11.55L8.35 13.8C7.2 14.95 5.35 14.95 4.2 13.8C3.05 12.65 3.05 10.8 4.2 9.65L5.22 8.63" stroke="currentColor" stroke-width="1.55" stroke-linecap="round"></path>
              </svg>
            </button>
          </div>
          ${deleteAction}
        </div>
      </div>
      <div class="folder-card__body">
        ${owner}
        <h3 class="folder-card__title">${escapeHtml(folder.title)}</h3>
        <p class="folder-card__count">${folder.itemsCount} ${getItemWord(folder.itemsCount)}</p>
      </div>
    </article>
  `;
}

function getItemWord(count) {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return "элементов";
  if (lastDigit === 1) return "элемент";
  if (lastDigit >= 2 && lastDigit <= 4) return "элемента";
  return "элементов";
}

function renderFoldersSection(folders) {
  if (state.loading) {
    return `
      <section class="folders-empty" aria-live="polite">
        <strong>Загружаем папки</strong>
        Подтягиваем системные и пользовательские разделы.
      </section>
    `;
  }

  if (state.loadError) {
    return `
      <section class="folders-empty" aria-live="polite">
        <strong>Не удалось загрузить папки</strong>
        ${escapeHtml(state.loadError)}
      </section>
    `;
  }

  if (!folders.length) {
    return `
      <section class="folders-empty" aria-live="polite">
        <strong>Папки не найдены</strong>
        Попробуйте изменить поиск или фильтр.
      </section>
    `;
  }

  return `
    <section class="history-section">
      <h2 class="history-section__label">Мои папки</h2>
      <div class="folders-grid">
        ${folders.map(renderFolderCard).join("")}
      </div>
    </section>
  `;
}

function renderDeleteOverlay(overlay) {
  if (!overlay.isOpen) return "";

  const folder = getFolderById(overlay.folderId);
  if (!folder) return "";

  return renderModalShell(
    "Удалить папку",
    `
      <p class="delete-confirm">
        Действительно хотите удалить ${escapeHtml(folder.title)}?
      </p>
    `,
    `
      <div class="modal-card__footer modal-card__footer--split">
        <button class="modal-card__secondary" type="button" data-delete-cancel>Отмена</button>
        <button class="modal-card__confirm modal-card__confirm--danger" type="button" data-delete-confirm>
          Удалить
        </button>
      </div>
    `,
    "delete",
  );
}

function renderPage() {
  const visibleFolders = getVisibleFolders();

  return `
    <div class="history-page folders-page">
      <h1 class="sr-only">Страница папок Movie Tracker</h1>
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
          <section class="folders-heading" aria-label="Обзор папок">
            <div>
              <h2 class="folders-heading__title">Папки</h2>
              <p class="folders-heading__text">Системные папки создаются автоматически для каждого пользователя, а пользовательские папки можно будет расширить позже.</p>
            </div>
            <div class="folders-heading__stats" aria-label="Статистика папок">
              <span class="folders-heading__stat"><strong>${state.folders.length}</strong> ${getFolderWord(state.folders.length)}</span>
            </div>
          </section>

          <section class="history-toolbar" aria-label="Поиск и фильтры">
            <div class="history-toolbar__search">
              <input class="history-toolbar__input" type="text" placeholder="Поиск по папкам" value="${escapeHtml(state.query)}" data-folder-search />
              <span class="history-toolbar__icon" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" stroke-width="1.5"></circle>
                  <path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
                </svg>
              </span>
            </div>
            <button class="history-toolbar__add" type="button" data-action="create-folder">+ Создать папку</button>
            <div class="history-toolbar__filters">
              ${renderFilters(state.filters)}
            </div>
          </section>

          ${renderFoldersSection(visibleFolders)}

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
      ${renderDeleteOverlay(state.deleteOverlay)}
    </div>
  `;
}

function getFolderWord(count) {
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return "папок";
  if (lastDigit === 1) return "папка";
  if (lastDigit >= 2 && lastDigit <= 4) return "папки";
  return "папок";
}

function renderApp() {
  if (!rootElement) return;
  rootElement.innerHTML = renderPage();
}

async function loadFolders() {
  setState((currentState) => ({
    ...currentState,
    loading: true,
    loadError: "",
  }));

  try {
    const response = await foldersApi.fetchFolders();
    setState((currentState) => ({
      ...currentState,
      loading: false,
      loadError: "",
      folders: (response.items ?? []).map(normalizeFolder),
    }));
  } catch (error) {
    console.error(error);
    setState((currentState) => ({
      ...currentState,
      loading: false,
      loadError: error.message || "Не удалось загрузить папки.",
      folders: [],
    }));
  }
}

async function copyFolderLink(id) {
  const folderUrl = `${window.location.href.split("#")[0]}#${encodeURIComponent(id)}`;

  try {
    await writeClipboardText(folderUrl);
    showToast("Ссылка скопирована", "success");
  } catch (error) {
    console.error(error);
    showToast("Не удалось скопировать ссылку", "error");
  }
}

function openDeleteOverlay(id) {
  const folder = getFolderById(id);
  if (!folder) return;

  if (!folder.canDelete) {
    showToast("Системные папки удалять нельзя", "error");
    return;
  }

  setState((currentState) => ({
    ...currentState,
    deleteOverlay: {
      isOpen: true,
      folderId: id,
    },
  }));
}

function closeDeleteOverlay() {
  setState((currentState) => ({
    ...currentState,
    deleteOverlay: { ...initialState.deleteOverlay },
  }));
}

async function confirmDelete() {
  const { folderId } = state.deleteOverlay;
  if (!folderId) return;

  try {
    await foldersApi.deleteFolder(folderId);

    setState((currentState) => ({
      ...currentState,
      folders: currentState.folders.filter((folder) => folder.id !== folderId),
      deleteOverlay: { ...initialState.deleteOverlay },
    }));

    showToast("Папка удалена", "success");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Не удалось удалить папку", "error");
  }
}

function setActiveFilter(value) {
  setState((currentState) => ({
    ...currentState,
    activeFilter: value,
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

    if (action === "copy-link") {
      copyFolderLink(id);
      return;
    }

    if (action === "delete-folder") {
      openDeleteOverlay(id);
      return;
    }

    if (action === "create-folder") {
      showToast("Создание пользовательских папок подключим следующим шагом", "success");
      return;
    }
  }

  const filterButton = event.target.closest("[data-filter]");
  if (filterButton) {
    setActiveFilter(filterButton.dataset.filter);
    return;
  }

  if (event.target.closest("[data-delete-confirm]")) {
    confirmDelete();
    return;
  }

  if (event.target.closest("[data-delete-cancel]") || event.target.closest('[data-modal-close="delete"]')) {
    closeDeleteOverlay();
    return;
  }

  if (event.target.dataset.modalBackdrop === "delete") {
    closeDeleteOverlay();
  }
}

function handleRootInput(event) {
  const searchInput = event.target.closest("[data-folder-search]");
  if (!searchInput) return;

  state.query = searchInput.value;
  renderApp();
  const nextInput = rootElement?.querySelector("[data-folder-search]");
  nextInput?.focus();
  const valueLength = nextInput?.value.length ?? 0;
  nextInput?.setSelectionRange(valueLength, valueLength);
}

function initFoldersPage() {
  rootElement = document.querySelector("#folders-app");
  if (!rootElement) return;

  rootElement.addEventListener("click", handleRootClick);
  rootElement.addEventListener("input", handleRootInput);
  renderApp();
  loadFolders();
}

initFoldersPage();
})();
