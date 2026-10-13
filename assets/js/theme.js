// Runs in <head> before first paint so the page never flashes the wrong theme.
(() => {
  const root = document.documentElement;
  let theme = null;
  try {
    theme = localStorage.getItem('theme');
  } catch {
    // Storage can be blocked; fall back to the system preference.
  }
  if (theme !== 'light' && theme !== 'dark') {
    theme = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  root.dataset.theme = theme;
  root.classList.add('js');
})();
