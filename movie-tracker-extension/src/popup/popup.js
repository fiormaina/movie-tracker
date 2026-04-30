const STORAGE_KEY = 'movieTrackerBinding';
const PLATFORM_URL = 'http://localhost:8000';
const USE_MOCK_BINDING = true;

const elements = {
  statusBanner: document.getElementById('status-banner'),
  viewUnbound: document.getElementById('view-unbound'),
  viewBound: document.getElementById('view-bound'),
  bindForm: document.getElementById('bind-form'),
  codeInput: document.getElementById('code-input'),
  connectButton: document.getElementById('connect-button'),
  errorText: document.getElementById('error-text'),
  profileName: document.getElementById('profile-name'),
  profileEmail: document.getElementById('profile-email'),
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

function openPlatform() {
  if (chrome.tabs?.create) {
    chrome.tabs.create({ url: PLATFORM_URL });
    return;
  }

  window.open(PLATFORM_URL, '_blank', 'noopener,noreferrer');
}

function initialsFromName(name, email) {
  const source = String(name || email || 'MT').trim();
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
  elements.profileEmail.textContent = binding.email || '';
  elements.connectedAt.textContent = binding.connectedAt
    ? `Привязано: ${formatDate(binding.connectedAt)}`
    : 'Аккаунт успешно подключён';
  elements.avatar.textContent = initialsFromName(binding.name, binding.email);
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
    name: 'Demo User',
    email: 'demo.user@example.com',
    connectedAt: new Date().toISOString(),
    code: normalized,
  };
}

async function bindWithServer(code) {
  const response = await fetch(`${PLATFORM_URL}/api/extension/bind`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code }),
  });

  if (response.status === 400 || response.status === 404) {
    const error = new Error('Не удалось подключить');
    error.code = 'bind_failed';
    throw error;
  }

  if (!response.ok) {
    const error = new Error('Сервер недоступен');
    error.code = 'server_unavailable';
    throw error;
  }

  const profile = await response.json();
  return {
    name: profile.name || '',
    email: profile.email || '',
    connectedAt: profile.connectedAt || new Date().toISOString(),
  };
}

async function bindAccount(code) {
  if (USE_MOCK_BINDING) {
    return bindWithMock(code);
  }

  return bindWithServer(code);
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
    renderBound(binding);
    return;
  }

  renderUnbound();
}

elements.bindForm.addEventListener('submit', handleSubmit);
elements.openPlatformButton.addEventListener('click', openPlatform);
elements.disconnectButton.addEventListener('click', handleDisconnect);

bootstrap().catch(() => {
  setBanner('Не удалось загрузить состояние расширения', 'error');
  renderUnbound();
});
