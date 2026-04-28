(() => {
  const { renderTabs } = window.MovieTrackerUI;
  const routes = window.MovieTrackerRoutes;

  function renderUserAvatarIcon(size = 18) {
    return `
      <svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <circle cx="10" cy="7" r="4" fill="rgba(255,255,255,0.92)"></circle>
        <path d="M2 18c0-4 3.6-7 8-7s8 3 8 7" stroke="rgba(255,255,255,0.92)" stroke-width="1.5" stroke-linecap="round"></path>
      </svg>
    `;
  }

  function createPrimaryTabs(activeSection = "") {
    return [
      {
        label: "История просмотра",
        active: activeSection === "history",
        static: activeSection === "history",
        url: activeSection === "history" ? "" : routes.watchHistory,
      },
      {
        label: "Папки",
        active: activeSection === "folders",
        static: activeSection === "folders",
        url: activeSection === "folders" ? "" : routes.folders,
      },
    ];
  }

  function renderAppHeader({
    tabs = createPrimaryTabs(),
    profileUrl = routes.profile(),
    profileActive = false,
  } = {}) {
    return `
      <header class="history-page__navbar">
        <div class="history-page__logo" aria-hidden="true"></div>
        <nav class="history-page__tabs" aria-label="Навигация по разделам">
          ${renderTabs(tabs)}
        </nav>
        <button
          class="history-page__avatar ${profileActive ? "history-page__avatar--active" : ""}"
          type="button"
          data-nav-url="${profileUrl}"
          aria-label="Открыть профиль"
        >
          ${renderUserAvatarIcon(18)}
        </button>
      </header>
    `;
  }

  function renderAppFooter(year = "2026") {
    return `
      <footer class="history-footer">
        <div class="history-footer__links">
          <a href="#">О проекте</a>
          <a href="#">Контакты</a>
        </div>
        <div class="history-footer__year">${year}</div>
      </footer>
    `;
  }

  function renderBackLink(className, label, url) {
    return `
      <a class="${className}" href="${url}" data-nav-url="${url}">
        <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <path d="M11 4L6 9L11 14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
        ${label}
      </a>
    `;
  }

  window.MovieTrackerAppShell = {
    createPrimaryTabs,
    renderAppFooter,
    renderAppHeader,
    renderBackLink,
    renderUserAvatarIcon,
  };
})();
