const fs = require("fs");

const ENV_FILE = "/root/poly-arb-bot/.env";

const dotenv = {};
try {
  const lines = fs.readFileSync(ENV_FILE, "utf8").split("\n");
  for (const line of lines) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) dotenv[m[1]] = m[2].trim();
  }
} catch { /* .env missing */ }

module.exports = {
  apps: [
    {
      name: "poly-arb-sim",
      script: "src/index-live.js",
      interpreter: "node",
      // --env-file loads .env before any module code runs (Node 20.6+)
      interpreter_args: `--env-file=${ENV_FILE}`,
      cwd: "/root/poly-arb-bot",

      env: {
        NODE_ENV: "production",
        LIVE_MODE:          dotenv.LIVE_MODE          ?? "false",
        MAX_TRADE_USDC:     dotenv.MAX_TRADE_USDC     ?? "20",
        COMBINED_THRESHOLD: dotenv.COMBINED_THRESHOLD ?? "0.95",
        ...dotenv,
      },

      autorestart: true,
      max_restarts: 20,
      restart_delay: 3000,
      exp_backoff_restart_delay: 100,

      error_file:      "/root/poly-arb-bot/logs/error.log",
      out_file:        "/root/poly-arb-bot/logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
      kill_timeout: 5000,
      watch: false,
    },
  ],
};
