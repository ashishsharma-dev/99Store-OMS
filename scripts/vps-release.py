#!/usr/bin/env python3
"""Deploy or roll back the OMS on the configured VPS without exposing credentials."""

from __future__ import annotations

import argparse
import base64
import shlex
import sys
from datetime import datetime, timezone

import paramiko

from deploy import APP_DIR, VPS_HOST, VPS_PASS, VPS_USER


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")


PUBLIC_HEALTH_URL = "https://oms.ayurvedacare.store/api/health"
ROLLBACK_ROOT = "/home/ayurvedacare/99store-rollbacks"


def connect() -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.load_system_host_keys()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=20)
    return client


def run(client: paramiko.SSHClient, label: str, command: str, timeout: int = 900) -> str:
    print(f"[VPS] {label}...", flush=True)
    _, stdout, stderr = client.exec_command(command, timeout=timeout)
    output = stdout.read().decode("utf-8", errors="replace")
    error = stderr.read().decode("utf-8", errors="replace")
    status = stdout.channel.recv_exit_status()
    if output.strip():
        print(output.strip(), flush=True)
    if error.strip():
        print(error.strip(), file=sys.stderr, flush=True)
    if status != 0:
        raise RuntimeError(f"{label} failed with exit status {status}")
    return output.strip()


def app_command(command: str) -> str:
    return f"set -Eeuo pipefail; cd {shlex.quote(APP_DIR)}; {command}"


def health_command() -> str:
    return (
        "for i in $(seq 1 30); do "
        "LOCAL=$(curl -fsS --max-time 10 http://127.0.0.1:3000/api/health 2>/dev/null || true); "
        f"PUBLIC=$(curl -fsS --max-time 10 {shlex.quote(PUBLIC_HEALTH_URL)} 2>/dev/null || true); "
        "if printf '%s' \"$LOCAL\" | grep -q '\"status\":\"healthy\"' && "
        "printf '%s' \"$PUBLIC\" | grep -q '\"status\":\"healthy\"'; then "
        "printf '%s\n%s\n' \"$LOCAL\" \"$PUBLIC\"; exit 0; fi; sleep 2; done; exit 1"
    )


def preflight(client: paramiko.SSHClient) -> str:
    return run(
        client,
        "Preflight",
        app_command(
            "printf 'commit=%s\nbranch=%s\nnode=%s\nnpm=%s\nauth_secret_entries=%s\n' "
            "\"$(git rev-parse HEAD)\" \"$(git branch --show-current)\" \"$(node -v)\" \"$(npm -v)\" "
            "\"$(grep -c '^AUTH_SESSION_SECRET=' .env.local || true)\"; "
            "printf 'tracked_dirty=%s\nenv_file=%s\necosystem_file=%s\nbackup_script=%s\npm2_process=%s\n' "
            "\"$(git status --porcelain --untracked-files=no | wc -l)\" "
            "\"$(test -f .env.local && echo yes || echo no)\" "
            "\"$(test -f ecosystem.config.js && echo yes || echo no)\" "
            "\"$(test -f scripts/backup-mongodb.sh && echo yes || systemctl cat 99store-mongodb-backup.service >/dev/null 2>&1 && echo systemd || echo no)\" "
            "\"$(pm2 describe 99store-oms >/dev/null 2>&1 && echo online || echo missing)\"; "
            "echo tracked_changes_begin; git status --short --untracked-files=no; echo tracked_changes_end; "
            "printf 'backup_service=%s\n' \"$(systemctl list-unit-files 99store-mongodb-backup.service --no-legend 2>/dev/null | awk '{print $2}' || true)\"; "
            "test -f .env.local; test -f ecosystem.config.js; "
            "test -f scripts/backup-mongodb.sh || systemctl cat 99store-mongodb-backup.service >/dev/null; "
            "test -z \"$(git status --porcelain --untracked-files=no | grep -v ' data/db.json$' || true)\"; "
            "pm2 describe 99store-oms >/dev/null; " + health_command()
        ),
        timeout=120,
    )


def make_rollback_script(previous_commit: str) -> str:
    return f"""#!/usr/bin/env bash
set -Eeuo pipefail
APP_DIR={shlex.quote(APP_DIR)}
TARGET_COMMIT={shlex.quote(previous_commit)}
cd "$APP_DIR"
test -z "$(git status --porcelain --untracked-files=no | grep -v ' data/db.json$' || true)"
RUNTIME_DATA="$(mktemp)"
cp data/db.json "$RUNTIME_DATA"
git checkout -- data/db.json
git reset --hard "$TARGET_COMMIT"
cp "$RUNTIME_DATA" data/db.json
rm -f "$RUNTIME_DATA"
npm ci --include=dev
if npm run | grep -q 'verify:env'; then npm run verify:env; fi
npm run test
npm run lint -- --quiet
npm run build
pm2 startOrReload ecosystem.config.js --update-env
pm2 save
{health_command()}
echo "Rollback completed: $TARGET_COMMIT"
"""


