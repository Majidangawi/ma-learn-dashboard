const ROUTES = {
  home: () => import('./pages/home.js'),
  lessons: () => import('./pages/lessons.js'),
  emails: () => import('./pages/emails.js'),
  newsletter: () => import('./pages/newsletter.js'),
  coupons: () => import('./pages/coupons.js'),
  linkbio: () => import('./pages/linkbio.js'),
  noor: () => import('./pages/noor-chat.js'),
  customers: () => import('./pages/home.js'),
  settings: () => import('./pages/home.js'),
};

export async function startRouter({ content, sidebar }) {
  async function render() {
    const hash = location.hash.replace(/^#/, '') || 'home';
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
