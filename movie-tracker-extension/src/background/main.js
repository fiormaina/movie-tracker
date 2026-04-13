const IVI_NEXT_API_PATH = 'api2.ivi.ru/mobileapi/videofromcompilation/next/v7';

async function fetchText(url) {
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
  });

  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    text,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'movie-tracker:ivi-fetch-next') {
    return false;
  }

  const url = String(message.url || '');
  if (!url.includes(IVI_NEXT_API_PATH)) {
    sendResponse({ ok: false, text: null, status: 0 });
    return false;
  }

  fetchText(url)
    .then((result) => sendResponse(result))
    .catch(() => sendResponse({ ok: false, text: null, status: 0 }));

  return true;
});
