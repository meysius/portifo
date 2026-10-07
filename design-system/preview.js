// Loaded by every components/*/preview.html. Applies ?theme=dark and tells
// index.html how tall the preview is, so its frame fits without clipping.
(() => {
  if (new URLSearchParams(location.search).get('theme') === 'dark') document.documentElement.dataset.theme = 'dark';
  if (parent === window) return;
  const report = () => {
    const root = document.querySelector('.pv');
    const height = root
      ? Math.max(...[...root.children].map(el => el.getBoundingClientRect().bottom + scrollY)) + 20
      : document.documentElement.scrollHeight;
    parent.postMessage({ dsPreviewHeight: Math.ceil(height), path: location.pathname }, '*');
  };
  addEventListener('load', () => {
    report();
    new ResizeObserver(report).observe(document.body);
    document.fonts.ready.then(report);
  });
})();
