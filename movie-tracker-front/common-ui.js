(() => {
  const DEFAULT_LOCAL_API_BASE_URL = "http://127.0.0.1:8000";
  const API_BASE_URL_STORAGE_KEY = "movieTracker.apiBaseUrl";

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function renderTabs(tabs) {
    return tabs
      .map((tab) => {
        const activeClass = tab.active ? "history-page__tab--active" : "";
        const staticClass = tab.static ? "history-page__tab--static" : "";
        const navAttribute = tab.url ? `data-nav-url="${escapeHtml(tab.url)}"` : "";

        return `
          <button
            class="history-page__tab ${activeClass} ${staticClass}"
            type="button"
            ${navAttribute}
          >
            ${escapeHtml(tab.label)}
          </button>
        `;
      })
      .join("");
  }

  function renderToasts(toasts) {
    return `
      <div class="toast-stack" aria-live="polite" aria-atomic="true">
        ${toasts
          .map(
            (toast) => `
              <div class="toast toast--${escapeHtml(toast.type)}">
                ${escapeHtml(toast.message)}
              </div>
            `,
          )
          .join("")}
      </div>
    `;
  }

  function renderModalShell(title, body, footer, modalType) {
    const safeTitle = escapeHtml(title);
    const safeModalType = escapeHtml(modalType);

    return `
      <div class="modal-backdrop" data-modal-backdrop="${safeModalType}">
        <section class="modal-card" role="dialog" aria-modal="true" aria-label="${safeTitle}">
          <button class="modal-card__close" type="button" data-modal-close="${safeModalType}" aria-label="Закрыть">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <path d="M4.5 4.5L13.5 13.5M13.5 4.5L4.5 13.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></path>
            </svg>
          </button>
          <h2 class="modal-card__title">${safeTitle}</h2>
          ${body}
          ${footer}
        </section>
      </div>
    `;
  }

  async function writeClipboardText(text) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch (error) {
        console.warn(error);
      }
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-9999px";
    document.body.append(textarea);
    textarea.select();

    const isCopied = document.execCommand("copy");
    textarea.remove();

    if (!isCopied) {
      throw new Error("Clipboard copy failed");
    }
  }

  function autoSizeTextarea(textarea, maxHeight = 180) {
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
    textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }

  function normalizeApiBaseUrl(value) {
    return String(value || "")
      .trim()
      .replace(/\/+$/, "");
  }

  function persistApiBaseUrl(apiBaseUrl) {
    if (!apiBaseUrl) return;

    try {
      localStorage.setItem(API_BASE_URL_STORAGE_KEY, apiBaseUrl);
    } catch (error) {
      console.warn(error);
    }
  }

  function readStoredApiBaseUrl() {
    try {
      return normalizeApiBaseUrl(localStorage.getItem(API_BASE_URL_STORAGE_KEY));
    } catch (error) {
      console.warn(error);
      return "";
    }
  }

  function resolveApiBaseUrl() {
    const url = new URL(window.location.href);
    const queryValue = normalizeApiBaseUrl(url.searchParams.get("apiBaseUrl"));
    if (queryValue) {
      persistApiBaseUrl(queryValue);
      return queryValue;
    }

    const metaValue = normalizeApiBaseUrl(
      document.querySelector('meta[name="movie-tracker-api-base-url"]')?.content,
    );
    if (metaValue) {
      persistApiBaseUrl(metaValue);
      return metaValue;
    }

    const globalValue = normalizeApiBaseUrl(window.MOVIE_TRACKER_API_BASE_URL);
    if (globalValue) {
      persistApiBaseUrl(globalValue);
      return globalValue;
    }

    return readStoredApiBaseUrl() || DEFAULT_LOCAL_API_BASE_URL;
  }

  function getApiConfigurationError(apiBaseUrl = resolveApiBaseUrl()) {
    if (window.location.protocol === "https:" && apiBaseUrl.startsWith("http://")) {
      return `На GitHub Pages нужен HTTPS-адрес backend API. Сейчас фронт настроен на ${apiBaseUrl}. Добавьте ?apiBaseUrl=https://ваш-backend или сохраните его в localStorage по ключу movieTracker.apiBaseUrl.`;
    }

    return "";
  }

  const pageScriptCache = new Map();
  let navigationToken = 0;

  function getCurrentAppRoot() {
    return document.querySelector("main[id$='-app']");
  }

  function getPageContent(root) {
    return root?.querySelector(".history-page__content");
  }

  function getRouteKind(url) {
    const pathname = new URL(url, window.location.href).pathname;
    if (pathname.endsWith("/folders.html")) return "folders";
    if (pathname.endsWith("/profile.html")) return "profile";
    if (pathname.endsWith("/movie-detail.html")) return "detail";
    return "history";
  }

  function renderSkeletonBlock(className = "") {
    return `<span class="skeleton-block ${className}" aria-hidden="true"></span>`;
  }

  function renderNavigationSkeleton(url) {
    const routeKind = getRouteKind(url);

    if (routeKind === "detail") {
      return `
        <div class="page-skeleton page-skeleton--detail" aria-hidden="true">
          ${renderSkeletonBlock("page-skeleton__back")}
          <div class="page-skeleton__detail-card">
            ${renderSkeletonBlock("page-skeleton__poster")}
            <div class="page-skeleton__detail-main">
              ${renderSkeletonBlock("page-skeleton__title")}
              ${renderSkeletonBlock("page-skeleton__line")}
              ${renderSkeletonBlock("page-skeleton__line page-skeleton__line--wide")}
              ${renderSkeletonBlock("page-skeleton__button")}
            </div>
            ${renderSkeletonBlock("page-skeleton__aside")}
          </div>
        </div>
      `;
    }

    if (routeKind === "profile") {
      return `
        <div class="page-skeleton" aria-hidden="true">
          <div class="page-skeleton__hero">
            ${renderSkeletonBlock("page-skeleton__avatar")}
            <div>
              ${renderSkeletonBlock("page-skeleton__title")}
              ${renderSkeletonBlock("page-skeleton__line")}
            </div>
          </div>
          <div class="page-skeleton__grid page-skeleton__grid--three">
            ${renderSkeletonBlock("page-skeleton__card")}
            ${renderSkeletonBlock("page-skeleton__card")}
            ${renderSkeletonBlock("page-skeleton__card")}
          </div>
        </div>
      `;
    }

    return `
      <div class="page-skeleton" aria-hidden="true">
        <div class="page-skeleton__heading">
          <div>
            ${renderSkeletonBlock("page-skeleton__title")}
            ${renderSkeletonBlock("page-skeleton__line")}
          </div>
          ${renderSkeletonBlock("page-skeleton__stat")}
        </div>
        <div class="page-skeleton__toolbar">
          ${renderSkeletonBlock("page-skeleton__search")}
          ${renderSkeletonBlock("page-skeleton__button")}
          ${renderSkeletonBlock("page-skeleton__filter")}
        </div>
        <div class="page-skeleton__grid">
          ${renderSkeletonBlock("page-skeleton__card")}
          ${renderSkeletonBlock("page-skeleton__card")}
          ${renderSkeletonBlock("page-skeleton__card")}
        </div>
      </div>
    `;
  }

  function ensureStylesLoaded(nextDocument) {
    nextDocument.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
      const href = link.getAttribute("href");
      if (!href) return;

      const absoluteHref = new URL(href, window.location.href).href;
      const isLoaded = [...document.querySelectorAll('link[rel="stylesheet"]')].some(
        (currentLink) => currentLink.href === absoluteHref,
      );

      if (isLoaded) return;

      const nextLink = document.createElement("link");
      nextLink.rel = "stylesheet";
      nextLink.href = absoluteHref;
      document.head.append(nextLink);
    });
  }

  async function runPageScript(src) {
    let code = pageScriptCache.get(src);

    if (!code) {
      const response = await fetch(src, { cache: "no-cache" });
      if (!response.ok) throw new Error(`Script load failed: ${response.status}`);
      code = await response.text();
      pageScriptCache.set(src, code);
    }

    const runScript = new Function(`${code}\n//# sourceURL=${src}`);
    runScript();
  }

  async function loadPageScripts(nextDocument, targetUrl) {
    const scripts = [...nextDocument.querySelectorAll("script[src]")]
      .map((script) => script.getAttribute("src"))
      .filter((src) => src && !src.includes("common-ui.js"));

    for (const src of scripts) {
      await runPageScript(new URL(src, targetUrl).href);
    }
  }

  function copyAttributes(target, source) {
    [...target.attributes].forEach((attribute) => {
      if (attribute.name !== "class") target.removeAttribute(attribute.name);
    });

    [...source.attributes].forEach((attribute) => {
      if (attribute.name !== "class") target.setAttribute(attribute.name, attribute.value);
    });
  }

  function updatePersistentHeader(currentHeader, nextHeader) {
    if (!currentHeader || !nextHeader) return;

    const currentTabs = currentHeader.querySelector(".history-page__tabs");
    const nextTabs = nextHeader.querySelector(".history-page__tabs");
    if (currentTabs && nextTabs) {
      currentTabs.innerHTML = nextTabs.innerHTML;
    }

    const currentAvatar = currentHeader.querySelector(".history-page__avatar");
    const nextAvatar = nextHeader.querySelector(".history-page__avatar");
    if (currentAvatar && nextAvatar) {
      currentAvatar.className = nextAvatar.className;
      currentAvatar.innerHTML = nextAvatar.innerHTML;
      copyAttributes(currentAvatar, nextAvatar);
    }
  }

  function prepareCurrentContentForNavigation(currentRoot, targetUrl) {
    const content = getPageContent(currentRoot);
    if (!content) return () => {};

    const currentHeight = Math.max(content.getBoundingClientRect().height, 420);
    content.style.minHeight = `${currentHeight}px`;
    content.classList.add("page-transition-exit");

    const skeletonTimer = window.setTimeout(() => {
      if (!content.isConnected) return;
      content.classList.add("history-page__content--loading");
      content.insertAdjacentHTML("beforeend", renderNavigationSkeleton(targetUrl));
    }, 120);

    return () => {
      window.clearTimeout(skeletonTimer);
      content.classList.remove("page-transition-exit", "history-page__content--loading");
      content.querySelector(".page-skeleton")?.remove();
      content.style.minHeight = "";
    };
  }

  function prepareNextContentForEntry(nextContent, minHeight) {
    if (!nextContent) return;

    nextContent.style.minHeight = `${Math.max(minHeight, 420)}px`;
    nextContent.classList.add("page-transition-enter");

    window.requestAnimationFrame(() => {
      nextContent.classList.add("page-transition-enter-active");
    });

    window.setTimeout(() => {
      nextContent.classList.remove("page-transition-enter", "page-transition-enter-active");
      nextContent.style.minHeight = "";
    }, 260);
  }

  function resetStagingRoot(stagingRoot) {
    stagingRoot.style.position = "";
    stagingRoot.style.left = "";
    stagingRoot.style.top = "";
    stagingRoot.style.width = "";
    stagingRoot.removeAttribute("aria-hidden");
  }

  async function navigateToPage(url, options = {}) {
    const targetUrl = new URL(url, window.location.href);
    const currentUrl = new URL(window.location.href);

    if (targetUrl.href === currentUrl.href && !options.force) return;

    const currentRoot = getCurrentAppRoot();
    if (!currentRoot) {
      window.location.href = targetUrl.href;
      return;
    }

    const token = ++navigationToken;
    const currentContent = getPageContent(currentRoot);
    const currentContentHeight = currentContent?.getBoundingClientRect().height ?? 420;
    const cleanupLoadingState = prepareCurrentContentForNavigation(currentRoot, targetUrl.href);

    try {
      const response = await fetch(targetUrl.href, { cache: "no-cache" });
      if (!response.ok) throw new Error(`Navigation failed: ${response.status}`);

      const html = await response.text();
      const nextDocument = new DOMParser().parseFromString(html, "text/html");
      const nextRoot = nextDocument.querySelector("main[id$='-app']");

      if (!nextRoot) {
        window.location.href = targetUrl.href;
        return;
      }

      ensureStylesLoaded(nextDocument);

      const stagingRoot = nextRoot.cloneNode(true);
      stagingRoot.style.position = "absolute";
      stagingRoot.style.left = "-100000px";
      stagingRoot.style.top = "0";
      stagingRoot.style.width = `${currentRoot.getBoundingClientRect().width || window.innerWidth}px`;
      stagingRoot.setAttribute("aria-hidden", "true");
      currentRoot.insertAdjacentElement("afterend", stagingRoot);

      await loadPageScripts(nextDocument, targetUrl.href);

      if (token !== navigationToken) {
        stagingRoot.remove();
        cleanupLoadingState();
        return;
      }

      const currentHeader = currentRoot.querySelector(".history-page__navbar");
      const nextHeader = stagingRoot.querySelector(".history-page__navbar");
      updatePersistentHeader(currentHeader, nextHeader);

      if (currentHeader && nextHeader) {
        const headerPlaceholder = currentHeader.cloneNode(true);
        headerPlaceholder.style.visibility = "hidden";
        currentHeader.replaceWith(headerPlaceholder);
        nextHeader.replaceWith(currentHeader);
      }

      const nextContent = getPageContent(stagingRoot);
      prepareNextContentForEntry(nextContent, currentContentHeight);

      document.title = nextDocument.title || document.title;
      resetStagingRoot(stagingRoot);
      currentRoot.replaceWith(stagingRoot);

      if (!options.fromPopState) {
        window.history.pushState({ softNav: true }, "", targetUrl.href);
      }

      window.scrollTo({ top: 0, behavior: "auto" });
    } catch (error) {
      cleanupLoadingState();
      console.error(error);
      window.location.href = targetUrl.href;
    }
  }

  function setActiveNavButton(navButton) {
    const header = navButton.closest(".history-page__navbar");
    if (!header) return;

    header.querySelectorAll(".history-page__tab").forEach((button) => {
      button.classList.remove("history-page__tab--active", "history-page__tab--static");
    });
    header.querySelector(".history-page__avatar")?.classList.remove("history-page__avatar--active");

    if (navButton.classList.contains("history-page__tab")) {
      navButton.classList.add("history-page__tab--active", "history-page__tab--static");
    }

    if (navButton.classList.contains("history-page__avatar")) {
      navButton.classList.add("history-page__avatar--active");
    }
  }

  function handleDocumentNavigation(event) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const navButton = event.target.closest("[data-nav-url]");
    if (!navButton) return;

    event.preventDefault();
    event.stopPropagation();
    setActiveNavButton(navButton);
    navigateToPage(navButton.dataset.navUrl);
  }

  document.addEventListener("click", handleDocumentNavigation, true);

  window.addEventListener("popstate", () => {
    navigateToPage(window.location.href, { fromPopState: true, force: true });
  });

  window.MovieTrackerUI = {
    autoSizeTextarea,
    escapeHtml,
    getApiConfigurationError,
    navigateToPage,
    resolveApiBaseUrl,
    renderModalShell,
    renderTabs,
    renderToasts,
    writeClipboardText,
  };
})();
