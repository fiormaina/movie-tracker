(() => {
  const { escapeHtml, navigateToPage, renderToasts, writeClipboardText } = window.MovieTrackerUI;
  const { createToastController } = window.MovieTrackerHelpers;
  const { createPrimaryTabs, renderAppHeader, renderBackLink } = window.MovieTrackerAppShell;
  const { createFolder, getCreateFolderUrl, getFolderLimits, getFolderPageUrl, currentUser } = window.MovieTrackerFolders;
  const routes = window.MovieTrackerRoutes;

  const limits = getFolderLimits();
  const initialState = {
    tabs: createPrimaryTabs("folders"),
    form: {
      title: "",
      description: "",
      visibility: "private",
    },
    errors: {},
    loading: false,
    createdFolder: null,
    toasts: [],
  };

  let state = cloneState(initialState);
  let rootElement = null;
  const showToast = createToastController(setState);

  function cloneState(value) {
    return {
      ...value,
      tabs: value.tabs.map((tab) => ({ ...tab })),
      form: { ...value.form },
      errors: { ...value.errors },
      toasts: [...value.toasts],
    };
  }

  function setState(updater) {
    state = typeof updater === "function" ? updater(state) : updater;
    renderApp();
  }

  function canSubmit() {
    return !state.loading && state.form.title.trim().length > 0;
  }

  function renderPublicInfo() {
    if (state.form.visibility !== "public") return "";

    return `
      <div class="folder-create__public-note">
        <strong>Публичная папка работает по ссылке на оригинал</strong>
        <p class="folder-create__hint">После создания появится уникальная ссылка. Если другой пользователь сохранит такую папку себе, это будет не копия, а связанное состояние с оригиналом.</p>
        <ul class="folder-create__public-list">
          <li>обновления владельца отразятся у всех, кто сохранил папку;</li>
          <li>редактирование и смена приватности доступны только владельцу;</li>
          <li>после создания можно сразу скопировать ссылку и открыть страницу папки.</li>
        </ul>
      </div>
    `;
  }

  function renderFieldError(fieldName) {
    const message = state.errors[fieldName];
    return message ? `<span class="folder-create__error">${escapeHtml(message)}</span>` : "";
  }

  function renderCreateForm() {
    const isPublic = state.form.visibility === "public";
    const titleLength = state.form.title.length;
    const descriptionLength = state.form.description.length;

    return `
      <section class="folder-create__panel">
        <span class="folder-create__eyebrow">Новая папка</span>
        <h1 class="folder-create__title">Создать папку</h1>
        <p class="folder-create__text">Соберите фильмы и сериалы в отдельную подборку, а при необходимости сразу подготовьте публичную ссылку для обмена.</p>

        <form class="folder-create__form" novalidate>
          <label class="folder-create__field">
            <span class="folder-create__label">Название папки <span aria-hidden="true">*</span></span>
            <input
              class="folder-create__input ${state.errors.title ? "folder-create__input--error" : ""}"
              type="text"
              value="${escapeHtml(state.form.title)}"
              maxlength="${limits.titleMaxLength + 12}"
              placeholder="Например, Для длинных выходных"
              data-field="title"
              ${state.loading ? "disabled" : ""}
            />
            <span class="folder-create__counter">${titleLength}/${limits.titleMaxLength}</span>
            ${renderFieldError("title")}
          </label>

          <label class="folder-create__field">
            <span class="folder-create__label">Описание</span>
            <textarea
              class="folder-create__textarea ${state.errors.description ? "folder-create__textarea--error" : ""}"
              maxlength="${limits.descriptionMaxLength + 20}"
              placeholder="Коротко опишите, что находится в папке"
              data-field="description"
              ${state.loading ? "disabled" : ""}
            >${escapeHtml(state.form.description)}</textarea>
            <span class="folder-create__counter">${descriptionLength}/${limits.descriptionMaxLength}</span>
            <span class="folder-create__helper">Описание необязательно, но помогает понять смысл папки и особенно полезно для публичной ссылки.</span>
            ${renderFieldError("description")}
          </label>

          <section class="folder-create__section" aria-label="Тип папки">
            <span class="folder-create__section-label">Тип папки</span>
            <div class="folder-create__switch">
              <button
                class="folder-create__switch-button ${!isPublic ? "folder-create__switch-button--active" : ""}"
                type="button"
                data-visibility="private"
                ${state.loading ? "disabled" : ""}
              >
                Приватная
              </button>
              <button
                class="folder-create__switch-button ${isPublic ? "folder-create__switch-button--active" : ""}"
                type="button"
                data-visibility="public"
                ${state.loading ? "disabled" : ""}
              >
                Публичная
              </button>
            </div>
            <span class="folder-create__helper">${isPublic ? "Папка будет доступна по ссылке и ее смогут сохранить себе другие пользователи." : "Папка останется только в вашей библиотеке и не будет открываться по ссылке."}</span>
            ${renderFieldError("visibility")}
            ${renderPublicInfo()}
          </section>

          <div class="folder-create__actions">
            <button class="profile-button" type="button" data-action="cancel" ${state.loading ? "disabled" : ""}>Отмена</button>
            <button class="profile-button profile-button--primary" type="button" data-action="submit" ${canSubmit() ? "" : "disabled"}>
              ${state.loading ? "Создаем..." : "Создать папку"}
            </button>
          </div>
        </form>
      </section>
    `;
  }

  function renderAside() {
    return `
      <aside class="folder-create__aside" aria-label="Подсказки по созданию папки">
        <div>
          <h2 class="folder-create__aside-title">Что увидит пользователь</h2>
          <p class="folder-create__aside-text">Вы создаете папку как ${escapeHtml(currentUser.displayName)}. Для публичного режима ссылка будет вести на одну и ту же оригинальную папку.</p>
        </div>
        <div class="folder-create__aside-note">
          <strong>Linked-state вместо копии</strong>
          <p class="folder-create__hint">Когда другой пользователь сохраняет публичную папку себе, он подписывается на оригинал. Это значит:</p>
          <ul class="folder-create__aside-list">
            <li>новые элементы владельца появляются у всех сохранивших;</li>
            <li>чужие пользователи не могут редактировать состав и настройки;</li>
            <li>если владелец сделает папку приватной или удалит ее, ссылка перестанет быть доступной.</li>
          </ul>
        </div>
        <div class="folder-create__aside-note">
          <strong>Проверки формы</strong>
          <p class="folder-create__hint">Название обязательно. Для одинаковых названий внутри вашей библиотеки показывается ошибка, чтобы избежать дубликатов.</p>
        </div>
      </aside>
    `;
  }

  function renderSuccess() {
    const folder = state.createdFolder;
    if (!folder) return "";

    const linkBlock = folder.isPublic
      ? `
        <div class="folder-create__success-link">
          <strong>Публичная ссылка</strong>
          <p class="folder-create__link-value">${escapeHtml(folder.publicUrl)}</p>
          <div class="folder-create__link-actions">
            <button class="profile-button" type="button" data-action="copy-link">Копировать ссылку</button>
          </div>
        </div>
      `
      : "";

    return `
      <section class="folder-create__success" aria-live="polite">
        <div class="folder-create__success-block">
          <h1 class="folder-create__success-title">Папка создана</h1>
          <p class="folder-create__meta">Папка «${escapeHtml(folder.title)}» добавлена в вашу библиотеку${folder.isPublic ? " и готова к публикации по ссылке." : "."}</p>
        </div>
        ${linkBlock}
        <div class="folder-create__success-block">
          <strong>Как это будет работать дальше</strong>
          <p class="folder-create__meta">${folder.isPublic ? "Те, кто сохранят папку по ссылке, будут видеть ваши обновления как связанное состояние к оригиналу." : "Папка приватная и доступна только вам, пока вы сами не сделаете ее публичной."}</p>
        </div>
        <div class="folder-create__success-actions">
          <button class="profile-button" type="button" data-action="create-another">Создать еще одну</button>
          <button class="profile-button profile-button--primary" type="button" data-action="open-folder">Открыть папку</button>
        </div>
      </section>
    `;
  }

  function renderPage() {
    return `
      <div class="history-page folder-create-page">
        <h1 class="sr-only">Создание папки Movie Tracker</h1>
        <div class="history-page__shell">
          ${renderAppHeader({ tabs: state.tabs })}

          <div class="history-page__content">
            <section class="folder-create">
              ${renderBackLink("folder-create__back", "Папки", routes.folders)}
              <div class="folder-create__layout">
                ${state.createdFolder ? renderSuccess() : renderCreateForm()}
                ${state.createdFolder ? renderAside() : renderAside()}
              </div>
            </section>
          </div>
        </div>
        ${renderToasts(state.toasts)}
      </div>
    `;
  }

  function renderApp() {
    if (!rootElement) return;
    rootElement.innerHTML = renderPage();
  }

  function updateField(fieldName, value) {
    state.form[fieldName] = value;
    delete state.errors[fieldName];
    renderApp();
  }

  function restoreFieldFocus(fieldName, selectionStart, selectionEnd) {
    const nextField = rootElement?.querySelector(`[data-field="${fieldName}"]`);
    if (!nextField) return;

    nextField.focus();
    if (typeof selectionStart === "number" && typeof nextField.setSelectionRange === "function") {
      nextField.setSelectionRange(selectionStart, selectionEnd ?? selectionStart);
    }
  }

  async function handleSubmit() {
    if (state.loading) return;

    setState((currentState) => ({
      ...currentState,
      loading: true,
      errors: {},
    }));

    try {
      const folder = await createFolder(state.form);
      setState((currentState) => ({
        ...currentState,
        loading: false,
        createdFolder: folder,
        form: { ...initialState.form },
      }));
      showToast("Папка создана", "success");
    } catch (error) {
      console.error(error);
      if (error.code === "validation") {
        setState((currentState) => ({
          ...currentState,
          loading: false,
          errors: { ...(error.errors ?? {}) },
        }));
        return;
      }

      setState((currentState) => ({
        ...currentState,
        loading: false,
      }));
      showToast("Ошибка загрузки", "error");
    }
  }

  async function copyPublicLink() {
    if (!state.createdFolder?.publicUrl) return;

    try {
      await writeClipboardText(state.createdFolder.publicUrl);
      showToast("Ссылка скопирована", "success");
    } catch (error) {
      console.error(error);
      showToast("Ошибка загрузки", "error");
    }
  }

  function openCreatedFolder() {
    if (!state.createdFolder) return;
    navigateToPage(getFolderPageUrl(state.createdFolder.id));
  }

  function resetForm() {
    setState(cloneState(initialState));
  }

  function handleRootClick(event) {
    const navButton = event.target.closest("[data-nav-url]");
    if (navButton) {
      navigateToPage(navButton.dataset.navUrl);
      return;
    }

    const visibilityButton = event.target.closest("[data-visibility]");
    if (visibilityButton) {
      updateField("visibility", visibilityButton.dataset.visibility);
      return;
    }

    const actionButton = event.target.closest("[data-action]");
    if (!actionButton) return;

    const action = actionButton.dataset.action;

    if (action === "submit") {
      handleSubmit();
      return;
    }

    if (action === "cancel") {
      navigateToPage(routes.folders);
      return;
    }

    if (action === "copy-link") {
      copyPublicLink();
      return;
    }

    if (action === "open-folder") {
      openCreatedFolder();
      return;
    }

    if (action === "create-another") {
      navigateToPage(getCreateFolderUrl(), { force: true });
      resetForm();
    }
  }

  function handleRootInput(event) {
    const field = event.target.closest("[data-field]");
    if (!field) return;

    const selectionStart = field.selectionStart;
    const selectionEnd = field.selectionEnd;
    updateField(field.dataset.field, field.value);
    restoreFieldFocus(field.dataset.field, selectionStart, selectionEnd);
  }

  function initFolderCreatePage() {
    rootElement = document.querySelector("#folder-create-app");
    if (!rootElement) return;

    rootElement.addEventListener("click", handleRootClick);
    rootElement.addEventListener("input", handleRootInput);
    renderApp();
  }

  initFolderCreatePage();
})();
