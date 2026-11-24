import paramiko
import sys

host = '91.108.105.120'
user = 'root'
password = 'Som@9870740681'
token = 'd0421da095db09c063ae7bf05b54b95005b9ed8d'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=password, timeout=15)

# Upload a bash test script to the VPS
bash_script = """#!/bin/bash
TOKEN='d0421da095db09c063ae7bf05b54b95005b9ed8d'

test_endpoint() {
    local label="$1"
    local url="$2"
    local method="${3:-GET}"
    echo "=== $label ==="
    result=$(curl -s -o /tmp/sfax_body.txt -w "%{http_code}" \\
        -X "$method" \\
        -H "Authorization: Token $TOKEN" \\
        -H "Accept: application/json" \\
        -H "Content-Type: application/json" \\
        "$url" 2>/dev/null)
    echo "HTTP Status: $result"
    echo "Body:"
    cat /tmp/sfax_body.txt | python3 -m json.tool 2>/dev/null || cat /tmp/sfax_body.txt
    echo ""
}

echo "==============================="
echo " PRODUCTION: dale.shadowfax.in"
echo "==============================="
test_endpoint "PROD serviceability customer_delivery 110001" "https://dale.shadowfax.in/api/v1/clients/serviceability/?service=customer_delivery&pincodes=110001"
test_endpoint "PROD serviceability warehouse_pickup 110001" "https://dale.shadowfax.in/api/v1/clients/serviceability/?service=warehouse_pickup&pincodes=110001"
test_endpoint "PROD generate marketplace AWB" "https://dale.shadowfax.in/api/v3/clients/generate_marketplace_awb/" "POST"
test_endpoint "PROD track fake AWB" "https://dale.shadowfax.in/api/v4/clients/orders/SF000000001/track/"

echo "==============================="
echo " STAGING: dale.staging.shadowfax.in"
echo "==============================="
test_endpoint "STAGING serviceability customer_delivery 110001" "https://dale.staging.shadowfax.in/api/v1/clients/serviceability/?service=customer_delivery&pincodes=110001"
test_endpoint "STAGING serviceability warehouse_pickup 110001" "https://dale.staging.shadowfax.in/api/v1/clients/serviceability/?service=warehouse_pickup&pincodes=110001"
test_endpoint "STAGING generate marketplace AWB" "https://dale.staging.shadowfax.in/api/v3/clients/generate_marketplace_awb/" "POST"
"""

# Write bash script via SFTP
sftp = client.open_sftp()
with sftp.open('/tmp/test_sfax.sh', 'w') as f:
    f.write(bash_script)
sftp.close()

# Make executable and run
stdin, stdout, stderr = client.exec_command(
    'chmod +x /tmp/test_sfax.sh && bash /tmp/test_sfax.sh',
    timeout=45
)
out = stdout.read().decode()
err = stderr.read().decode()
print(out)
if err:
    print('STDERR:', err[:500])
client.close()
