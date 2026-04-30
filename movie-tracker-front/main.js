const landingMock = {
  brand: {
    mark: "MT",
    name: "Movie Tracker",
    tagline: "Главный экран по структуре макета с заглушками под API",
  },
  status: "Главный экран",
  nav: [
    { label: "Главная", href: "#home", active: true },
    { label: "Каталог", href: "#catalog", active: false },
    { label: "Подборки", href: "#collections", active: false },
    { label: "Профиль", href: "#profile", active: false },
  ],
  hero: {
    eyebrow: "Кинотрекер в фиолетовой палитре",
    title: "Находите фильмы и начинайте просмотр с одного главного экрана",
    description:
      "Экран перестроен ближе к вашему PNG-макету: светлая рабочая область, верхние вкладки, центральный блок с обложкой-заглушкой, описанием и кнопками регистрации и авторизации.",
    primaryCta: {
      label: "Регистрация",
      action: "register",
      href: "#register",
    },
    secondaryCta: {
      label: "Авторизация",
      action: "login",
      href: "#login",
    },
    stats: [
      { value: "Mock", label: "данные пока статические" },
      { value: "Auth", label: "готово место под сценарии входа" },
      { value: "Hero", label: "баннер легко заменить данными API" },
    ],
  },
  visual: {
    badge: "Плейсхолдер изображения",
    title: "Место под постер или баннер",
    description:
      "Здесь можно будет подставлять обложку фильма, промо-арт или рекламный баннер с сервера без изменения структуры страницы.",
    stub: "TODO: подставить `heroImage`, `posterUrl` или `backdropUrl` из ответа API",
  },
  previews: [
    {
      tag: "Раздел",
      title: "Карточки фильмов",
      caption: "Секция для каталога и подборок",
      gradient: "linear-gradient(135deg, #f4efff, #ebe6ff)",
    },
    {
      tag: "Раздел",
      title: "История и избранное",
      caption: "Здесь будут персональные блоки",
      gradient: "linear-gradient(135deg, #f7f4ff, #ede7ff)",
    },
    {
      tag: "Раздел",
      title: "Отзывы и активность",
      caption: "Отдельная зона для социальных функций",
      gradient: "linear-gradient(135deg, #f4efff, #e7e0ff)",
    },
  ],
  backendStubs: [
    {
      icon: "01",
      title: "Auth endpoints",
      text: "Кнопки регистрации и входа уже помечены `data-action` для подключения реальных экранов.",
    },
    {
      icon: "02",
      title: "Hero content",
      text: "Описание, баннер и карточки лежат в объекте `landingMock`, чтобы потом заменить их ответом API.",
    },
    {
      icon: "03",
      title: "UI state",
      text: "Секции разнесены логически, поэтому следующим шагом можно спокойно добавлять роутинг и состояние.",
    },
  ],
};

function renderNav(items) {
  return items
    .map(
      (item) => `
        <a class="nav-tabs__item ${item.active ? "nav-tabs__item--active" : ""}" href="${item.href}">
          ${item.label}
        </a>
      `,
    )
    .join("");
}

function renderTopbar(brand, status, navItems) {
  return `
    <header class="topbar">
      <div class="brand">
        <div class="brand__mark">${brand.mark}</div>
        <div>
          <h1 class="brand__name">${brand.name}</h1>
          <p class="brand__tagline">${brand.tagline}</p>
        </div>
      </div>
      <nav class="nav-tabs" aria-label="Основная навигация">
        ${renderNav(navItems)}
      </nav>
      <div class="topbar__side">
        <div class="topbar__pill">${status}</div>
        <div class="avatar-chip" aria-label="Профиль пользователя">
          <span class="avatar-chip__dot" aria-hidden="true"></span>
          <span>Профиль</span>
        </div>
      </div>
    </header>
  `;
}

function renderStats(stats) {
  return stats
    .map(
      (stat) => `
        <div class="meta-card">
          <span class="meta-card__value">${stat.value}</span>
          <span class="meta-card__label">${stat.label}</span>
        </div>
      `,
    )
    .join("");
}

