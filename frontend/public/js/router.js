const ROUTES = {
  home: () => import('./pages/home.js'),
  lessons: () => import('./pages/lessons.js'),
  emails: () => import('./pages/emails.js'),
  newsletter: () => import('./pages/newsletter.js'),
  contacts: () => import('./pages/contacts.js'),
  coupons: () => import('./pages/coupons.js'),
  linkbio: () => import('./pages/linkbio.js'),
  noor: () => import('./pages/noor-chat.js'),
};

export async function startRouter({ content, sidebar }) {
  async function render() {
    // Strip leading `#` and any following `/` so both `#newsletter` and
    // `#/newsletter` route to the same page.
    const hash = location.hash.replace(/^#\/?/, '') || 'home';

    // Parametric routes first. Today: #/newsletter/:id/stats.
    const statsMatch = hash.match(/^newsletter\/([^/]+)\/stats$/);
    if (statsMatch) {
      sidebar.setActive('newsletter');
      content.innerHTML = '<p style="color:var(--silver)">Loading…</p>';
      try {
        const mod = await import('./pages/newsletter-stats.js');
        await mod.default(content, { id: decodeURIComponent(statsMatch[1]) });
      } catch (e) {
        content.innerHTML = `<p style="color:var(--red)">Error: ${e.message}</p>`;
      }
      return;
    }

    const [pageId, ...rest] = hash.split('/');
    const loader = ROUTES[pageId] || ROUTES.home;
    sidebar.setActive(pageId);
    content.innerHTML = '<p style="color:var(--silver)">Loading…</p>';
    try {
      const mod = await loader();
      await mod.default(content, { params: rest });
    } catch (e) {
      content.innerHTML = `<p style="color:var(--red)">Error: ${e.message}</p>`;
    }
  }
  window.addEventListener('hashchange', render);
  await render();
}
