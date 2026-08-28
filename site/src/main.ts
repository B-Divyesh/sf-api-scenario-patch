if (location.pathname === '/' && new URLSearchParams(location.search).get('demo') === '1') {
  location.replace('/demo/?demo=1');
}

document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((button) => {
  button.addEventListener('click', async () => {
    const source = document.getElementById(button.dataset.copy ?? '');
    const text = source?.textContent?.trim() ?? '';
    const label = button.querySelector('span');
    try {
      await navigator.clipboard.writeText(text);
      if (label) label.textContent = 'Copied';
      button.classList.add('copied');
      window.setTimeout(() => {
        if (label) label.textContent = button.classList.contains('paper-copy') ? 'Copy scenario patch' : 'Copy install command';
        button.classList.remove('copied');
      }, 1600);
    } catch {
      if (label) label.textContent = 'Select and copy';
      source?.classList.add('copy-fallback');
    }
  });
});

const runButton = document.getElementById('run-demo') as HTMLButtonElement | null;
runButton?.addEventListener('click', () => {
  const result = document.getElementById('demo-result');
  const demo = document.getElementById('patch-demo');
  if (!result || !demo) return;
  demo.setAttribute('aria-busy', 'true');
  runButton.disabled = true;
  runButton.textContent = 'Generating sample patch…';
  const delay = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220;
  window.setTimeout(() => {
    result.classList.add('fresh-patch');
    demo.setAttribute('aria-busy', 'false');
    runButton.disabled = false;
    runButton.textContent = 'Generate sample scenario patch';
  }, delay);
});

document.getElementById('reset-demo')?.addEventListener('click', () => {
  const patch = document.getElementById('demo-result');
  patch?.classList.remove('fresh-patch');
  document.getElementById('run-demo')?.focus();
  const announcer = document.querySelector<HTMLElement>('.route-announcer');
  if (announcer) announcer.textContent = 'Demo reset. The bundled sample is ready.';
});

const offline = document.getElementById('offline');
const updateConnection = () => { if (offline) offline.hidden = navigator.onLine; };
addEventListener('online', updateConnection);
addEventListener('offline', updateConnection);
updateConnection();

const heading = document.querySelector<HTMLElement>('main h1[tabindex="-1"]');
if (heading) {
  window.setTimeout(() => heading.focus(), 0);
  const announcer = document.querySelector<HTMLElement>('.route-announcer');
  if (announcer) announcer.textContent = document.title;
}

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));
}
