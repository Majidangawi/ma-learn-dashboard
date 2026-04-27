const ROUTES = {
  home:      () => import('./pages/home.js'),
  activity:  () => import('./pages/activity.js'),
  lessons:   () => import('./pages/lessons.js'),
  emails:    () => import('./pages/emails.js'),
  newsletter:() => import('./pages/newsletter.js'),
  contacts:  () => import('./pages/contacts.js'),
  coupons:   () => import('./pages/coupons.js'),
  linkbio:   () => import('./pages/linkbio.js'),
  purchases: () => import('./pages/purchases.js'),
};

export async function startRouter({ content, onRouteChange }) {
  async function render() {
    // Noor retired as a page; lives in the rail now.
    if (location.hash === '#noor' || location.hash === '#/noor') {
      location.hash = '#home';
      return;
    }

    const hash = location.hash.replace(/^#\/?/, '') || 'home';

    // Parametric route: #/newsletter/:id/stats
    const statsMatch = hash.match(/^newsletter\/([^/]+)\/stats$/);
    if (statsMatch) {
      onRouteChange?.('newsletter');
      content.innerHTML = '<p style="color:var(--c-fg-3)">Loading…</p>';
      try {
        const mod = await import('./pages/newsletter-stats.js');
        await mod.default(content, { id: decodeURIComponent(statsMatch[1]) });
      } catch (e) {
        content.innerHTML = `<p style="color:var(--c-danger)">Error: ${e.message}</p>`;
      }
      return;
    }

    const [pageId, ...rest] = hash.split('/');
    const loader = ROUTES[pageId] || ROUTES.home;
    const effectivePageId = ROUTES[pageId] ? pageId : 'home';
    onRouteChange?.(effectivePageId);
    content.innerHTML = '<p style="color:var(--c-fg-3)">Loading…</p>';
    try {
      const mod = await loader();
      await mod.default(content, { params: rest });
    } catch (e) {
      content.innerHTML = `<p style="color:var(--c-danger)">Error: ${e.message}</p>`;
    }
  }
  window.addEventListener('hashchange', render);
  await render();
}
