(() => {
const {
  escapeHtml,
  navigateToPage,
  renderTabs,
  renderToasts,
  writeClipboardText,
} = window.MovieTrackerUI;

const MOCK_PROFILE_API_DELAY = 350;
const MOCK_PROFILE_API_SHOULD_FAIL = false;
const CURRENT_USER_STORAGE_KEY = "movieTracker.currentUser";
const DEFAULT_DISPLAY_NAME = "Пользователь";

function readCurrentUser() {
  try {
    const rawUser = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    return rawUser ? JSON.parse(rawUser) : null;
  } catch (error) {
    console.warn(error);
    return null;
  }
}

function getInitialUser() {
  const storedUser = readCurrentUser();
  if (!storedUser) {
    return {
      id: "user-2026",
      username: "kinowatcher",
      displayName: "Алексей Смирнов",
      followingCount: 0,
      followersCount: 0,
      extensionCode: "MT-ALEX-2026",
      profileUrl: `${window.location.origin}${window.location.pathname}`,
    };
  }

  const username = storedUser.username ?? storedUser.login ?? "user";

  return {
    id: storedUser.id ?? "user-2026",
    username,
    displayName: storedUser.displayName ?? storedUser.name ?? DEFAULT_DISPLAY_NAME,
    followingCount: storedUser.followingCount ?? 0,
    followersCount: storedUser.followersCount ?? 0,
    extensionCode: storedUser.extensionCode ?? "MT-USER-2026",
    profileUrl: storedUser.profileUrl ?? `${window.location.origin}${window.location.pathname}`,
  };
}

const initialUser = getInitialUser();

const profileApi = {
  saveExternalFolder(folderId) {
    return new Promise((resolve, reject) => {
      window.setTimeout(() => {
        if (MOCK_PROFILE_API_SHOULD_FAIL) {
          reject(new Error("Mock API error"));
          return;
        }

        resolve({
          folderId,
          savedAt: new Date().toISOString(),
        });
      }, MOCK_PROFILE_API_DELAY);
    });
  },
  updateProfile(patch) {
    return Promise.resolve({
      ...patch,
      updatedAt: new Date().toISOString(),
    });
  },
  deleteAccount() {
    return Promise.resolve({
      deletedAt: new Date().toISOString(),
    });
  },
};

const initialState = {
  isOwner: true,
  user: initialUser,
  tabs: [
    { label: "История просмотра", active: false, url: "./watch_history_light_v3.html" },
    { label: "Папки", active: false, url: "./folders.html" },
  ],
  stats: [
    { id: "movies", value: 128, label: "Фильмов", icon: "movie" },
    { id: "series", value: 36, label: "Сериалов", icon: "series" },
    { id: "episodes", value: 412, label: "Эпизодов", icon: "episodes" },
    { id: "hours", value: 584, label: "Часов просмотра", icon: "hours" },
  ],
  publicFolders: [
    {
      id: "noir-week",
      title: "Неоновые детективы",
      count: 18,
      owner: initialUser.username,
      isOwn: true,
      saved: false,
      posters: [
        ["#8c7fff", "#6e53f4"],
        ["#bac7ff", "#8174f4"],
        ["#d8d2f9", "#9b8cff"],
        ["#c8c0f3", "#eef0fb"],
      ],
    },
    {
      id: "quiet-evening",
      title: "Спокойный вечер",
      count: 11,
      owner: initialUser.username,
      isOwn: true,
      saved: false,
      posters: [
        ["#dcd7fb", "#a69af8"],
        ["#eee9ff", "#b7abff"],
        ["#cfd9ff", "#8c7fff"],
        ["#e9e6f5", "#c6bef2"],
      ],
    },
    {
      id: "space-longread",
      title: "Фантастика на выходные",
      count: 24,
      owner: initialUser.username,
      isOwn: true,
      saved: false,
      posters: [
        ["#6e53f4", "#3f8cff"],
        ["#9b8cff", "#74d0ff"],
        ["#d8d2f9", "#8174f4"],
        ["#b6a8fa", "#eef0fb"],
      ],
    },
  ],
  editProfileOverlay: {
    isOpen: false,
    displayName: "",
    username: "",
    confirmDelete: false,
  },
  toasts: [],
  pendingFolderIds: new Set(),
};

let state = cloneState(initialState);
let toastId = 0;
let rootElement = null;

function cloneState(value) {
  return {
    ...value,
    user: { ...value.user },
    tabs: value.tabs.map((tab) => ({ ...tab })),
    stats: value.stats.map((stat) => ({ ...stat })),
    publicFolders: value.publicFolders.map(cloneFolder),
    editProfileOverlay: { ...value.editProfileOverlay },
    toasts: [...value.toasts],
    pendingFolderIds: new Set(value.pendingFolderIds ?? []),
  };
}

function cloneFolder(folder) {
  return {
    ...folder,
    posters: folder.posters.map((poster) => [...poster]),
  };
}

function setState(updater) {
  state = typeof updater === "function" ? updater(state) : updater;
  renderApp();
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

function renderHeader() {
  return `
    <header class="history-page__navbar">
      <div class="history-page__logo" aria-hidden="true"></div>
      <nav class="history-page__tabs" aria-label="Навигация по разделам">
        ${renderTabs(state.tabs)}
      </nav>
      <button class="history-page__avatar history-page__avatar--active" type="button" data-nav-url="./profile.html" aria-label="Открыть профиль">
        ${renderUserIcon(18)}
      </button>
    </header>
  `;
}

function renderUserIcon(size) {
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="7" r="4" fill="rgba(255,255,255,0.92)"></circle>
      <path d="M2 18c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(255,255,255,0.92)" stroke-width="1.5" stroke-linecap="round"></path>
    </svg>
  `;
}

function renderProfileHero() {
  const editButton = state.isOwner
    ? `
      <button class="profile-button profile-button--primary" type="button" data-action="edit-profile">
        <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M10.9 4.2L13.8 7.1M3.8 14.2L6.9 13.55L14.3 6.15C15.1 5.35 15.1 4.05 14.3 3.25C13.5 2.45 12.2 2.45 11.4 3.25L4 10.65L3.8 14.2Z" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
        Редактировать профиль
      </button>
    `
    : "";

  return `
    <section class="profile-hero" aria-label="Профиль пользователя">
      <div class="profile-hero__avatar" aria-hidden="true">
        ${renderUserIcon(46)}
      </div>
      <div class="profile-hero__info">
        <span class="profile-hero__label">${state.isOwner ? "Ваш профиль" : "Публичный профиль"}</span>
        <h1 class="profile-hero__name">${escapeHtml(state.user.displayName)}</h1>
        <p class="profile-hero__meta">
          <span>@${escapeHtml(state.user.username)}</span>
          <span class="profile-hero__dot" aria-hidden="true"></span>
          <span>${state.user.followingCount} подписок</span>
          <span class="profile-hero__dot" aria-hidden="true"></span>
          <span>${state.user.followersCount} подписчиков</span>
        </p>
      </div>
      <div class="profile-hero__actions">
        <button class="profile-button" type="button" data-action="copy-profile-link">
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M7.4 10.6C6.25 9.45 6.25 7.6 7.4 6.45L9.65 4.2C10.8 3.05 12.65 3.05 13.8 4.2C14.95 5.35 14.95 7.2 13.8 8.35L12.78 9.37" stroke="currentColor" stroke-width="1.55" stroke-linecap="round"></path>
            <path d="M10.6 7.4C11.75 8.55 11.75 10.4 10.6 11.55L8.35 13.8C7.2 14.95 5.35 14.95 4.2 13.8C3.05 12.65 3.05 10.8 4.2 9.65L5.22 8.63" stroke="currentColor" stroke-width="1.55" stroke-linecap="round"></path>
          </svg>
          Копировать ссылку на профиль
        </button>
        ${editButton}
      </div>
    </section>
  `;
}

function getStatIcon(type) {
  const icons = {
    movie: `<path d="M3 4.5H15V13.5H3V4.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"></path><path d="M6 4.5L4.5 7.2M9 4.5L7.5 7.2M12 4.5L10.5 7.2M3 7.2H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>`,
    series: `<path d="M4 5H14V13.5H4V5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"></path><path d="M6.2 3.2L8.3 5L11.8 2.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>`,
    episodes: `<path d="M4.2 4.2H13.8V13.8H4.2V4.2Z" stroke="currentColor" stroke-width="1.5"></path><path d="M7 4.2V13.8M11 4.2V13.8M4.2 8.8H13.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>`,
    hours: `<circle cx="9" cy="9" r="5.8" stroke="currentColor" stroke-width="1.5"></circle><path d="M9 5.9V9.2L11.4 10.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>`,
  };

  return icons[type] ?? icons.movie;
}

function renderStats() {
  return `
    <section class="profile-section" aria-label="Статистика пользователя">
      <div class="profile-section__head">
        <h2 class="profile-section__title">Статистика</h2>
      </div>
      <div class="profile-stats">
        ${state.stats
          .map(
            (stat) => `
              <article class="profile-stat-card" tabindex="0">
                <span class="profile-stat-card__icon" aria-hidden="true">
                  <svg width="20" height="20" viewBox="0 0 18 18" fill="none">${getStatIcon(stat.icon)}</svg>
                </span>
                <p class="profile-stat-card__value">${escapeHtml(stat.value)}</p>
                <p class="profile-stat-card__label">${escapeHtml(stat.label)}</p>
              </article>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderExtensionConnect() {
  return `
    <section class="profile-connect" aria-label="Код подключения расширения">
      <div class="profile-connect__content">
        <span class="profile-connect__label">
          Код для подключения расширения
          <span class="profile-connect__help" tabindex="0" aria-label="Подсказка о коде расширения">
            ?
            <span class="profile-connect__tooltip" role="tooltip">Заглушка для подсказки</span>
          </span>
        </span>
        <strong class="profile-connect__code">${escapeHtml(state.user.extensionCode)}</strong>
      </div>
      <button class="profile-button profile-button--primary" type="button" data-action="copy-extension-code">
        <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M6.2 6.2V3.9C6.2 3.3 6.7 2.8 7.3 2.8H14.1C14.7 2.8 15.2 3.3 15.2 3.9V10.7C15.2 11.3 14.7 11.8 14.1 11.8H11.8" stroke="currentColor" stroke-width="1.55" stroke-linejoin="round"></path>
          <path d="M3.9 6.2H10.7C11.3 6.2 11.8 6.7 11.8 7.3V14.1C11.8 14.7 11.3 15.2 10.7 15.2H3.9C3.3 15.2 2.8 14.7 2.8 14.1V7.3C2.8 6.7 3.3 6.2 3.9 6.2Z" stroke="currentColor" stroke-width="1.55" stroke-linejoin="round"></path>
        </svg>
        Копировать код
      </button>
    </section>
  `;
}

function renderLogoutSection() {
  return `
    <section class="profile-logout" aria-label="Выход из профиля">
      <button class="profile-logout__button" type="button" data-action="logout-profile">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M7.2 3.2H4.4C3.74 3.2 3.2 3.74 3.2 4.4V13.6C3.2 14.26 3.74 14.8 4.4 14.8H7.2" stroke="currentColor" stroke-width="1.55" stroke-linecap="round"></path>
          <path d="M10.3 5.4L13.9 9L10.3 12.6M6.8 9H13.8" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
        Выйти из профиля
      </button>
    </section>
  `;
}

function renderFolderCard(folder) {
  const shouldShowOwner = !state.isOwner && !folder.isOwn;
  const shouldShowSaveButton = !state.isOwner && !folder.isOwn;
  const ownerBadge = shouldShowOwner
    ? `
      <div class="folder-card__owner">
        <span class="folder-card__avatar" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="7" r="4" fill="currentColor"></circle>
            <path d="M2 18c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"></path>
          </svg>
        </span>
        <span>${escapeHtml(folder.owner)}</span>
      </div>
    `
    : "";
  const saveButton = shouldShowSaveButton
    ? `
      <button
        class="profile-button"
        type="button"
        data-action="save-folder"
        data-id="${folder.id}"
        ${folder.saved || state.pendingFolderIds.has(folder.id) ? "disabled" : ""}
      >
        ${state.pendingFolderIds.has(folder.id) ? "Добавляем..." : folder.saved ? "Добавлено" : "Добавить к себе"}
      </button>
    `
    : "";

  return `
    <article
      class="folder-card profile-public-card"
      tabindex="0"
      role="link"
      data-folder-card="${folder.id}"
      aria-label="Открыть папку ${escapeHtml(folder.title)}"
    >
      <div class="folder-card__top">
        <div class="profile-public-card__preview" aria-hidden="true">
          ${folder.posters
            .map(
              ([start, end]) => `
                <span class="profile-public-card__poster" style="--poster-start: ${start}; --poster-end: ${end}"></span>
              `,
            )
            .join("")}
        </div>
      </div>
      <div class="folder-card__body">
        ${ownerBadge}
        <h3 class="folder-card__title">${escapeHtml(folder.title)}</h3>
        <p class="profile-public-card__count">${escapeHtml(folder.count)} ${getItemWord(folder.count)}</p>
        ${saveButton ? `<div class="profile-public-card__actions">${saveButton}</div>` : ""}
      </div>
    </article>
  `;
}

function renderFoldersSection(title, folders, hint = "") {
  return `
    <section class="profile-section" aria-label="${escapeHtml(title)}">
      <div class="profile-section__head">
        <div>
          <h2 class="profile-section__title">${escapeHtml(title)}</h2>
          ${hint ? `<p class="profile-section__hint">${escapeHtml(hint)}</p>` : ""}
        </div>
      </div>
      <div class="folders-grid profile-public-folders">
        ${folders.map(renderFolderCard).join("")}
      </div>
    </section>
  `;
}

function renderEditProfileOverlay() {
  const overlay = state.editProfileOverlay;
  if (!overlay.isOpen) return "";

  return `
    <div class="modal-backdrop" data-modal-backdrop="edit-profile">
      <section class="modal-card profile-edit-modal" role="dialog" aria-modal="true" aria-label="Редактировать профиль">
        <button class="modal-card__close" type="button" data-action="close-edit-profile" aria-label="Закрыть">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M4.5 4.5L13.5 13.5M13.5 4.5L4.5 13.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
          </svg>
        </button>
        <h2 class="modal-card__title">Редактировать профиль</h2>

        <div class="profile-edit-form">
          <label class="profile-edit-field">
            <span>Имя</span>
            <input class="profile-edit-input" type="text" value="${escapeHtml(overlay.displayName)}" data-profile-edit-name maxlength="80" />
          </label>
          <label class="profile-edit-field">
            <span>Логин пользователя</span>
            <input class="profile-edit-input" type="text" value="${escapeHtml(overlay.username)}" data-profile-edit-username maxlength="40" />
          </label>
        </div>

        <div class="profile-edit-footer">
          <button class="profile-edit-delete" type="button" data-action="request-delete-account">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M4.2 5.6H13.8" stroke="currentColor" stroke-width="1.55" stroke-linecap="round"></path>
              <path d="M7.2 3.8H10.8M6 5.6L6.45 14.1C6.49 14.73 7 15.2 7.63 15.2H10.37C11 15.2 11.51 14.73 11.55 14.1L12 5.6" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
            Удалить аккаунт
          </button>
          <div class="profile-edit-footer__actions">
            <button class="modal-card__secondary" type="button" data-action="close-edit-profile">Отмена</button>
            <button class="modal-card__confirm" type="button" data-action="save-profile">Сохранить</button>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderDeleteConfirmOverlay() {
  if (!state.editProfileOverlay.confirmDelete) return "";

  return `
    <div class="modal-backdrop profile-delete-backdrop" data-modal-backdrop="delete-account">
      <section class="modal-card profile-delete-modal" role="dialog" aria-modal="true" aria-label="Удалить аккаунт">
        <button class="modal-card__close" type="button" data-action="cancel-delete-account" aria-label="Закрыть">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M4.5 4.5L13.5 13.5M13.5 4.5L4.5 13.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
          </svg>
        </button>
        <h2 class="modal-card__title">Удалить аккаунт?</h2>
        <p class="profile-delete-modal__text">Вы уверены что хотите удалить аккаунт?</p>
        <div class="modal-card__footer profile-delete-modal__footer">
          <button class="modal-card__secondary" type="button" data-action="cancel-delete-account">Отмена</button>
          <button class="modal-card__confirm modal-card__confirm--danger" type="button" data-action="confirm-delete-account">Удалить</button>
        </div>
      </section>
    </div>
  `;
}

function renderPage() {
  return `
    <div class="history-page profile-page">
      <h1 class="sr-only">Профиль пользователя Movie Tracker</h1>
      <div class="history-page__shell">
        ${renderHeader()}
        <div class="history-page__content">
          ${renderProfileHero()}
          ${renderExtensionConnect()}
          ${renderStats()}
          ${renderFoldersSection("Публичные папки", state.publicFolders)}
          ${renderLogoutSection()}
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
      ${renderEditProfileOverlay()}
      ${renderDeleteConfirmOverlay()}
    </div>
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

function renderApp() {
  if (!rootElement) return;
  rootElement.innerHTML = renderPage();
}

async function copyProfileLink() {
  try {
    await writeClipboardText(state.user.profileUrl);
    showToast("Ссылка на профиль скопирована", "success");
  } catch (error) {
    console.error(error);
    showToast("Не удалось скопировать ссылку", "error");
  }
}

async function saveFolder(id) {
  const folder = state.publicFolders.find((item) => item.id === id);
  if (!folder || folder.isOwn || folder.saved || state.pendingFolderIds.has(id)) return;

  state.pendingFolderIds.add(id);
  renderApp();

  try {
    await profileApi.saveExternalFolder(id);

    setState((currentState) => ({
      ...currentState,
      publicFolders: currentState.publicFolders.map((item) =>
        item.id === id ? { ...item, saved: true } : item,
      ),
      pendingFolderIds: new Set([...currentState.pendingFolderIds].filter((folderId) => folderId !== id)),
    }));
    showToast("Папка добавлена", "success");
  } catch (error) {
    console.error(error);
    setState((currentState) => ({
      ...currentState,
      pendingFolderIds: new Set([...currentState.pendingFolderIds].filter((folderId) => folderId !== id)),
    }));
    showToast("Не удалось добавить папку", "error");
  }
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
    const id = actionButton.dataset.id;

    if (action === "copy-profile-link") {
      copyProfileLink();
      return;
    }

    if (action === "copy-extension-code") {
      copyExtensionCode();
      return;
    }

    if (action === "edit-profile") {
      openEditProfileOverlay();
      return;
    }

    if (action === "close-edit-profile") {
      closeEditProfileOverlay();
      return;
    }

    if (action === "save-profile") {
      saveProfile();
      return;
    }

    if (action === "request-delete-account") {
      requestDeleteAccount();
      return;
    }

    if (action === "cancel-delete-account") {
      cancelDeleteAccount();
      return;
    }

    if (action === "confirm-delete-account") {
      confirmDeleteAccount();
      return;
    }

    if (action === "logout-profile") {
      logoutProfile();
      return;
    }

    if (action === "save-folder") {
      saveFolder(id);
      return;
    }
  }

  if (event.target.dataset.modalBackdrop === "edit-profile") {
    closeEditProfileOverlay();
    return;
  }

  if (event.target.dataset.modalBackdrop === "delete-account") {
    cancelDeleteAccount();
    return;
  }

  const folderCard = event.target.closest("[data-folder-card]");
  if (folderCard && !event.target.closest("button, a, input, textarea, select")) {
    showToast("Открытие папки будет подключено к роутингу", "success");
  }
}

async function copyExtensionCode() {
  try {
    await writeClipboardText(state.user.extensionCode);
    showToast("Код расширения скопирован", "success");
  } catch (error) {
    console.error(error);
    showToast("Не удалось скопировать код", "error");
  }
}

function persistCurrentUser(user) {
  try {
    localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
  } catch (error) {
    console.warn(error);
  }
}

function openEditProfileOverlay() {
  setState((currentState) => ({
    ...currentState,
    editProfileOverlay: {
      isOpen: true,
      displayName: currentState.user.displayName,
      username: currentState.user.username,
      confirmDelete: false,
    },
  }));
}

function closeEditProfileOverlay() {
  setState((currentState) => ({
    ...currentState,
    editProfileOverlay: { ...initialState.editProfileOverlay },
  }));
}

async function saveProfile() {
  const displayName = state.editProfileOverlay.displayName.trim();
  const username = state.editProfileOverlay.username.trim().replace(/^@+/, "");

  if (!displayName || !username) {
    showToast("Заполните имя и логин", "error");
    return;
  }

  const updatedUser = {
    ...state.user,
    displayName,
    username,
  };

  try {
    await profileApi.updateProfile({ displayName, username });
    persistCurrentUser(updatedUser);

    setState((currentState) => ({
      ...currentState,
      user: updatedUser,
      publicFolders: currentState.publicFolders.map((folder) =>
        folder.isOwn ? { ...folder, owner: username } : folder,
      ),
      editProfileOverlay: { ...initialState.editProfileOverlay },
    }));
    showToast("Профиль обновлен", "success");
  } catch (error) {
    console.error(error);
    showToast("Не удалось сохранить профиль", "error");
  }
}

function requestDeleteAccount() {
  setState((currentState) => ({
    ...currentState,
    editProfileOverlay: {
      ...currentState.editProfileOverlay,
      confirmDelete: true,
    },
  }));
}

function cancelDeleteAccount() {
  setState((currentState) => ({
    ...currentState,
    editProfileOverlay: {
      ...currentState.editProfileOverlay,
      confirmDelete: false,
    },
  }));
}

async function confirmDeleteAccount() {
  try {
    await profileApi.deleteAccount();
    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    closeEditProfileOverlay();
    showToast("Удаление аккаунта будет завершено на backend", "success");
  } catch (error) {
    console.error(error);
    showToast("Не удалось удалить аккаунт", "error");
  }
}

function logoutProfile() {
  localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
  showToast("Вы вышли из профиля", "success");
}

function handleRootInput(event) {
  const nameInput = event.target.closest("[data-profile-edit-name]");
  if (nameInput) {
    state.editProfileOverlay.displayName = nameInput.value;
    return;
  }

  const usernameInput = event.target.closest("[data-profile-edit-username]");
  if (usernameInput) {
    state.editProfileOverlay.username = usernameInput.value;
  }
}

function handleRootKeydown(event) {
  if (event.key === "Escape" && state.editProfileOverlay.isOpen) {
    closeEditProfileOverlay();
    return;
  }

  const folderCard = event.target.closest("[data-folder-card]");
  if (!folderCard || event.target !== folderCard) return;
  if (event.key !== "Enter" && event.key !== " ") return;

  event.preventDefault();
  showToast("Открытие папки будет подключено к роутингу", "success");
}

function initProfilePage() {
  rootElement = document.querySelector("#profile-app");
  if (!rootElement) return;

  rootElement.addEventListener("click", handleRootClick);
  rootElement.addEventListener("keydown", handleRootKeydown);
  rootElement.addEventListener("input", handleRootInput);
  renderApp();
}

initProfilePage();
})();
