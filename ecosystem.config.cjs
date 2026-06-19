module.exports = {
  apps: [
    {
      name: "poly-arb-sim",
      script: "src/index-live.js",
      interpreter: "node",
      cwd: "/root/poly-arb-bot",

      // Run in SIM mode by default (no real trades)
      env: {
        NODE_ENV: "production",
        LIVE_MODE: "false",
        MAX_TRADE_USDC: "20",
        COMBINED_THRESHOLD: "0.95",
      },

      // Restart on crash, exponential backoff
      autorestart: true,
      max_restarts: 20,
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,

      // Log settings — rotate daily, keep 7 days
      error_file:   "/root/poly-arb-bot/logs/error.log",
      out_file:     "/root/poly-arb-bot/logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,

      // Kill gracefully before restart
      kill_timeout: 5000,

      // Watch nothing (no hot-reload on VPS)
      watch: false,
    },

    // Second profile: live trading (uncomment to use)
    // {
    //   name: "poly-arb-live",
    //   script: "src/index-live.js",
    //   cwd: "/root/poly-arb-bot",
    //   env: {
    //     NODE_ENV: "production",
    //     SIM_MODE: "false",
    //     MAX_TRADE_USDC: "20",
    //     COMBINED_THRESHOLD: "0.95",
    //     POLY_PRIVATE_KEY: "YOUR_PRIVATE_KEY_HERE",
    //     POLY_API_KEY:     "YOUR_API_KEY_HERE",
    //     POLY_API_SECRET:  "YOUR_API_SECRET_HERE",
    //     POLY_PASSPHRASE:  "YOUR_PASSPHRASE_HERE",
    //   },
    //   autorestart: true,
    //   max_restarts: 20,
    //   error_file: "/root/poly-arb-bot/logs/live-error.log",
    //   out_file:   "/root/poly-arb-bot/logs/live-out.log",
    //   log_date_format: "YYYY-MM-DD HH:mm:ss",
    //   watch: false,
    // },
  ],
};