def rollback(client: paramiko.SSHClient, previous_commit: str) -> None:
    run(
        client,
        f"Rolling back to {previous_commit}",
        app_command(
            "RUNTIME_DATA=$(mktemp); cp data/db.json \"$RUNTIME_DATA\"; git checkout -- data/db.json; "
            f"git reset --hard {shlex.quote(previous_commit)}; cp \"$RUNTIME_DATA\" data/db.json; rm -f \"$RUNTIME_DATA\"; "
            "npm ci --include=dev; if npm run | grep -q 'verify:env'; then npm run verify:env; fi; npm run test; "
            "npm run lint -- --quiet; npm run build; "
            "pm2 startOrReload ecosystem.config.js --update-env; pm2 save; " + health_command()
        ),
        timeout=1200,
    )


def deploy(client: paramiko.SSHClient, target_commit: str) -> None:
    preflight_output = preflight(client)
    previous_commit = next(
        line.split("=", 1)[1] for line in preflight_output.splitlines() if line.startswith("commit=")
    )
    release_id = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    release_dir = f"{ROLLBACK_ROOT}/{release_id}"

    run(
        client,
        "Creating MongoDB and environment rollback snapshot",
        app_command(
            f"install -d -m 700 {shlex.quote(release_dir)}; "
            f"cp .env.local {shlex.quote(release_dir)}/env.local; chmod 600 {shlex.quote(release_dir)}/env.local; "
            f"cp data/db.json {shlex.quote(release_dir)}/db.json; chmod 600 {shlex.quote(release_dir)}/db.json; "
            f"if test -f scripts/backup-mongodb.sh; then bash scripts/backup-mongodb.sh; "
            "else systemctl start 99store-mongodb-backup.service; journalctl -u 99store-mongodb-backup.service -n 20 --no-pager; fi "
            f"| tee {shlex.quote(release_dir)}/mongodb-backup.log; "
            f"printf 'previous_commit=%s\ntarget_commit=%s\ncreated_utc=%s\n' "
            f"{shlex.quote(previous_commit)} {shlex.quote(target_commit)} {shlex.quote(release_id)} "
            f"> {shlex.quote(release_dir)}/release.env"
        ),
        timeout=600,
    )

    rollback_script = make_rollback_script(previous_commit)
    encoded = base64.b64encode(rollback_script.encode("utf-8")).decode("ascii")
    run(
        client,
        "Installing one-command rollback",
        f"printf %s {shlex.quote(encoded)} | base64 -d > {shlex.quote(release_dir)}/rollback.sh; "
        f"chmod 700 {shlex.quote(release_dir)}/rollback.sh",
    )

    try:
        run(
            client,
            "Fetching and checking out the release",
            app_command(
                "git fetch origin master; "
                f"cp data/db.json {shlex.quote(release_dir)}/db.json; git checkout -- data/db.json; "
                f"git merge --ff-only {shlex.quote(target_commit)}; "
                f"test \"$(git rev-parse HEAD)\" = \"$(git rev-parse {shlex.quote(target_commit)}^{{commit}})\"; "
                f"cp {shlex.quote(release_dir)}/db.json data/db.json; "
                "if ! grep -q '^AUTH_SESSION_SECRET=' .env.local; then "
                "printf '\nAUTH_SESSION_SECRET=%s\n' \"$(openssl rand -hex 32)\" >> .env.local; fi"
            ),
            timeout=300,
        )
        run(client, "Installing locked dependencies", app_command("npm ci --include=dev"), timeout=900)
        run(
            client,
            "Running release verification",
            app_command("npm run verify:env; npm run test; npm run lint -- --quiet; npm run audit:prod; npm run build"),
            timeout=1200,
        )
        run(
            client,
            "Reloading PM2",
            app_command("pm2 startOrReload ecosystem.config.js --update-env; pm2 save"),
            timeout=180,
        )
        run(client, "Checking local and public health", app_command(health_command()), timeout=180)
        print(f"RELEASE_ID={release_id}", flush=True)
        print(f"PREVIOUS_COMMIT={previous_commit}", flush=True)
        print(f"DEPLOYED_COMMIT={target_commit}", flush=True)
        print(f"ROLLBACK_COMMAND=bash {release_dir}/rollback.sh", flush=True)
    except Exception:
        print("Deployment failed; starting automatic rollback.", file=sys.stderr, flush=True)
        rollback(client, previous_commit)
        raise


def main() -> None:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="action", required=True)
    subparsers.add_parser("preflight")
    deploy_parser = subparsers.add_parser("deploy")
    deploy_parser.add_argument("commit")
    rollback_parser = subparsers.add_parser("rollback")
    rollback_parser.add_argument("commit")
    args = parser.parse_args()

    client = connect()
    try:
        if args.action == "preflight":
            preflight(client)
        elif args.action == "deploy":
            deploy(client, args.commit)
        else:
            rollback(client, args.commit)
    finally:
        client.close()


if __name__ == "__main__":
    main()
