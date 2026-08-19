import subprocess
import paramiko
import sys

VPS_HOST = "91.108.105.120"
VPS_USER = "root"
VPS_PASS = "Som@9870740681"
APP_DIR = "/home/ayurvedacare/99store-oms"

def run_local(cmd):
    print(f"[LOCAL] Running: {cmd}")
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if res.stdout:
        print(res.stdout.strip())
    if res.stderr and res.returncode != 0:
        print(f"[LOCAL ERROR] {res.stderr.strip()}")
    return res.returncode == 0

def main():
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    print("=========================================")
    print(" [DEPLOY] 99Store OMS Automatic 1-Click Deployer")
    print("=========================================")

    if len(sys.argv) > 1:
        commit_msg = " ".join(sys.argv[1:])
    else:
        try:
            commit_msg = input("Enter commit message (or press Enter for default): ").strip()
        except (EOFError, Exception):
            commit_msg = "Deploy update with MongoDB migration"
        if not commit_msg:
            commit_msg = "Deploy update with MongoDB migration"

    # 1. Local Git Add, Commit, and Push
    print("\n1. Staging and committing local changes...")
    run_local("git add .")
    run_local(f'git commit -m "{commit_msg}"')
    
    print("\n2. Pushing to GitHub (origin/master)...")
    if not run_local("git push origin master"):
        print("[WARNING] Git push encountered an issue or branch is already up to date.")

    # 2. Remote VPS Execution via SSH
    print("\n3. Connecting to VPS via SSH...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(VPS_HOST, username=VPS_USER, password=VPS_PASS, timeout=10)
        print("Connected to VPS successfully!")
    except Exception as e:
        print(f"[SSH ERROR] Failed to connect to VPS: {e}")
        sys.exit(1)

    remote_commands = [
        ("Stashing local changes & Pulling latest code from GitHub", f"cd {APP_DIR} && git checkout -- data/db.json 2>/dev/null || true && git pull origin master"),
        ("Updating VPS .env.local with MongoDB configuration", f"cd {APP_DIR} && (grep -q 'MONGODB_URI' .env.local || echo -e '\nMONGODB_URI=\"mongodb+srv://official_db_user:CRLbrDDHkCxHM63i@99storecluster0.o4cakf9.mongodb.net/99store-oms?appName=99StoreCluster0\"\nUSE_MONGODB=true\n' >> .env.local)"),
        ("Installing Node packages", f"cd {APP_DIR} && npm install --production=false"),
        ("Building Next.js application", f"cd {APP_DIR} && npm run build"),
        ("Reloading PM2 service", f"cd {APP_DIR} && pm2 restart ecosystem.config.js --update-env && pm2 save")
    ]

    for label, cmd in remote_commands:
        print(f"\n[VPS] {label}...")
        stdin, stdout, stderr = client.exec_command(cmd, timeout=180)
        out = stdout.read().decode('utf-8', errors='replace').strip()
        err = stderr.read().decode('utf-8', errors='replace').strip()
        if out:
            out_safe = out.encode('ascii', errors='backslashreplace').decode('ascii')
            print(out_safe[-800:] if len(out_safe) > 800 else out_safe)
        if err:
            err_safe = err.encode('ascii', errors='backslashreplace').decode('ascii')
            print(f"[VPS Notice/Stderr] {err_safe[-500:] if len(err_safe) > 500 else err_safe}")

    print("\n=========================================")
    print(" [SUCCESS] VPS Deployment Completed Successfully!")
    print("=========================================")
    client.close()

if __name__ == "__main__":
    main()
