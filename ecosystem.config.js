// ============================================
// KeWhats PM2 Ecosystem Configuration
// ============================================
// Usage: pm2 start ecosystem.config.js
// Stop:  pm2 stop all
// Logs:  pm2 logs

module.exports = {
    apps: [
        // Backend API Server
        {
            name: 'kewhats-api',
            script: './server/src/index.js',
            cwd: './',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '500M',
            env: {
                NODE_ENV: 'production',
                PORT: 3001
            },
            error_file: './logs/api-error.log',
            out_file: './logs/api-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            merge_logs: true
        },

        // Frontend Static Server (using Vite preview)
        {
            name: 'kewhats-frontend',
            script: 'npx',
            args: 'serve -s dist -l 4173',
            cwd: './',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '200M',
            env: {
                NODE_ENV: 'production'
            },
            error_file: './logs/frontend-error.log',
            out_file: './logs/frontend-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            merge_logs: true
        }
    ]
};
