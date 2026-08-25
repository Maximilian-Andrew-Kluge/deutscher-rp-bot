module.exports = {
  apps: [
    {
      name: 'deutscher-rp-bot',
      script: 'dist/index.js',
      watch: false,
      restart_delay: 5000,
      max_restarts: 10,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file: './logs/error.log',
      out_file: './logs/output.log',
      merge_logs: true,
    },
  ],
};
