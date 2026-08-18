module.exports = {
  apps: [
    {
      name: "99store-oms",
      script: "./node_modules/next/dist/bin/next",
      args: "start -p 3000",
      cwd: "/home/ayurvedacare/99store-oms",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "1G",
      restart_delay: 2000,
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    }
  ]
};
