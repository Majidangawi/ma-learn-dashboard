export function mountEnvBadge(env) {
  const badge = document.createElement('div');
  badge.className = `env-badge ${env}`;
  badge.textContent = env;
  document.body.appendChild(badge);
}
