module.exports = {
  apps: [
    {
      name: 'schoolos-backend',
      cwd: './backend',
      script: 'pnpm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 8000
      }
    },
    {
      name: 'schoolos-frontend',
      cwd: './frontend',
      script: 'pnpm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'schoolos-superadmin',
      cwd: './superadmin',
      script: 'pnpm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    }
  ]
};
