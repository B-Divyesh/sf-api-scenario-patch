const copyButtons = document.querySelectorAll<HTMLButtonElement>('[data-copy]');

copyButtons.forEach((button) => {
  button.addEventListener('click', async () => {
    const source = document.getElementById(button.dataset.copy ?? '');
    const text = source?.textContent?.trim() ?? '';
    const label = button.querySelector('span');
    try {
      await navigator.clipboard.writeText(text);
      if (label) label.textContent = 'Copied';
      button.classList.add('copied');
      window.setTimeout(() => {
        if (label) label.textContent = button.classList.contains('paper-copy') ? 'Copy patch' : 'Copy';
        button.classList.remove('copied');
      }, 1600);
    } catch {
      if (label) label.textContent = 'Select and copy';
      source?.classList.add('copy-fallback');
    }
  });
});

const demo = document.getElementById('patch-demo');
const empty = document.getElementById('demo-empty');
const loading = document.getElementById('demo-loading');
const result = document.getElementById('demo-result');
const runButton = document.getElementById('run-demo') as HTMLButtonElement | null;

runButton?.addEventListener('click', () => {
  if (!demo || !empty || !loading || !result) return;
  empty.hidden = true;
  result.hidden = true;
  loading.hidden = false;
  demo.setAttribute('aria-busy', 'true');
  runButton.disabled = true;
  runButton.textContent = 'Building patch…';
  const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 420;
  window.setTimeout(() => {
    loading.hidden = true;
    result.hidden = false;
    demo.setAttribute('aria-busy', 'false');
    runButton.disabled = false;
    runButton.textContent = 'Rebuild the safe patch';
  }, delay);
});

const offline = document.getElementById('offline');
const updateConnection = () => {
  if (offline) offline.hidden = navigator.onLine;
};
window.addEventListener('online', updateConnection);
window.addEventListener('offline', updateConnection);
updateConnection();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // The site remains fully functional without offline caching.
    });
  });
}
