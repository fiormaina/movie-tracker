const STORAGE_KEY = 'movieTrackerBinding';
const PLATFORM_URL = 'http://localhost/movie-tracker/movie-tracker-front/index.html';
const API_BASE_URL = 'http://127.0.0.1:8000';
const USE_MOCK_BINDING = false;

const elements = {
  statusBanner: document.getElementById('status-banner'),
  viewUnbound: document.getElementById('view-unbound'),
  viewBound: document.getElementById('view-bound'),
  bindForm: document.getElementById('bind-form'),
  codeInput: document.getElementById('code-input'),
  connectButton: document.getElementById('connect-button'),
  errorText: document.getElementById('error-text'),
  profileName: document.getElementById('profile-name'),
  profileUsername: document.getElementById('profile-username'),
  connectedAt: document.getElementById('connected-at'),
  avatar: document.getElementById('avatar'),
  openPlatformButton: document.getElementById('open-platform-button'),
  disconnectButton: document.getElementById('disconnect-button'),
  platformLinkUnbound: document.getElementById('platform-link-unbound'),
};

function storageGet(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => resolve(result[key] ?? null));
  });
}

function storageSet(value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: value }, () => resolve());
  });
}

function storageRemove() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(STORAGE_KEY, () => resolve());
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJsonSafely(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function formatDate(value) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function setHidden(element, hidden) {
  element.classList.toggle('hidden', hidden);
}

function setBanner(message, kind = 'loading') {
  if (!message) {
    elements.statusBanner.textContent = '';
    elements.statusBanner.className = 'status-banner hidden';
    return;
  }

  elements.statusBanner.textContent = message;
  elements.statusBanner.className = `status-banner ${kind}`;
}

function setError(message = '') {
  elements.errorText.textContent = message;
  setHidden(elements.errorText, !message);
}

function setLoadingState(isLoading) {
  elements.connectButton.disabled = isLoading;
  elements.codeInput.disabled = isLoading;
  elements.disconnectButton.disabled = isLoading;
  elements.openPlatformButton.disabled = isLoading;
}

function setPlatformLinks() {
  elements.platformLinkUnbound.href = PLATFORM_URL;
}

async function openPlatform(event) {
  event?.preventDefault();

  const binding = await storageGet(STORAGE_KEY);
  const targetUrl = binding?.profileUrl || PLATFORM_URL;

  if (chrome.tabs?.create) {
    chrome.tabs.create({ url: targetUrl });
    return;
  }

  window.open(targetUrl, '_blank', 'noopener,noreferrer');
}

function formatUsername(username) {
  const normalized = String(username || '')
    .trim()
    .replace(/^@+/, '');
  return normalized ? `@${normalized}` : '';
}

function normalizeUserPayload(user = {}) {
  const username = String(user.login || user.username || '').trim().replace(/^@+/, '');
  const name =
    String(user.display_name || user.displayName || user.name || '').trim() ||
    username ||
    'Подключённый аккаунт';

  return {
    email: user.email || '',
    extensionCode: user.extension_code || user.extensionCode || '',
    name,
    profileUrl: user.profile_url || user.profileUrl || PLATFORM_URL,
    username,
  };
}

function initialsFromName(name, username) {
  const source = String(name || username || 'MT').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function renderUnbound() {
  setHidden(elements.viewUnbound, false);
  setHidden(elements.viewBound, true);
  setLoadingState(false);
}

function renderBound(binding) {
  setHidden(elements.viewUnbound, true);
  setHidden(elements.viewBound, false);

  elements.profileName.textContent = binding.name || 'Подключённый аккаунт';
  elements.profileUsername.textContent = formatUsername(binding.username);
  elements.connectedAt.textContent = binding.connectedAt
    ? `Привязано: ${formatDate(binding.connectedAt)}`
    : 'Аккаунт успешно подключён';
  elements.avatar.textContent = initialsFromName(binding.name, binding.username);
}

async function bindWithMock(code) {
  await delay(900);

  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized || normalized.length < 4) {
    const error = new Error('Введите корректный код привязки.');
    error.code = 'invalid_code';
    throw error;
  }

  if (normalized === 'SERVER') {
    const error = new Error('Сервер недоступен');
    error.code = 'server_unavailable';
    throw error;
  }

  if (normalized === 'ERROR') {
    const error = new Error('Не удалось подключить');
    error.code = 'bind_failed';
    throw error;
  }

  return {
    accessToken: 'mock-token',
    extensionCode: normalized,
    name: 'Demo User',
    profileUrl: PLATFORM_URL,
    username: 'demo.user',
    connectedAt: new Date().toISOString(),
    code: normalized,
  };
}

async function bindWithServer(code) {
  const normalized = String(code || '').trim().toUpperCase();
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/extension-login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ extension_code: normalized }),
  });

  const data = await readJsonSafely(response);

  if (response.status === 400 || response.status === 401 || response.status === 404 || response.status === 422) {
    const error = new Error(data?.detail?.message || 'Не удалось подключить');
    error.code = 'bind_failed';
    throw error;
  }

  if (!response.ok) {
    const error = new Error(data?.detail?.message || 'Сервер недоступен');
    error.code = 'server_unavailable';
    throw error;
  }

  const user = normalizeUserPayload(data?.user);
  return {
    accessToken: data?.access_token || '',
    code: normalized,
    connectedAt: new Date().toISOString(),
    ...user,
  };
}

