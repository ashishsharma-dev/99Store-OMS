This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

Copy `.env.example` to `.env.local` and configure the required values. Production deployments must set `AUTH_SESSION_SECRET` and the webhook secret for every enabled courier callback. The OTP, unsigned-webhook, courier-simulation, and demo-tool switches are development-only and must remain disabled in production.

Authentication uses a signed, HTTP-only session cookie. API authorization is enforced server-side; browser local storage is only a display cache and is not trusted for permissions.

## Production release checks

Run the complete local release gate before deployment:

```bash
npm run verify
```

On the VPS, `deploy.sh` refuses a dirty tracked worktree, creates an authenticated MongoDB backup, fast-forwards the configured branch, installs the locked dependency tree, validates the production environment, runs tests and lint, builds the application, reloads PM2, and waits for the public health endpoint.

The production environment validator checks configuration without printing secret values:

```bash
npm run verify:env
```

## MongoDB backups

Run an on-demand authenticated backup with:

```bash
bash scripts/backup-mongodb.sh
```

Backups are compressed, checksummed, private by default, and retained for 14 days unless `MONGODB_BACKUP_RETENTION_DAYS` is changed. The example systemd service and daily timer are under `ops/systemd/`. Copies should also be transferred to storage outside the VPS, and a restore drill should be performed before launch.

Install and immediately test the timer on the VPS as root:

```bash
bash ops/install-backup-service.sh
```

Verify that the latest archive can actually be restored into an isolated temporary database, which the script removes automatically:

```bash
bash scripts/verify-mongodb-backup.sh
```

## VPS monitoring and logs

Install the five-minute public health watchdog and daily PM2 log rotation as root:

```bash
bash ops/install-monitoring.sh
```

Failures are recorded by systemd and can be inspected with `journalctl -u 99store-oms-health.service`. The included logrotate policy retains 14 compressed daily PM2 log files.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
