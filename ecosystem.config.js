module.exports = {
  apps: [{
    name: 'wsbot',
    script: 'ts-node',
    args: 'src/app.ts',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production'
    },
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    // Configuración de auto-reinicio
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    // Reiniciar si crashea
    exp_backoff_restart_delay: 100
  }]
};
