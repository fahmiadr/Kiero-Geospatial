#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# --- Configuration ---
TEST_CLIENT_NAME="Test Iframe Client"
TEST_CLIENT_ORIGINS="http://localhost:5173"
TEST_PRIVATE_KEY_FILE="test_client_private.pem"
TEST_PUBLIC_KEY_FILE="test_client_public.pem"
SIMULATOR_COPY_FILE="frontend/public/iframe-parent-simulator-TEST.html"

# --- Helper Functions ---
function cleanup() {
  echo -e "\n--- 🧹 Cleaning up ---"
  echo "Finding and killing server processes on ports 3000, 4000, 5173..."
  
  # This is a more robust way to kill processes, especially in Git Bash on Windows
  # It finds the process ID (PID) listening on a specific TCP port and kills it.
  # The `|| true` prevents the script from exiting if a process isn't found (e.g., if it already crashed).
  lsof -ti tcp:3000 | xargs kill -9 2>/dev/null || true
  lsof -ti tcp:4000 | xargs kill -9 2>/dev/null || true
  lsof -ti tcp:5173 | xargs kill -9 2>/dev/null || true
  
  echo "Removing temporary files..."
  rm -f $TEST_PRIVATE_KEY_FILE $TEST_PUBLIC_KEY_FILE $SIMULATOR_COPY_FILE
  
  echo "Cleanup complete."
}

# Trap EXIT signal to ensure cleanup runs
trap cleanup EXIT

# --- Main Script ---
echo "--- 🚀 Starting Iframe End-to-End Test Setup ---"

# 1. Generate new RSA key pair for the test client
echo -e "\n--- 🔑 Step 1: Generating new RSA key pair for test client ---"
openssl genrsa -out $TEST_PRIVATE_KEY_FILE 2048 &>/dev/null
openssl rsa -in $TEST_PRIVATE_KEY_FILE -pubout -out $TEST_PUBLIC_KEY_FILE &>/dev/null
echo "✅ Successfully created $TEST_PRIVATE_KEY_FILE and $TEST_PUBLIC_KEY_FILE"

# 2. Register the new client with the geo-gateway (non-interactive)
echo -e "\n--- 📝 Step 2: Registering new client with the geo-gateway ---"
PUBLIC_KEY_PATH=$(pwd)/$TEST_PUBLIC_KEY_FILE
# The register_client script now prints ONLY the clientId to stdout.
CLIENT_ID=$(npm run register_client --silent --prefix geo-gateway -- \
  --clientName "$TEST_CLIENT_NAME" \
  --allowedOrigins "$TEST_CLIENT_ORIGINS" \
  --authMethod private_key_jwt \
  --publicKeyPath "$PUBLIC_KEY_PATH")

if [ -z "$CLIENT_ID" ]; then
  echo "❌ ERROR: Failed to get Client ID from registration script."
  exit 1
fi
echo "✅ Client registered successfully with Client ID: $CLIENT_ID"

# 3. Create a JWT Assertion for the new client
echo -e "\n--- 🔐 Step 3: Creating a valid JWT Assertion ---"
PRIVATE_KEY_PATH=$(pwd)/$TEST_PRIVATE_KEY_FILE
JWT_ASSERTION=$(npm run create_jwt_from_key --silent --prefix geo-gateway -- --clientId "$CLIENT_ID" --privateKeyPath "$PRIVATE_KEY_PATH")

if [ -z "$JWT_ASSERTION" ]; then
  echo "❌ ERROR: Failed to create JWT Assertion."
  exit 1
fi
echo "✅ JWT Assertion generated successfully."

# 4. Prepare the simulator file with the new assertion
echo -e "\n--- 📄 Step 4: Preparing the test simulator HTML file ---"
TMP_SIMULATOR=$(mktemp)
sed "s|value=\"REPLACE_WITH_VALID_TEST_ASSERTION\"|value=\"$JWT_ASSERTION\"|" frontend/public/iframe-parent-simulator.html > "$TMP_SIMULATOR"
mv "$TMP_SIMULATOR" "$SIMULATOR_COPY_FILE"
echo "✅ Created test simulator at $SIMULATOR_COPY_FILE"

# 5. Start all services
echo -e "\n--- 🖥️ Step 5: Starting all services in the background ---"
echo "Starting geo-gateway..."
npm start --prefix geo-gateway > geo-gateway.log 2>&1 &

echo "Starting backend..."
npm start --prefix backend > backend.log 2>&1 &

echo "Starting frontend..."
npm run dev --prefix frontend > frontend.log 2>&1 &

echo "Waiting for services to initialize (this may take up to 15 seconds)..."
sleep 15

echo "✅ All services are running."
echo "   - Geo-Gateway logs: geo-gateway.log"
echo "   - Backend logs: backend.log"
echo "   - Frontend logs: frontend.log"

# 6. Provide instructions for manual testing
echo -e "\n\n--- ▶️ Step 6: Ready for Manual Testing ---"
echo "Your test environment is now running."
echo "Please follow these steps:"
echo ""
echo "1. Open the following URL in your web browser:"
echo "   ➡️  http://localhost:5173/iframe-parent-simulator-TEST.html"
echo ""
echo "2. The page should load. The 'Data Received from Iframe' section should show a message with type: 'initialized'."
echo "3. The 'Enter Phone Number' input should now be enabled."
echo "4. Enter a test phone number (e.g., 21 or 22) and click 'Search Prefix'."
echo "5. The map in the iframe should zoom to the correct region and draw its boundary."
echo "6. The 'Data Received from Iframe' section should update with the region data."
echo ""
echo "--- Press [ENTER] when you are finished testing to clean up and exit. ---"

read

exit 0
