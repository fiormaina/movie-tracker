(() => {
  const {
    escapeHtml,
    navigateToPage,
    renderModalShell,
    renderToasts,
    writeClipboardText,
  } = window.MovieTrackerUI;
  const { createToastController, pluralizeRu } = window.MovieTrackerHelpers;
  const { createPrimaryTabs, renderAppFooter, renderAppHeader } = window.MovieTrackerAppShell;
  const { renderEmptyMessage } = window.MovieTrackerFeedback;
  const { renderLibraryFolderCard } = window.MovieTrackerFolderCard;
  const {
    currentUser,
    deleteFolder,
    getCreateFolderUrl,
    listLibraryFolders,
    unsaveFolder,
  } = window.MovieTrackerFolders;
  const routes = window.MovieTrackerRoutes;

  const initialState = {
    tabs: createPrimaryTabs("folders"),
    filters: [
      { label: "Все", value: "all", active: true },
      { label: "Личные", value: "private", active: false },
      { label: "Сохраненные", value: "shared", active: false },
    ],
    folders: [],
    query: "",
    activeFilter: "all",
    deleteOverlay: {
      isOpen: false,
      folderId: null,
    },
    loading: true,
    toasts: [],
  };

  let state = cloneState(initialState);
  let rootElement = null;
  const showToast = createToastController(setState);

  function cloneState(value) {
    return {
      ...value,
      tabs: value.tabs.map((tab) => ({ ...tab })),
      filters: value.filters.map((filter) => ({ ...filter })),
      folders: value.folders.map((folder) => ({ ...folder, owner: folder.owner ? { ...folder.owner } : null })),
      deleteOverlay: { ...value.deleteOverlay },
      toasts: [...value.toasts],
    };
  }

  function setState(updater) {
    state = typeof updater === "function" ? updater(state) : updater;
    renderApp();
  }

  function getFolderById(id) {
    return state.folders.find((folder) => folder.id === id);
  }

  function loadFolders() {
    setState((currentState) => ({
      ...currentState,
      loading: true,
      folders: listLibraryFolders(currentUser.id),
    }));

    window.setTimeout(() => {
      setState((currentState) => ({
        ...currentState,
        folders: listLibraryFolders(currentUser.id),
        loading: false,
      }));
    }, 180);
  }

  function showPendingToast() {
    const rawToast = window.sessionStorage.getItem("movieTracker.pendingFolderToast");
    if (!rawToast) return;

    try {
      const toast = JSON.parse(rawToast);
      if (toast?.message) showToast(toast.message, toast.type || "success");
    } catch (error) {
      console.warn(error);
    } finally {
      window.sessionStorage.removeItem("movieTracker.pendingFolderToast");
    }
  }

  function getVisibleFolders() {
    const normalizedQuery = state.query.trim().toLowerCase();

    return state.folders.filter((folder) => {
      const matchesFilter = state.activeFilter === "all" || folder.access === state.activeFilter;
      const matchesQuery =
        !normalizedQuery ||
        folder.title.toLowerCase().includes(normalizedQuery) ||
        folder.ownerName.toLowerCase().includes(normalizedQuery);

      return matchesFilter && matchesQuery;
    });
  }

  function getEmptyStateCopy() {
    const hasAnyFolders = state.folders.length > 0;
    const isSearching = Boolean(state.query.trim());

    if (!hasAnyFolders) {
      return {
        title: "У вас пока нет папок",
        text: "Создайте первую папку, чтобы собирать фильмы и сериалы в отдельные подборки и делиться ими по ссылке.",
      };
    }

    if (state.activeFilter === "shared") {
      return {
        title: "Нет сохраненных папок",
        text: "Когда вы сохраните себе чужую публичную папку, она появится здесь как связанное состояние к оригиналу.",
      };
    }

    if (state.activeFilter === "private") {
      return {
        title: "Нет личных папок",
        text: "Создайте новую подборку для собственных фильмов и сериалов.",
      };
    }

    if (isSearching) {
      return {
        title: "Папки не найдены",
        text: "По этому запросу ничего не нашлось. Попробуйте изменить название или фильтр.",
      };
    }

    return {
      title: "Папки не найдены",
      text: "Попробуйте изменить поиск или фильтр.",
    };
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

  function renderFoldersSection(folders) {
    if (!folders.length) {
      const copy = getEmptyStateCopy();
      return renderEmptyMessage("folders-empty", copy.title, copy.text);
    }

    return `
      <section class="history-section">
        <h2 class="history-section__label">Мои папки</h2>
        <div class="folders-grid">
          ${folders
            .map((folder) =>
              renderLibraryFolderCard(folder, {
                countText: folder.isAccessible
                  ? `${folder.itemsCount} ${getItemWord(folder.itemsCount)}`
                  : "Доступ ограничен",
              }),
            )
            .join("")}
        </div>
      </section>
    `;
  }

  function renderDeleteOverlay(overlay) {
    if (!overlay.isOpen) return "";

    const folder = getFolderById(overlay.folderId);
    if (!folder) return "";

    const title = folder.isOwner ? "Удалить папку" : "Удалить из сохраненных";
    const text = folder.isOwner
      ? `Действительно хотите удалить ${escapeHtml(folder.title)}?`
      : `Убрать ${escapeHtml(folder.title)} из вашей библиотеки? Оригинальная папка у владельца останется без изменений.`;
    const confirmLabel = folder.isOwner ? "Удалить" : "Убрать";

    return renderModalShell(
      title,
      `
        <p class="delete-confirm">
          ${text}
        </p>
      `,
      `
        <div class="modal-card__footer modal-card__footer--split">
          <button class="modal-card__secondary" type="button" data-delete-cancel>Отмена</button>
          <button class="modal-card__confirm modal-card__confirm--danger" type="button" data-delete-confirm>
            ${confirmLabel}
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
          ${renderAppHeader({ tabs: state.tabs })}

          <div class="history-page__content">
            <section class="folders-heading" aria-label="Обзор папок">
              <div>
                <h2 class="folders-heading__title">Папки</h2>
                <p class="folders-heading__text">Собирайте фильмы и сериалы в подборки, делитесь ссылками и держите планы на просмотр в одном месте.</p>
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

            ${renderAppFooter()}
          </div>
        </div>
        ${renderToasts(state.toasts)}
        ${renderDeleteOverlay(state.deleteOverlay)}
      </div>
    `;
  }

  function getFolderWord(count) {
    return pluralizeRu(count, { one: "папка", few: "папки", many: "папок" });
  }

  function getItemWord(count) {
    return pluralizeRu(count, { one: "элемент", few: "элемента", many: "элементов" });
  }

  function renderApp() {
    if (!rootElement) return;
    rootElement.innerHTML = renderPage();
  }

  async function copyFolderLink(id) {
    const folder = getFolderById(id);
    if (!folder) return;

    if (!folder.isPublic || !folder.publicUrl) {
      showToast("Папка недоступна по ссылке", "error");
      return;
    }

    try {
      await writeClipboardText(folder.publicUrl);
      showToast("Ссылка скопирована", "success");
    } catch (error) {
      console.error(error);
      showToast("Ошибка загрузки", "error");
    }
  }

  function openDeleteOverlay(id) {
    if (!getFolderById(id)) return;

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

    const folder = getFolderById(folderId);
    if (!folder) return;

    try {
      if (folder.isOwner) {
        await deleteFolder(folderId);
      } else {
        await unsaveFolder(folderId);
      }

      setState((currentState) => ({
        ...currentState,
        folders: listLibraryFolders(currentUser.id),
        deleteOverlay: { ...initialState.deleteOverlay },
      }));
      showToast("Папка удалена", "success");
    } catch (error) {
      console.error(error);
      showToast("Ошибка доступа", "error");
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

  function openFolder(id) {
    const folder = getFolderById(id);
    if (!folder) return;
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
        navigateToPage(getCreateFolderUrl());
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
      return;
    }

    const folderCard = event.target.closest("[data-folder-card]");
    if (folderCard && !event.target.closest("button, a, input, textarea, select")) {
      openFolder(folderCard.dataset.folderCard);
    }
  }

  function handleRootKeydown(event) {
    const folderCard = event.target.closest("[data-folder-card]");
    if (!folderCard || event.target !== folderCard) return;
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    openFolder(folderCard.dataset.folderCard);
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
    rootElement.addEventListener("keydown", handleRootKeydown);
    rootElement.addEventListener("input", handleRootInput);
    renderApp();
    showPendingToast();
    loadFolders();
  }

  initFoldersPage();
})();
