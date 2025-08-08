const webview = document.getElementById('webview');
const urlInput = document.getElementById('url');
const backBtn = document.getElementById('back');
const fwdBtn = document.getElementById('forward');
const reloadBtn = document.getElementById('reload');
const homeBtn = document.getElementById('home');
const phToggle = document.getElementById('ph-toggle');

const HOME_URL = 'https://duckduckgo.com';

function normalizeUrl(value) {
  if (!value) return HOME_URL;
  if (/^https?:\/\//i.test(value)) return value;
  if (/\./.test(value)) return `https://${value}`;
  return `https://duckduckgo.com/?q=${encodeURIComponent(value)}`;
}

function updateNavButtons() {
  webview.canGoBack().then(can => backBtn.disabled = !can);
  webview.canGoForward().then(can => fwdBtn.disabled = !can);
}

webview.addEventListener('dom-ready', async () => {
  updateNavButtons();
  urlInput.value = await webview.getURL();
  await webview.executeJavaScript(`window.__PH_ENABLED__ = ${phToggle.checked}; window.__PH_MODE__='rtdetr';`);
});

webview.addEventListener('did-navigate', updateNavButtons);
webview.addEventListener('did-navigate-in-page', updateNavButtons);

backBtn.addEventListener('click', () => webview.goBack());
fwdBtn.addEventListener('click', () => webview.goForward());
reloadBtn.addEventListener('click', () => webview.reload());
homeBtn.addEventListener('click', () => webview.loadURL(HOME_URL));

urlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') webview.loadURL(normalizeUrl(urlInput.value.trim())); });
phToggle.addEventListener('change', async () => { await webview.executeJavaScript(`window.__PH_ENABLED__ = ${phToggle.checked};`); });
