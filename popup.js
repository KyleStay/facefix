const toggle = document.querySelector('#enabled');
chrome.storage.local.get({enabled: true}).then(({enabled}) => { toggle.checked = enabled; });
toggle.addEventListener('change', () => chrome.storage.local.set({enabled: toggle.checked}));

const kinds = ['returnEvents', 'reloads', 'homeRedirects', 'scrollRecoveries'];
function render(counters = {}) {
  for (const kind of kinds) document.getElementById(kind).textContent = (counters[kind] || 0).toLocaleString();
}
chrome.storage.local.get('counters').then(({counters}) => render(counters));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.counters) render(changes.counters.newValue);
  if (changes.enabled) toggle.checked = changes.enabled.newValue !== false;
});
document.querySelector('#reset').addEventListener('click', async () => {
  const status = document.querySelector('#status');
  try {
    const response = await chrome.runtime.sendMessage({type: 'facefix-reset'});
    status.textContent = response?.ok ? 'Counters reset.' : 'Could not reset. Try again.';
  } catch { status.textContent = 'Could not reset. Try again.'; }
});
