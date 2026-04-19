// PM2 has no reliable env_file option. Use Node 20.6+ --env-file so the
// process reads /etc/ma-learn-dashboard/.env.{staging,production} at startup.
module.exports = {
  apps: [
    {
      name: 'ma-learn-dashboard-staging',
      script: 'dist/src/server.js',
      cwd: '/var/www/ma-learn-dashboard/backend',
      node_args: '--env-file=/etc/ma-learn-dashboard/.env.staging',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
    },
    {
      name: 'ma-learn-dashboard-prod',
      script: 'dist/src/server.js',
      cwd: '/var/www/ma-learn-dashboard/backend',
      node_args: '--env-file=/etc/ma-learn-dashboard/.env.production',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
    },
  ],
};