async function bindAccount(code) {
  if (USE_MOCK_BINDING) {
    return bindWithMock(code);
  }

  return bindWithServer(code);
}

async function fetchCurrentUser(accessToken) {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await readJsonSafely(response);

  if (response.status === 401 || response.status === 403) {
    const error = new Error('Сессия истекла');
    error.code = 'auth_expired';
    throw error;
  }

  if (!response.ok) {
    const error = new Error(data?.detail?.message || 'Не удалось загрузить профиль');
    error.code = 'profile_unavailable';
    throw error;
  }

  return normalizeUserPayload(data);
}

async function refreshBinding(binding) {
  if (!binding?.accessToken) {
    return binding;
  }

  const user = await fetchCurrentUser(binding.accessToken);
  return {
    ...binding,
    ...user,
  };
}

async function handleSubmit(event) {
  event.preventDefault();

  const code = elements.codeInput.value.trim();
  setError('');
  setBanner('Проверка кода…', 'loading');
  setLoadingState(true);

  try {
    const binding = await bindAccount(code);
    await storageSet(binding);
    setBanner('');
    renderBound(binding);
  } catch (error) {
    const message =
      error?.code === 'server_unavailable'
        ? 'Сервер недоступен'
        : error?.message || 'Не удалось подключить';

    setBanner(message, 'error');
    setError(message);
    renderUnbound();
  } finally {
    setLoadingState(false);
  }
}

async function handleDisconnect() {
  setBanner('');
  setError('');
  await storageRemove();
  elements.codeInput.value = '';
  renderUnbound();
}

async function bootstrap() {
  setPlatformLinks();
  setBanner('');
  setError('');

  const binding = await storageGet(STORAGE_KEY);
  if (binding) {
    if (!binding.accessToken) {
      renderBound(binding);
      return;
    }

    setBanner('Загрузка профиля…', 'loading');
    setLoadingState(true);

    try {
      const refreshedBinding = await refreshBinding(binding);
      await storageSet(refreshedBinding);
      setBanner('');
      renderBound(refreshedBinding);
    } catch (error) {
      if (error?.code === 'auth_expired') {
        await storageRemove();
        setBanner('Сессия истекла, подключите расширение заново', 'error');
        renderUnbound();
        return;
      }

      setBanner('Не удалось обновить данные профиля', 'error');
      renderBound(binding);
    } finally {
      setLoadingState(false);
    }

    return;
  }

  renderUnbound();
}

elements.bindForm.addEventListener('submit', handleSubmit);
elements.openPlatformButton.addEventListener('click', openPlatform);
elements.platformLinkUnbound.addEventListener('click', openPlatform);
elements.disconnectButton.addEventListener('click', handleDisconnect);

bootstrap().catch(() => {
  setBanner('Не удалось загрузить состояние расширения', 'error');
  renderUnbound();
});
