(() => {
  const {
    escapeHtml,
    navigateToPage,
    renderToasts,
    writeClipboardText,
  } = window.MovieTrackerUI;
  const { createToastController, pluralizeRu } = window.MovieTrackerHelpers;
  const { createPrimaryTabs, renderAppFooter, renderAppHeader } = window.MovieTrackerAppShell;
  const { renderPageState } = window.MovieTrackerFeedback;
  const { renderProfileFolderCard } = window.MovieTrackerFolderCard;
  const {
    currentUser,
    followUser,
    getProfileUrl,
    getProfileView,
    saveFolder,
    unfollowUser,
    upsertUser,
  } = window.MovieTrackerFolders;
  const routes = window.MovieTrackerRoutes;

  const CURRENT_USER_STORAGE_KEY = "movieTracker.currentUser";
  const ACCESS_TOKEN_STORAGE_KEY = "movieTracker.accessToken";
  const DEFAULT_DISPLAY_NAME = "Пользователь";
  const API_BASE_URL = String(window.MovieTrackerConfig?.apiBaseUrl ?? "").replace(/\/+$/, "");
  const API_V1_BASE_URL = `${API_BASE_URL}/api/v1`;
  const PROFILE_ENDPOINT = `${API_V1_BASE_URL}/auth/me`;
  const PROFILE_TEMPORARY_ERROR_MESSAGE = "Не удалось загрузить профиль";

  const initialState = {
    status: "loading",
    errorMessage: "",
    viewerId: currentUser.id,
    isOwner: true,
    user: null,
    tabs: createPrimaryTabs(),
    stats: [],
    publicFolders: [],
    pendingFolderIds: new Set(),
    pendingFollow: false,
    editProfileOverlay: {
      isOpen: false,
      displayName: "",
      username: "",
      confirmDelete: false,
    },
    toasts: [],
  };

  let state = cloneState(initialState);
  let rootElement = null;
  const showToast = createToastController(setState);

  function cloneState(value) {
    return {
      ...value,
      user: value.user ? { ...value.user } : null,
      tabs: value.tabs.map((tab) => ({ ...tab })),
      stats: value.stats.map((stat) => ({ ...stat })),
      publicFolders: value.publicFolders.map((folder) => ({
        ...folder,
        posters: folder.posters.map((poster) => [...poster]),
      })),
      pendingFolderIds: new Set(value.pendingFolderIds ?? []),
      editProfileOverlay: { ...value.editProfileOverlay },
      toasts: [...value.toasts],
    };
  }

  function setState(updater) {
    state = typeof updater === "function" ? updater(state) : updater;
    renderApp();
  }

  function readAccessToken() {
    return localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY);
  }

  function persistCurrentUser(user) {
    try {
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
    } catch (error) {
      console.warn(error);
    }
  }

  function normalizeProfileUser(source, fallbackUser = currentUser) {
    const username = source.login ?? source.username ?? fallbackUser.username ?? "user";

    return {
      id: source.id ?? fallbackUser.id,
      username,
      displayName:
        source.displayName ??
        source.display_name ??
        source.name ??
        fallbackUser.displayName ??
        DEFAULT_DISPLAY_NAME,
      followingCount: source.followingCount ?? fallbackUser.followingCount ?? 0,
      followersCount: source.followersCount ?? fallbackUser.followersCount ?? 0,
      extensionCode:
        source.extensionCode ??
        source.extension_code ??
        fallbackUser.extensionCode ??
        "MT-USER-2026",
    };
  }

  async function sendProfileRequest(url, options = {}) {
    const token = readAccessToken();
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    let data = null;
    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }

    if (!response.ok) {
      const detail = data?.detail;
      if (detail && typeof detail === "object" && detail.message) {
        throw new Error(detail.message);
      }

      throw new Error(detail ?? data?.message ?? PROFILE_TEMPORARY_ERROR_MESSAGE);
    }

    return data;
  }

  const profileApi = {
    async getProfile() {
      return sendProfileRequest(PROFILE_ENDPOINT, { method: "GET" });
    },
    updateProfile(patch) {
      return sendProfileRequest(PROFILE_ENDPOINT, {
        method: "PATCH",
        body: JSON.stringify({
          display_name: patch.displayName,
          login: patch.username,
        }),
      });
    },
    deleteAccount() {
      return Promise.resolve({
        deletedAt: new Date().toISOString(),
      });
    },
  };

  function getRouteTarget() {
    const params = new URLSearchParams(window.location.search);
    return String(params.get("user") ?? "").trim().replace(/^@+/, "");
  }

  function isCurrentUsersRoute(routeTarget, viewer) {
    const normalizedTarget = String(routeTarget ?? "").trim().toLowerCase();
    if (!normalizedTarget || normalizedTarget === "me") return true;

    return (
      normalizedTarget === String(viewer.id ?? "").trim().toLowerCase() ||
      normalizedTarget === String(viewer.username ?? "").trim().toLowerCase()
    );
  }

  function buildFolderPosters(seed) {
    const palette = [
      ["#8c7fff", "#6e53f4"],
      ["#bac7ff", "#8174f4"],
      ["#d8d2f9", "#9b8cff"],
      ["#c8c0f3", "#eef0fb"],
      ["#74d0ff", "#3f8cff"],
      ["#f5d6a2", "#f1ab5f"],
      ["#9be6c7", "#3fb387"],
      ["#f6bcc7", "#ef748d"],
    ];
    const normalizedSeed = String(seed ?? "folder");
    const hash = [...normalizedSeed].reduce((value, char) => value + char.charCodeAt(0), 0);

    return Array.from({ length: 4 }, (_, index) => palette[(hash + index) % palette.length]);
  }

  function decorateFolders(folders) {
    return folders.map((folder) => ({
      ...folder,
      count: folder.itemsCount,
      saved: folder.isSaved,
      owner: folder.ownerName,
      posters: buildFolderPosters(folder.id),
    }));
  }

  function buildStats() {
    return [
      { id: "movies", value: 128, label: "Фильмов", icon: "movie" },
      { id: "series", value: 36, label: "Сериалов", icon: "series" },
      { id: "episodes", value: 412, label: "Эпизодов", icon: "episodes" },
      { id: "hours", value: 584, label: "Часов просмотра", icon: "hours" },
    ];
  }

  function syncProfileLocation(user, isOwner) {
    const currentUrl = new URL(window.location.href);
    const nextUrl = new URL(
      isOwner ? routes.profile() : getProfileUrl(user.username, false),
      window.location.href,
    );

    if (currentUrl.pathname === nextUrl.pathname && currentUrl.search === nextUrl.search) {
      return;
    }

    window.history.replaceState(window.history.state, "", nextUrl.href);
  }

  async function resolveViewer() {
    const token = readAccessToken();
    if (!token) {
      return { ...currentUser };
    }

    try {
      const responseData = await profileApi.getProfile();
      const viewer = normalizeProfileUser(responseData, currentUser);
      persistCurrentUser(viewer);
      upsertUser(viewer);
      return viewer;
    } catch (error) {
      console.error(error);
      showToast(error.message || PROFILE_TEMPORARY_ERROR_MESSAGE, "error");
      return { ...currentUser };
    }
  }

  async function loadProfileView(options = {}) {
    const routeTarget = getRouteTarget();
    const viewer = await resolveViewer();
    const ownRoute = isCurrentUsersRoute(routeTarget, viewer);
    const profileView = getProfileView({
      userId: ownRoute ? viewer.id : "",
      username: ownRoute ? viewer.username : routeTarget,
      viewerId: viewer.id,
    });

    if (profileView.status !== "ok") {
      setState((currentState) => ({
        ...currentState,
        status: profileView.status,
        errorMessage: profileView.status === "missing" ? "" : PROFILE_TEMPORARY_ERROR_MESSAGE,
        viewerId: viewer.id,
        isOwner: ownRoute,
        user: null,
        publicFolders: [],
        stats: [],
      }));
      return;
    }

    const profileUser = ownRoute
      ? {
          ...profileView.user,
          ...viewer,
          isOwner: true,
          isFollowing: false,
          profileUrl: getProfileUrl(viewer.username, true),
        }
      : profileView.user;
    const publicFolders = decorateFolders(profileView.publicFolders);

    syncProfileLocation(profileUser, ownRoute);

    setState((currentState) => ({
      ...currentState,
      status: "ready",
      errorMessage: "",
      viewerId: viewer.id,
      isOwner: ownRoute,
      user: profileUser,
      publicFolders,
      stats: buildStats(),
      pendingFollow: options.keepPendingFollow ? currentState.pendingFollow : false,
      editProfileOverlay: ownRoute
        ? currentState.editProfileOverlay
        : { ...initialState.editProfileOverlay },
    }));
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
    if (!state.user) return "";

    const socialButton = state.isOwner
      ? `
        <button class="profile-button profile-button--primary" type="button" data-action="edit-profile">
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M10.9 4.2L13.8 7.1M3.8 14.2L6.9 13.55L14.3 6.15C15.1 5.35 15.1 4.05 14.3 3.25C13.5 2.45 12.2 2.45 11.4 3.25L4 10.65L3.8 14.2Z" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
          Редактировать профиль
        </button>
      `
      : `
        <button
          class="profile-button ${state.user.isFollowing ? "" : "profile-button--primary"}"
          type="button"
          data-action="toggle-follow"
          ${state.pendingFollow ? "disabled" : ""}
        >
          ${state.pendingFollow
            ? state.user.isFollowing ? "Обновляем..." : "Подписываемся..."
            : state.user.isFollowing ? "Вы подписаны" : "Подписаться"}
        </button>
      `;

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
            <span class="profile-hero__dot" aria-hidden="true"></span>
            <span>${state.publicFolders.length} публичных папок</span>
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
          ${socialButton}
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
          <div>
            <h2 class="profile-section__title">Статистика</h2>
            <p class="profile-section__hint">${escapeHtml(
              state.isOwner
                ? "Сводка по вашему просмотру: фильмы, сериалы, эпизоды и общее время."
                : "Сводка по просмотру пользователя: фильмы, сериалы, эпизоды и часы просмотра.",
            )}</p>
          </div>
        </div>
        <div class="profile-stats">
          ${state.stats
            .map(
              (stat) => `
                <article class="profile-stat-card" tabindex="0">
                  <span class="profile-stat-card__icon" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 18 18" fill="none">${getStatIcon(stat.icon)}</svg>
                  </span>
                  <p class="profile-stat-card__value">${escapeHtml(String(stat.value))}</p>
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
    if (!state.isOwner || !state.user) return "";

    return `
      <section class="profile-connect" aria-label="Код подключения расширения">
        <div class="profile-connect__content">
          <span class="profile-connect__label">
            Код для подключения расширения
            <span class="profile-connect__help" tabindex="0" aria-label="Подсказка о коде расширения">
              ?
              <span class="profile-connect__tooltip">Этот код нужен только вам, чтобы привязать расширение браузера к своему аккаунту.</span>
            </span>
          </span>
          <strong class="profile-connect__code">${escapeHtml(state.user.extensionCode || "MT-USER-2026")}</strong>
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

  function renderFolderCard(folder) {
    const saveButton = !state.isOwner
      ? `
        <button
          class="profile-button"
          type="button"
          data-action="save-folder"
          data-id="${escapeHtml(folder.id)}"
          ${folder.saved || state.pendingFolderIds.has(folder.id) ? "disabled" : ""}
        >
          ${state.pendingFolderIds.has(folder.id) ? "Добавляем..." : folder.saved ? "Добавлено" : "Добавить к себе"}
        </button>
      `
      : "";

    return renderProfileFolderCard(
      {
        ...folder,
        countText: `${escapeHtml(String(folder.count))} ${getItemWord(folder.count)}`,
      },
      saveButton,
    );
  }

  function renderFoldersSection() {
    const title = state.isOwner ? "Ваши публичные папки" : "Публичные папки";
    const hint = state.isOwner
      ? "Именно эти подборки видят другие пользователи и могут сохранять к себе."
      : "Чужие публичные подборки доступны для просмотра и сохранения в вашу библиотеку.";

    const content = state.publicFolders.length
      ? `
        <div class="folders-grid profile-public-folders">
          ${state.publicFolders.map(renderFolderCard).join("")}
        </div>
      `
      : `
        <div class="profile-empty-state" aria-live="polite">
          <strong>${escapeHtml(
            state.isOwner ? "Пока нет публичных папок" : "У пользователя пока нет публичных папок",
          )}</strong>
          <p>${escapeHtml(
            state.isOwner
              ? "Сделайте любую папку публичной на странице папок, и она появится здесь."
              : "Когда пользователь откроет хотя бы одну папку для общего доступа, она появится на этой странице.",
          )}</p>
        </div>
      `;

    return `
      <section class="profile-section" aria-label="${escapeHtml(title)}">
        <div class="profile-section__head">
          <div>
            <h2 class="profile-section__title">${escapeHtml(title)}</h2>
            <p class="profile-section__hint">${escapeHtml(hint)}</p>
          </div>
        </div>
        ${content}
      </section>
    `;
  }

  function renderLogoutSection() {
    if (!state.isOwner) return "";

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

  function renderEditProfileOverlay() {
    const overlay = state.editProfileOverlay;
    if (!overlay.isOpen || !state.isOwner) return "";

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
    if (!state.editProfileOverlay.confirmDelete || !state.isOwner) return "";

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

  function renderStateCard(title, text, actionLabel = "", actionUrl = routes.profile()) {
    return renderPageState({
      className: "profile-empty-state profile-empty-state--page",
      title,
      text,
      actionLabel,
      actionUrl,
    });
  }

  function renderReadyPage() {
    return `
      ${renderProfileHero()}
      ${renderExtensionConnect()}
      ${renderStats()}
      ${renderFoldersSection()}
      ${renderLogoutSection()}
      ${renderAppFooter()}
    `;
  }

  function renderContent() {
    if (state.status === "loading") {
      return renderStateCard("Загружаем профиль", "Собираем публичные папки, подписки и данные пользователя.");
    }

    if (state.status === "missing") {
      return renderStateCard("Профиль не найден", "Такой пользователь не найден или ссылка больше не актуальна.", "Перейти в мой профиль");
    }

    if (state.status !== "ready") {
      return renderStateCard("Не удалось открыть профиль", state.errorMessage || PROFILE_TEMPORARY_ERROR_MESSAGE, "Открыть мой профиль");
    }

    return renderReadyPage();
  }

  function renderPage() {
    return `
      <div class="history-page profile-page">
        <h1 class="sr-only">Профиль пользователя Movie Tracker</h1>
        <div class="history-page__shell">
          ${renderAppHeader({ tabs: state.tabs, profileActive: true })}
          <div class="history-page__content">
            ${renderContent()}
          </div>
        </div>
        ${renderToasts(state.toasts)}
        ${renderEditProfileOverlay()}
        ${renderDeleteConfirmOverlay()}
      </div>
    `;
  }

  function getItemWord(count) {
    return pluralizeRu(count, { one: "элемент", few: "элемента", many: "элементов" });
  }

  function renderApp() {
    if (!rootElement) return;
    rootElement.innerHTML = renderPage();
  }

  async function copyProfileLink() {
    if (!state.user?.profileUrl) return;

    try {
      await writeClipboardText(state.user.profileUrl);
      showToast("Ссылка на профиль скопирована", "success");
    } catch (error) {
      console.error(error);
      showToast("Не удалось скопировать ссылку", "error");
    }
  }

  async function copyExtensionCode() {
    if (!state.isOwner || !state.user?.extensionCode) return;

    try {
      await writeClipboardText(state.user.extensionCode);
      showToast("Код расширения скопирован", "success");
    } catch (error) {
      console.error(error);
      showToast("Не удалось скопировать код", "error");
    }
  }

  async function toggleFollow() {
    if (state.isOwner || !state.user || state.pendingFollow) return;

    setState((currentState) => ({
      ...currentState,
      pendingFollow: true,
    }));

    try {
      const result = state.user.isFollowing
        ? await unfollowUser(state.user.id, state.viewerId)
        : await followUser(state.user.id, state.viewerId);
      const updatedUser = result.user;

      setState((currentState) => ({
        ...currentState,
        user: updatedUser,
        stats: buildStats(),
        pendingFollow: false,
      }));
      showToast(
        updatedUser.isFollowing ? "Подписка оформлена" : "Подписка отменена",
        "success",
      );
    } catch (error) {
      console.error(error);
      setState((currentState) => ({
        ...currentState,
        pendingFollow: false,
      }));
      showToast("Не удалось обновить подписку", "error");
    }
  }

  async function savePublicFolder(folderId) {
    const folder = state.publicFolders.find((item) => item.id === folderId);
    if (!folder || folder.saved || state.pendingFolderIds.has(folderId)) return;

    state.pendingFolderIds.add(folderId);
    renderApp();

    try {
      await saveFolder(folderId, state.viewerId);
      setState((currentState) => ({
        ...currentState,
        publicFolders: currentState.publicFolders.map((item) =>
          item.id === folderId ? { ...item, saved: true } : item,
        ),
        pendingFolderIds: new Set(
          [...currentState.pendingFolderIds].filter((pendingId) => pendingId !== folderId),
        ),
      }));
      showToast("Папка добавлена", "success");
    } catch (error) {
      console.error(error);
      setState((currentState) => ({
        ...currentState,
        pendingFolderIds: new Set(
          [...currentState.pendingFolderIds].filter((pendingId) => pendingId !== folderId),
        ),
      }));
      showToast("Не удалось добавить папку", "error");
    }
  }

  function openEditProfileOverlay() {
    if (!state.isOwner || !state.user) return;

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
    if (!state.isOwner || !state.user) return;

    const displayName = state.editProfileOverlay.displayName.trim();
    const username = state.editProfileOverlay.username.trim().replace(/^@+/, "");

    if (!displayName || !username) {
      showToast("Заполните имя и логин", "error");
      return;
    }

    try {
      const responseData = await profileApi.updateProfile({ displayName, username });
      const updatedUser = normalizeProfileUser(responseData, state.user);
      persistCurrentUser(updatedUser);
      upsertUser(updatedUser);

      setState((currentState) => ({
        ...currentState,
        user: {
          ...currentState.user,
          ...updatedUser,
          profileUrl: getProfileUrl(updatedUser.username, true),
        },
        editProfileOverlay: { ...initialState.editProfileOverlay },
      }));
      syncProfileLocation(updatedUser, true);
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
      localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
      closeEditProfileOverlay();
      showToast("Удаление аккаунта будет завершено на backend", "success");
    } catch (error) {
      console.error(error);
      showToast("Не удалось удалить аккаунт", "error");
    }
  }

  function logoutProfile() {
    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
    window.location.href = "./index.html";
  }

  function openFolder(folderId) {
    const folder = state.publicFolders.find((item) => item.id === folderId);
    if (!folder?.pageUrl) return;
    navigateToPage(folder.pageUrl);
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
      const folderId = actionButton.dataset.id;

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
        savePublicFolder(folderId);
        return;
      }

      if (action === "toggle-follow") {
        toggleFollow();
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
      openFolder(folderCard.dataset.folderCard);
    }
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
    openFolder(folderCard.dataset.folderCard);
  }

  function initProfilePage() {
    rootElement = document.querySelector("#profile-app");
    if (!rootElement) return;

    rootElement.addEventListener("click", handleRootClick);
    rootElement.addEventListener("keydown", handleRootKeydown);
    rootElement.addEventListener("input", handleRootInput);
    renderApp();
    loadProfileView();
  }

  initProfilePage();
})();
