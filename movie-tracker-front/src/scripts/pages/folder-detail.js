(() => {
  const { escapeHtml, navigateToPage, renderModalShell, renderToasts, writeClipboardText } = window.MovieTrackerUI;
  const { createToastController } = window.MovieTrackerHelpers;
  const {
    createPrimaryTabs,
    renderAppHeader,
    renderBackLink: renderShellBackLink,
  } = window.MovieTrackerAppShell;
  const {
    addItemToFolder,
    currentUser,
    deleteFolder,
    getFolderView,
    moveItem,
    removeItemFromFolder,
    saveFolder,
    searchMedia,
    unsaveFolder,
    updateFolder,
  } = window.MovieTrackerFolders;
  const routes = window.MovieTrackerRoutes;

  const initialState = {
    tabs: createPrimaryTabs("folders"),
    status: "loading",
    errorMessage: "",
    folder: null,
    editMode: false,
    form: {
      title: "",
      description: "",
    },
    errors: {},
    search: {
      open: false,
      query: "",
      loading: false,
      results: [],
      touched: false,
    },
    deleteOverlayOpen: false,
    pendingAction: "",
    toasts: [],
  };

  let state = cloneState(initialState);
  let rootElement = null;
  let searchTimer = 0;
  const showToast = createToastController(setState);

  function cloneState(value) {
    return {
      ...value,
      tabs: value.tabs.map((tab) => ({ ...tab })),
      folder: value.folder ? { ...value.folder, owner: { ...value.folder.owner }, items: value.folder.items.map((item) => ({ ...item })) } : null,
      form: { ...value.form },
      errors: { ...value.errors },
      search: {
        ...value.search,
        results: value.search.results.map((item) => ({ ...item })),
      },
      toasts: [...value.toasts],
    };
  }

  function setState(updater) {
    state = typeof updater === "function" ? updater(state) : updater;
    renderApp();
  }

  function getRouteParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      folderId: params.get("id") ?? "",
      publicSlug: params.get("share") ?? "",
    };
  }

  function renderBackLink() {
    return renderShellBackLink("folder-detail__back", "Папки", routes.folders);
  }

  function renderLoadingState() {
    return `
      <section class="folder-detail__loading" aria-live="polite">
        <div class="folder-detail__loading-icon" aria-hidden="true"></div>
        <h1 class="folder-detail__state-title">Загружаем папку</h1>
        <div class="folder-detail__loading-line"></div>
        <div class="folder-detail__loading-line"></div>
      </section>
    `;
  }

  function renderStateCard(title, text, actionLabel = "", action = "") {
    const actionButton = actionLabel
      ? `<button class="profile-button profile-button--primary" type="button" data-action="${escapeHtml(action)}">${escapeHtml(actionLabel)}</button>`
      : "";

    return `
      <section class="folder-detail__state" aria-live="polite">
        <div class="folder-detail__state-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 18 18" fill="none">
            <path d="M3.2 5.2H7L8.4 6.8H14.8V13.4C14.8 14.06 14.26 14.6 13.6 14.6H4.4C3.74 14.6 3.2 14.06 3.2 13.4V5.2Z" stroke="currentColor" stroke-width="1.55" stroke-linejoin="round"></path>
            <path d="M6.1 9L8.1 11L11.9 7.2" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"></path>
          </svg>
        </div>
        <h1 class="folder-detail__state-title">${escapeHtml(title)}</h1>
        <p class="folder-detail__state-text">${escapeHtml(text)}</p>
        ${actionButton}
      </section>
    `;
  }

  function renderUnavailableState() {
    if (state.status === "unavailable") {
      return renderStateCard("Недоступная ссылка", "Публичная ссылка не найдена. Возможно, она была введена с ошибкой или уже больше не существует.", "Вернуться к папкам", "go-folders");
    }

    if (state.status === "private-link") {
      return renderStateCard("Папка стала приватной", "Владелец закрыл доступ по ссылке. Сохраненные у себя пользователи по-прежнему увидят актуальное содержимое только в своей библиотеке.", "Вернуться к папкам", "go-folders");
    }

    if (state.status === "owner-deleted") {
      return renderStateCard("Владелец удалил папку", "Оригинальная публичная папка была удалена владельцем и больше недоступна ни по ссылке, ни в сохраненных.", "Вернуться к папкам", "go-folders");
    }

    if (state.status === "deleted") {
      return renderStateCard("Папка недоступна", "Публичная папка была удалена и больше не может быть открыта.", "Вернуться к папкам", "go-folders");
    }

    if (state.status === "forbidden") {
      return renderStateCard("Отсутствует доступ", "Эта папка приватная и не сохранена в вашей библиотеке.", "Вернуться к папкам", "go-folders");
    }

    if (state.status === "error") {
      return renderStateCard("Ошибка загрузки", state.errorMessage || "Не удалось загрузить папку. Попробуйте обновить страницу или вернуться позже.", "Повторить", "retry");
    }

    return renderStateCard("Папка не найдена", "Такой папки нет или ссылка больше не актуальна.", "Вернуться к папкам", "go-folders");
  }

  function renderMeta(folder) {
    return `
      <div class="folder-detail__meta">
        <span class="folder-detail__meta-chip"><strong>Владелец:</strong> ${escapeHtml(folder.ownerName)}</span>
        <span class="folder-detail__meta-chip"><strong>Статус:</strong> ${folder.isPublic ? "Публичная" : "Приватная"}</span>
        <span class="folder-detail__meta-chip"><strong>Обновлена:</strong> ${escapeHtml(folder.updatedAtLabel)}</span>
        <span class="folder-detail__meta-chip"><strong>Элементов:</strong> ${folder.itemsCount}</span>
      </div>
    `;
  }

  function renderFolderActions(folder) {
    if (folder.role === "owner") {
      return `
        <div class="folder-detail__actions">
          <button class="profile-button" type="button" data-action="toggle-search">
            ${state.search.open ? "Скрыть добавление" : "Добавить фильм или сериал"}
          </button>
          <button class="profile-button" type="button" data-action="toggle-edit">
            ${state.editMode ? "Свернуть редактирование" : "Редактировать"}
          </button>
          <button class="profile-button" type="button" data-action="toggle-privacy" ${state.pendingAction ? "disabled" : ""}>
            ${folder.isPublic ? "Сделать приватной" : "Сделать публичной"}
          </button>
          ${folder.isPublic ? `<button class="profile-button" type="button" data-action="copy-link">Копировать ссылку</button>` : ""}
          <button class="profile-button" type="button" data-action="delete-folder" ${state.pendingAction ? "disabled" : ""}>Удалить папку</button>
        </div>
      `;
    }

    if (folder.role === "saved") {
      return `
        <div class="folder-detail__actions">
          <button class="profile-button" type="button" data-action="copy-link" ${folder.isPublic ? "" : "disabled"}>Копировать ссылку</button>
          <button class="profile-button" type="button" data-action="unsave-folder" ${state.pendingAction ? "disabled" : ""}>Удалить из сохраненных</button>
        </div>
      `;
    }

    return `
      <div class="folder-detail__actions">
        <button class="profile-button" type="button" data-action="copy-link" ${folder.isPublic ? "" : "disabled"}>Копировать ссылку</button>
        <button class="profile-button profile-button--primary" type="button" data-action="save-folder" ${state.pendingAction ? "disabled" : ""}>Сохранить себе</button>
      </div>
    `;
  }

  function renderEditForm(folder) {
    if (!state.editMode || folder.role !== "owner") return "";

    return `
      <div class="folder-detail__edit">
        <label class="folder-detail__field">
          <span class="folder-detail__label">Название папки</span>
          <input class="folder-detail__input" type="text" value="${escapeHtml(state.form.title)}" data-edit-field="title" ${state.pendingAction ? "disabled" : ""} />
          ${state.errors.title ? `<span class="folder-detail__error">${escapeHtml(state.errors.title)}</span>` : ""}
        </label>
        <label class="folder-detail__field">
          <span class="folder-detail__label">Описание</span>
          <textarea class="folder-detail__textarea" data-edit-field="description" ${state.pendingAction ? "disabled" : ""}>${escapeHtml(state.form.description)}</textarea>
          <span class="folder-detail__field-hint">Описание помогает понять замысел подборки и особенно полезно для публичной папки.</span>
          ${state.errors.description ? `<span class="folder-detail__error">${escapeHtml(state.errors.description)}</span>` : ""}
        </label>
        <div class="folder-detail__edit-actions">
          <button class="profile-button" type="button" data-action="cancel-edit" ${state.pendingAction ? "disabled" : ""}>Отмена</button>
          <button class="profile-button profile-button--primary" type="button" data-action="save-edit" ${state.pendingAction ? "disabled" : ""}>
            ${state.pendingAction === "save-edit" ? "Сохраняем..." : "Сохранить изменения"}
          </button>
        </div>
      </div>
    `;
  }

  function renderNotice(folder) {
    if (!folder.linkedNotice) return "";

    return `
      <section class="folder-detail__notice" aria-label="Подсказка о режиме папки">
        <strong>${folder.role === "saved" ? "Связано с оригиналом" : "Что произойдет при сохранении"}</strong>
        <p class="folder-detail__hint">${escapeHtml(folder.linkedNotice)}</p>
      </section>
    `;
  }

  function renderSearchResult(result, folder) {
    const exists = folder.items.some((item) => item.id === result.id);
    const buttonLabel = exists ? "Уже в папке" : "Добавить";

    return `
      <article class="folder-detail__result">
        <div class="folder-detail__poster" aria-hidden="true"></div>
        <div class="folder-detail__result-main">
          <h3 class="folder-detail__result-title">${escapeHtml(result.title)}</h3>
          <p class="folder-detail__result-row">
            <span class="folder-detail__item-badge">${escapeHtml(result.typeLabel)}</span>
            <span class="folder-detail__item-badge">${escapeHtml(String(result.year))}</span>
            <span class="folder-detail__item-badge">${escapeHtml(result.watchStatusLabel)}</span>
          </p>
          <p class="folder-detail__result-meta">${escapeHtml(result.meta)}</p>
        </div>
        <div class="folder-detail__search-actions">
          <button class="profile-button ${exists ? "" : "profile-button--primary"}" type="button" data-action="add-item" data-id="${result.id}" ${state.pendingAction ? "disabled" : ""}>
            ${buttonLabel}
          </button>
        </div>
      </article>
    `;
  }

  function renderSearchPanel(folder) {
    if (folder.role !== "owner" || !state.search.open) return "";

    let content = `<p class="folder-detail__section-text">Начните вводить название, чтобы добавить фильм или сериал из существующей библиотеки.</p>`;
    if (state.search.loading) {
      content = `<p class="folder-detail__section-text">Ищем по системе...</p>`;
    } else if (state.search.touched && !state.search.results.length) {
      content = `<div class="folder-detail__empty"><div class="folder-detail__empty-icon" aria-hidden="true"></div><strong>Поиск ничего не нашел</strong><p class="folder-detail__hint">Попробуйте другое название или уточните запрос.</p></div>`;
    } else if (state.search.results.length) {
      content = `<div class="folder-detail__search-results">${state.search.results.map((item) => renderSearchResult(item, folder)).join("")}</div>`;
    }

    return `
      <section class="folder-detail__search" aria-label="Добавление контента в папку">
        <div>
          <h2 class="folder-detail__section-title">Добавить в папку</h2>
          <p class="folder-detail__section-text">Работает через поиск внутри системы и синхронизируется с кнопкой «Добавить в папку» на карточках фильмов и сериалов.</p>
        </div>
        <input class="folder-detail__search-input" type="text" value="${escapeHtml(state.search.query)}" placeholder="Поиск по названиям" data-search-input ${state.pendingAction ? "disabled" : ""} />
        ${content}
      </section>
    `;
  }

  function renderItem(item, folder) {
    const ownerControls = folder.role === "owner"
      ? `
        <div class="folder-detail__item-actions">
          <button class="folder-detail__icon-button" type="button" data-action="move-up" data-id="${item.id}" ${item.index === 0 || state.pendingAction ? "disabled" : ""} aria-label="Поднять выше">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M9 13.5V4.5M9 4.5L5.4 8.1M9 4.5L12.6 8.1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </button>
          <button class="folder-detail__icon-button" type="button" data-action="move-down" data-id="${item.id}" ${item.index === folder.items.length - 1 || state.pendingAction ? "disabled" : ""} aria-label="Опустить ниже">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M9 4.5V13.5M9 13.5L5.4 9.9M9 13.5L12.6 9.9" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </button>
          <button class="folder-detail__icon-button folder-detail__icon-button--danger" type="button" data-action="remove-item" data-id="${item.id}" ${state.pendingAction ? "disabled" : ""} aria-label="Удалить из папки">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M4.2 5.6H13.8" stroke="currentColor" stroke-width="1.55" stroke-linecap="round"></path>
              <path d="M7.2 3.8H10.8M6 5.6L6.45 14.1C6.49 14.73 7 15.2 7.63 15.2H10.37C11 15.2 11.51 14.73 11.55 14.1L12 5.6" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>
          </button>
        </div>
      `
      : "";

    return `
      <article class="folder-detail__item">
        <div class="folder-detail__poster" aria-hidden="true"></div>
        <div class="folder-detail__item-main">
          <h3 class="folder-detail__item-title">${escapeHtml(item.title)}</h3>
          <p class="folder-detail__item-row">
            <span class="folder-detail__item-badge">${escapeHtml(String(item.year))}</span>
            <span class="folder-detail__item-badge">${escapeHtml(item.typeLabel)}</span>
            <span class="folder-detail__item-badge">${escapeHtml(item.watchStatusLabel)}</span>
            ${item.userRating ? `<span class="folder-detail__item-rating"><svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true"><polygon points="7,1 8.8,5 13,5.5 10,8.4 10.9,12.5 7,10.5 3.1,12.5 4,8.4 1,5.5 5.2,5"></polygon></svg>${item.userRating}</span>` : ""}
          </p>
          <p class="folder-detail__item-meta">${escapeHtml(item.meta)}</p>
          <p class="folder-detail__item-date">Добавлено ${escapeHtml(item.addedAtLabel)}</p>
        </div>
        ${ownerControls}
      </article>
    `;
  }

  function renderItemsSection(folder) {
    const description = folder.role === "owner"
      ? "Здесь можно менять порядок, удалять позиции и дополнять папку без дубликатов."
      : "Содержимое папки доступно только для просмотра. Управление остается у владельца оригинала.";

    const emptyTitle = folder.role === "owner" ? "Папка пока пустая" : "В этой папке пока ничего нет";
    const emptyText = folder.role === "owner"
      ? "Добавьте фильмы или сериалы через поиск выше либо из карточек контента по кнопке «Добавить в папку»."
      : "Владелец еще не добавил элементы в папку или очистил подборку.";

    const listContent = folder.items.length
      ? `<div class="folder-detail__items">${folder.items.map((item) => renderItem(item, folder)).join("")}</div>`
      : `
        <div class="folder-detail__empty" aria-live="polite">
          <div class="folder-detail__empty-icon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 18 18" fill="none">
              <path d="M3.2 5.2H7L8.4 6.8H14.8V13.4C14.8 14.06 14.26 14.6 13.6 14.6H4.4C3.74 14.6 3.2 14.06 3.2 13.4V5.2Z" stroke="currentColor" stroke-width="1.55" stroke-linejoin="round"></path>
              <path d="M9 7V11M7 9H11" stroke="currentColor" stroke-width="1.55" stroke-linecap="round"></path>
            </svg>
          </div>
          <strong>${emptyTitle}</strong>
          <p class="folder-detail__hint">${emptyText}</p>
        </div>
      `;

    return `
      <section class="folder-detail__section">
        <div class="folder-detail__section-head">
          <div>
            <h2 class="folder-detail__section-title">Содержимое папки</h2>
            <p class="folder-detail__section-text">${description}</p>
          </div>
        </div>
        ${renderSearchPanel(folder)}
        ${listContent}
      </section>
    `;
  }

  function renderDeleteOverlay() {
    if (!state.deleteOverlayOpen || !state.folder) return "";

    return renderModalShell(
      "Удалить папку",
      `
        <p class="delete-confirm">
          Папка «${escapeHtml(state.folder.title)}» будет удалена полностью. Если она была публичной, ссылка перестанет работать.
        </p>
      `,
      `
        <div class="modal-card__footer modal-card__footer--split">
          <button class="modal-card__secondary" type="button" data-action="close-delete">Отмена</button>
          <button class="modal-card__confirm modal-card__confirm--danger" type="button" data-action="confirm-delete" ${state.pendingAction ? "disabled" : ""}>
            ${state.pendingAction === "delete-folder" ? "Удаляем..." : "Удалить"}
          </button>
        </div>
      `,
      "folder-delete",
    );
  }

  function renderFolder() {
    const folder = state.folder;
    if (!folder) return renderUnavailableState();

    return `
      ${renderNotice(folder)}
      <section class="folder-detail__hero">
        <div class="folder-detail__hero-top">
          <div>
            <span class="folder-detail__eyebrow">${folder.role === "owner" ? "Моя папка" : folder.role === "saved" ? "Сохраненная папка" : "Публичная папка"}</span>
            <h1 class="folder-detail__title">${escapeHtml(folder.title)}</h1>
            <p class="folder-detail__description">${escapeHtml(folder.description || "Описание пока не добавлено.")}</p>
          </div>
          ${renderFolderActions(folder)}
        </div>
        ${renderMeta(folder)}
        ${renderEditForm(folder)}
      </section>
      ${renderItemsSection(folder)}
    `;
  }

  function renderContent() {
    if (state.status === "loading") return renderLoadingState();
    if (state.status !== "ok") return renderUnavailableState();
    return renderFolder();
  }

  function renderPage() {
    return `
      <div class="history-page folder-detail-page">
        <h1 class="sr-only">Папка Movie Tracker</h1>
        <div class="history-page__shell">
          ${renderAppHeader({ tabs: state.tabs })}

          <div class="history-page__content">
            <section class="folder-detail">
              ${renderBackLink()}
              ${renderContent()}
            </section>
          </div>
        </div>
        ${renderToasts(state.toasts)}
        ${renderDeleteOverlay()}
      </div>
    `;
  }

  function renderApp() {
    if (!rootElement) return;
    rootElement.innerHTML = renderPage();
  }

  function restoreSearchFocus() {
    const input = rootElement?.querySelector("[data-search-input]");
    if (!input) return;
    const valueLength = input.value.length;
    input.focus();
    input.setSelectionRange(valueLength, valueLength);
  }

  function syncEditForm(folder) {
    state.form.title = folder.title;
    state.form.description = folder.description;
    state.errors = {};
  }

  function updateFolderInState(folder) {
    setState((currentState) => ({
      ...currentState,
      folder,
      pendingAction: "",
      deleteOverlayOpen: false,
    }));
  }

  function loadFolder() {
    const route = getRouteParams();

    setState((currentState) => ({
      ...currentState,
      status: "loading",
      errorMessage: "",
      deleteOverlayOpen: false,
      pendingAction: "",
    }));

    window.setTimeout(() => {
      try {
        const result = getFolderView({
          folderId: route.folderId,
          publicSlug: route.publicSlug,
          viewerId: currentUser.id,
        });

        if (result.status === "ok") {
          setState((currentState) => ({
            ...currentState,
            status: "ok",
            folder: result.folder,
            editMode: false,
            errors: {},
            search: {
              ...currentState.search,
              open: result.folder.role === "owner" ? currentState.search.open : false,
              loading: false,
              results: [],
              query: "",
              touched: false,
            },
          }));
          syncEditForm(result.folder);
          renderApp();
          return;
        }

        setState((currentState) => ({
          ...currentState,
          status: result.status,
          folder: null,
        }));
      } catch (error) {
        console.error(error);
        setState((currentState) => ({
          ...currentState,
          status: "error",
          errorMessage: error.message,
          folder: null,
        }));
      }
    }, 220);
  }

  function storePendingToast(message, type = "success") {
    window.sessionStorage.setItem("movieTracker.pendingFolderToast", JSON.stringify({ message, type }));
  }

  function openDeleteOverlay() {
    setState((currentState) => ({
      ...currentState,
      deleteOverlayOpen: true,
    }));
  }

  function closeDeleteOverlay() {
    if (state.pendingAction) return;
    setState((currentState) => ({
      ...currentState,
      deleteOverlayOpen: false,
    }));
  }

  function toggleEditMode() {
    if (!state.folder || state.folder.role !== "owner") return;

    if (!state.editMode) {
      syncEditForm(state.folder);
    }

    setState((currentState) => ({
      ...currentState,
      editMode: !currentState.editMode,
      errors: {},
    }));
  }

  async function saveEdit() {
    if (!state.folder || state.folder.role !== "owner" || state.pendingAction) return;

    setState((currentState) => ({
      ...currentState,
      pendingAction: "save-edit",
      errors: {},
    }));

    try {
      const folder = await updateFolder(state.folder.id, {
        title: state.form.title,
        description: state.form.description,
        visibility: state.folder.isPublic ? "public" : "private",
      });
      setState((currentState) => ({
        ...currentState,
        folder,
        editMode: false,
        pendingAction: "",
      }));
      showToast("Изменения сохранены", "success");
    } catch (error) {
      console.error(error);
      if (error.code === "validation") {
        setState((currentState) => ({
          ...currentState,
          errors: { ...(error.errors ?? {}) },
          pendingAction: "",
        }));
        return;
      }

      setState((currentState) => ({
        ...currentState,
        pendingAction: "",
      }));
      showToast("Ошибка загрузки", "error");
    }
  }

  async function togglePrivacy() {
    if (!state.folder || state.folder.role !== "owner" || state.pendingAction) return;

    setState((currentState) => ({
      ...currentState,
      pendingAction: "toggle-privacy",
    }));

    try {
      const folder = await updateFolder(state.folder.id, {
        title: state.folder.title,
        description: state.folder.description,
        visibility: state.folder.isPublic ? "private" : "public",
      });
      setState((currentState) => ({
        ...currentState,
        folder,
        pendingAction: "",
      }));
      syncEditForm(folder);
      showToast("Изменения сохранены", "success");
    } catch (error) {
      console.error(error);
      setState((currentState) => ({
        ...currentState,
        pendingAction: "",
      }));
      showToast("Ошибка доступа", "error");
    }
  }

  async function copyLink() {
    if (!state.folder?.publicUrl) {
      showToast("Папка недоступна по ссылке", "error");
      return;
    }

    try {
      await writeClipboardText(state.folder.publicUrl);
      showToast("Ссылка скопирована", "success");
    } catch (error) {
      console.error(error);
      showToast("Ошибка загрузки", "error");
    }
  }

  async function savePublicFolder() {
    if (!state.folder || state.pendingAction) return;

    setState((currentState) => ({
      ...currentState,
      pendingAction: "save-folder",
    }));

    try {
      const result = await saveFolder(state.folder.id);
      if (result.status === "already-saved") {
        setState((currentState) => ({
          ...currentState,
          folder: result.folder,
          pendingAction: "",
        }));
        showToast("Папка уже сохранена", "success");
        return;
      }

      setState((currentState) => ({
        ...currentState,
        folder: result.folder,
        pendingAction: "",
      }));
      showToast("Папка сохранена", "success");
    } catch (error) {
      console.error(error);
      setState((currentState) => ({
        ...currentState,
        pendingAction: "",
      }));
      showToast(error.code === "access" ? "Ошибка доступа" : "Папка недоступна", "error");
    }
  }

  async function removeSavedFolder() {
    if (!state.folder || state.pendingAction) return;

    setState((currentState) => ({
      ...currentState,
      pendingAction: "unsave-folder",
    }));

    try {
      await unsaveFolder(state.folder.id);
      storePendingToast("Папка удалена", "success");
      navigateToPage(routes.folders);
    } catch (error) {
      console.error(error);
      setState((currentState) => ({
        ...currentState,
        pendingAction: "",
      }));
      showToast("Ошибка доступа", "error");
    }
  }

  async function confirmDeleteFolder() {
    if (!state.folder || state.pendingAction) return;

    setState((currentState) => ({
      ...currentState,
      pendingAction: "delete-folder",
    }));

    try {
      await deleteFolder(state.folder.id);
      storePendingToast("Папка удалена", "success");
      navigateToPage(routes.folders);
    } catch (error) {
      console.error(error);
      setState((currentState) => ({
        ...currentState,
        pendingAction: "",
      }));
      showToast(error.code === "access" ? "Ошибка доступа" : "Ошибка загрузки", "error");
    }
  }

  function toggleSearch() {
    if (!state.folder || state.folder.role !== "owner") return;

    setState((currentState) => ({
      ...currentState,
      search: {
        ...currentState.search,
        open: !currentState.search.open,
      },
    }));
  }

  function runSearch(query) {
    window.clearTimeout(searchTimer);

    setState((currentState) => ({
      ...currentState,
      search: {
        ...currentState.search,
        query,
        loading: Boolean(query.trim()),
        touched: Boolean(query.trim()),
      },
    }));
    window.requestAnimationFrame(restoreSearchFocus);

    searchTimer = window.setTimeout(() => {
      const results = query.trim() ? searchMedia(query) : [];
      setState((currentState) => ({
        ...currentState,
        search: {
          ...currentState.search,
          loading: false,
          results,
        },
      }));
      window.requestAnimationFrame(restoreSearchFocus);
    }, 180);
  }

  async function handleAddItem(mediaId) {
    if (!state.folder || state.folder.role !== "owner" || state.pendingAction) return;

    setState((currentState) => ({
      ...currentState,
      pendingAction: `add-item:${mediaId}`,
    }));

    try {
      const result = await addItemToFolder(state.folder.id, mediaId);
      if (result.status === "duplicate") {
        setState((currentState) => ({
          ...currentState,
          folder: result.folder,
          pendingAction: "",
        }));
        showToast("Элемент уже добавлен", "success");
        return;
      }

      setState((currentState) => ({
        ...currentState,
        folder: result.folder,
        pendingAction: "",
      }));
      runSearch(state.search.query);
      showToast("Изменения сохранены", "success");
    } catch (error) {
      console.error(error);
      setState((currentState) => ({
        ...currentState,
        pendingAction: "",
      }));
      showToast(error.code === "access" ? "Ошибка доступа" : "Ошибка загрузки", "error");
    }
  }

  async function handleRemoveItem(mediaId) {
    if (!state.folder || state.folder.role !== "owner" || state.pendingAction) return;

    setState((currentState) => ({
      ...currentState,
      pendingAction: `remove-item:${mediaId}`,
    }));

    try {
      const folder = await removeItemFromFolder(state.folder.id, mediaId);
      updateFolderInState(folder);
      runSearch(state.search.query);
      showToast("Изменения сохранены", "success");
    } catch (error) {
      console.error(error);
      setState((currentState) => ({
        ...currentState,
        pendingAction: "",
      }));
      showToast("Ошибка доступа", "error");
    }
  }

  async function handleMoveItem(mediaId, direction) {
    if (!state.folder || state.folder.role !== "owner" || state.pendingAction) return;

    setState((currentState) => ({
      ...currentState,
      pendingAction: `${direction}:${mediaId}`,
    }));

    try {
      const folder = await moveItem(state.folder.id, mediaId, direction);
      updateFolderInState(folder);
      showToast("Изменения сохранены", "success");
    } catch (error) {
      console.error(error);
      setState((currentState) => ({
        ...currentState,
        pendingAction: "",
      }));
      showToast("Ошибка доступа", "error");
    }
  }

  function handleRootClick(event) {
    const navButton = event.target.closest("[data-nav-url]");
    if (navButton) {
      navigateToPage(navButton.dataset.navUrl);
      return;
    }

    if (event.target.dataset.modalBackdrop === "folder-delete") {
      closeDeleteOverlay();
      return;
    }

    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;

    const action = actionButton.dataset.action;
    const id = actionButton.dataset.id;

    if (action === "retry") {
      loadFolder();
      return;
    }

    if (action === "go-folders") {
      navigateToPage(routes.folders);
      return;
    }

    if (action === "toggle-edit") {
      toggleEditMode();
      return;
    }

    if (action === "cancel-edit") {
      syncEditForm(state.folder);
      setState((currentState) => ({
        ...currentState,
        editMode: false,
        errors: {},
      }));
      return;
    }

    if (action === "save-edit") {
      saveEdit();
      return;
    }

    if (action === "toggle-privacy") {
      togglePrivacy();
      return;
    }

    if (action === "copy-link") {
      copyLink();
      return;
    }

    if (action === "save-folder") {
      savePublicFolder();
      return;
    }

    if (action === "unsave-folder") {
      removeSavedFolder();
      return;
    }

    if (action === "delete-folder") {
      openDeleteOverlay();
      return;
    }

    if (action === "confirm-delete") {
      confirmDeleteFolder();
      return;
    }

    if (action === "close-delete") {
      closeDeleteOverlay();
      return;
    }

    if (action === "toggle-search") {
      toggleSearch();
      return;
    }

    if (action === "add-item") {
      handleAddItem(id);
      return;
    }

    if (action === "remove-item") {
      handleRemoveItem(id);
      return;
    }

    if (action === "move-up") {
      handleMoveItem(id, "up");
      return;
    }

    if (action === "move-down") {
      handleMoveItem(id, "down");
    }
  }

  function handleRootInput(event) {
    const editField = event.target.closest("[data-edit-field]");
    if (editField) {
      state.form[editField.dataset.editField] = editField.value;
      delete state.errors[editField.dataset.editField];
      return;
    }

    const searchInput = event.target.closest("[data-search-input]");
    if (searchInput) {
      runSearch(searchInput.value);
    }
  }

  function initPendingToast() {
    const rawToast = window.sessionStorage.getItem("movieTracker.pendingFolderToast");
    if (!rawToast) return;

    try {
      const toast = JSON.parse(rawToast);
      if (toast?.message) {
        showToast(toast.message, toast.type || "success");
      }
    } catch (error) {
      console.warn(error);
    } finally {
      window.sessionStorage.removeItem("movieTracker.pendingFolderToast");
    }
  }

  function initFolderDetailPage() {
    rootElement = document.querySelector("#folder-detail-app");
    if (!rootElement) return;

    rootElement.addEventListener("click", handleRootClick);
    rootElement.addEventListener("input", handleRootInput);
    renderApp();
    initPendingToast();
    loadFolder();
  }

  initFolderDetailPage();
})();