function renderPreviews(previews) {
  return previews
    .map(
      (preview) => `
        <article class="preview-item" style="--preview-gradient: ${preview.gradient};">
          <span class="preview-item__tag">${preview.tag}</span>
          <h3 class="preview-item__title">${preview.title}</h3>
          <span class="preview-item__caption">${preview.caption}</span>
        </article>
      `,
    )
    .join("");
}

function renderBackendList(items) {
  return items
    .map(
      (item) => `
        <div class="feature-row">
          <div class="feature-row__icon">${item.icon}</div>
          <div>
            <strong class="feature-row__title">${item.title}</strong>
            <div class="feature-row__text">${item.text}</div>
          </div>
        </div>
      `,
    )
    .join("");
}

function renderLandingPage(data) {
  return `
    <section class="landing">
      ${renderTopbar(data.brand, data.status, data.nav)}

      <section class="hero" aria-label="Главный экран Movie Tracker">
        <div class="hero__content">
          <div class="hero__eyebrow">${data.hero.eyebrow}</div>
          <h2 class="hero__title">${data.hero.title}</h2>
          <p class="hero__description">${data.hero.description}</p>

          <div class="hero__actions">
            <a class="button button--primary" href="${data.hero.primaryCta.href}" data-action="${data.hero.primaryCta.action}">
              ${data.hero.primaryCta.label}
            </a>
            <a class="button button--secondary" href="${data.hero.secondaryCta.href}" data-action="${data.hero.secondaryCta.action}">
              ${data.hero.secondaryCta.label}
            </a>
          </div>

          <div class="hero__meta">
            ${renderStats(data.hero.stats)}
          </div>
        </div>

        <div class="hero__visual">
          <div class="visual-card">
            <div class="visual-card__badge">${data.visual.badge}</div>
            <div class="visual-card__poster" role="img" aria-label="Плейсхолдер под изображение фильма">
              <div class="poster-silhouette" aria-hidden="true"></div>
              <div class="poster-copy">
                <div class="poster-copy__label">Hero image placeholder</div>
                <h3 class="poster-copy__title">${data.visual.title}</h3>
                <p class="poster-copy__text">${data.visual.description}</p>
              </div>
            </div>
            <div class="visual-card__stub">${data.visual.stub}</div>
          </div>
        </div>
      </section>

      <section class="section-grid">
        <section class="preview-card" aria-label="Будущие секции приложения">
          <div class="section-heading">
            <div>
              <h2>Следующие блоки интерфейса</h2>
              <p>Нижняя часть уже стилизована как зона под будущие карточки и списки.</p>
            </div>
          </div>
          <div class="preview-list">
            ${renderPreviews(data.previews)}
          </div>
        </section>

        <aside class="feature-card" aria-label="Заглушки для интеграции с backend">
          <div class="feature-card__status">Backend integration ready</div>
          <h2>Точки подключения</h2>
          <p>Разметка сразу подготовлена для замены статических данных на реальные ответы сервера.</p>
          <div class="feature-card__list">
            ${renderBackendList(data.backendStubs)}
          </div>
          <div class="feature-card__footer">
            Следующим шагом сюда можно добавить роутинг, форму авторизации и загрузку данных для hero-блока.
          </div>
        </aside>
      </section>
    </section>
  `;
}

function attachActionStubs(root) {
  const actionMessages = {
    register: "Заглушка регистрации: здесь подключим переход к форме sign up.",
    login: "Заглушка авторизации: здесь подключим переход к форме sign in.",
  };

  root.querySelectorAll("[data-action]").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.preventDefault();
      const action = element.dataset.action;
      const message = actionMessages[action] ?? "Экшен будет подключен позже.";

      console.info(`[Movie Tracker stub] ${message}`);

      const status = document.querySelector(".topbar__pill");
      if (status) {
        status.textContent = message;
      }
    });
  });
}

function initApp() {
  const root = document.querySelector("#app");
  if (!root) return;

  root.innerHTML = renderLandingPage(landingMock);
  attachActionStubs(root);
}

initApp();
