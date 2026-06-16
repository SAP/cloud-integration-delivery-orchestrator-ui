#!/bin/bash
# RFC 019: Test approuter errorPage JSON response for 5xx
# This script temporarily patches local-debug config, starts approuter,
# verifies 502 returns gateway-error.json, then cleans up.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCAL_DEBUG="$PROJECT_DIR/local-debug"
APPROUTER_PORT=8844
BACKEND_PORT=8080

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cleanup() {
  echo ""
  echo -e "${YELLOW}[cleanup]${NC} Restoring original config..."

  # Kill approuter if we started it
  if [ -n "$APPROUTER_PID" ]; then
    kill "$APPROUTER_PID" 2>/dev/null || true
    wait "$APPROUTER_PID" 2>/dev/null || true
  fi

  # Restore xs-app.json
  if [ -f "$LOCAL_DEBUG/xs-app.json.bak" ]; then
    mv "$LOCAL_DEBUG/xs-app.json.bak" "$LOCAL_DEBUG/xs-app.json"
  fi

  # Remove test file
  rm -f "$LOCAL_DEBUG/gateway-error.json"

  echo -e "${GREEN}[cleanup]${NC} Done."
}

trap cleanup EXIT

# --- Pre-checks ---

# Ensure approuter is installed
if [ ! -f "$LOCAL_DEBUG/node_modules/@sap/approuter/approuter.js" ]; then
  echo -e "${RED}[error]${NC} Approuter not installed. Run: cd $LOCAL_DEBUG && npm install"
  exit 1
fi

# Ensure backend is NOT running
if lsof -i ":$BACKEND_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo -e "${RED}[error]${NC} Backend is running on port $BACKEND_PORT. Please stop it first."
  echo "  Kill it with: lsof -ti :$BACKEND_PORT | xargs kill"
  exit 1
fi

# Ensure approuter port is free
if lsof -i ":$APPROUTER_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo -e "${RED}[error]${NC} Port $APPROUTER_PORT is already in use. Please free it first."
  exit 1
fi

# --- Setup ---

echo -e "${YELLOW}[setup]${NC} Copying gateway-error.json to local-debug/"
cp "$PROJECT_DIR/public/gateway-error.json" "$LOCAL_DEBUG/gateway-error.json"

echo -e "${YELLOW}[setup]${NC} Patching local-debug/xs-app.json (auth=none + errorPage)"
cp "$LOCAL_DEBUG/xs-app.json" "$LOCAL_DEBUG/xs-app.json.bak"

cat > "$LOCAL_DEBUG/xs-app.json" << 'EOF'
{
  "authenticationMethod": "route",
  "routes": [
    {
      "source": "^/user-api(.*)",
      "target": "$1",
      "service": "sap-approuter-userapi",
      "authenticationType": "none"
    },
    {
      "source": ".*/api/v1/(.*)$",
      "target": "$1",
      "destination": "backendservice",
      "csrfProtection": false,
      "authenticationType": "none"
    },
    {
      "source": "^/(.*)$",
      "target": "$1",
      "destination": "vite-dev-server"
    }
  ],
  "logout": {
    "logoutEndpoint": "/logout"
  },
  "websockets": {
    "enabled": true
  },
  "errorPage": [
    {"status": [502, 503, 504], "file": "gateway-error.json"}
  ]
}
EOF

# --- Start approuter ---

echo -e "${YELLOW}[start]${NC} Starting approuter on port $APPROUTER_PORT..."
cd "$LOCAL_DEBUG"
node node_modules/@sap/approuter/approuter.js &
APPROUTER_PID=$!
cd "$PROJECT_DIR"

# Wait for approuter to be ready
echo -n "  Waiting for approuter"
for i in $(seq 1 15); do
  if curl -s -o /dev/null "http://localhost:$APPROUTER_PORT" 2>/dev/null; then
    echo " ready!"
    break
  fi
  echo -n "."
  sleep 1
done

if ! curl -s -o /dev/null "http://localhost:$APPROUTER_PORT" 2>/dev/null; then
  echo ""
  echo -e "${RED}[error]${NC} Approuter did not start within 15s."
  exit 1
fi

# --- Test ---

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${YELLOW}[test]${NC} GET http://localhost:$APPROUTER_PORT/api/v1/system/integrations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

RESPONSE=$(curl -s -w "\n---HTTP_STATUS:%{http_code}---\n---CONTENT_TYPE:%{content_type}---" \
  "http://localhost:$APPROUTER_PORT/api/v1/system/integrations" 2>&1)

BODY=$(echo "$RESPONSE" | sed '/^---HTTP_STATUS:/d' | sed '/^---CONTENT_TYPE:/d')
STATUS=$(echo "$RESPONSE" | grep -o 'HTTP_STATUS:[0-9]*' | cut -d: -f2)
CONTENT_TYPE=$(echo "$RESPONSE" | grep -o 'CONTENT_TYPE:.*' | cut -d: -f2-)

echo "  Status:       $STATUS"
echo "  Content-Type: $CONTENT_TYPE"
echo "  Body:         $BODY"
echo ""

# --- Assertions ---

PASS=true

if [ "$STATUS" = "502" ]; then
  echo -e "  ${GREEN}✓${NC} Status code is 502"
else
  echo -e "  ${RED}✗${NC} Expected status 502, got $STATUS"
  PASS=false
fi

if echo "$CONTENT_TYPE" | grep -q "application/json"; then
  echo -e "  ${GREEN}✓${NC} Content-Type is application/json"
else
  echo -e "  ${RED}✗${NC} Expected Content-Type application/json, got: $CONTENT_TYPE"
  PASS=false
fi

if echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d['code']=='GATEWAY_UNAVAILABLE'" 2>/dev/null; then
  echo -e "  ${GREEN}✓${NC} Body contains code: GATEWAY_UNAVAILABLE"
else
  echo -e "  ${RED}✗${NC} Body missing or invalid 'code' field"
  PASS=false
fi

if echo "$BODY" | python3 -c "import json,sys; d=json.load(sys.stdin); assert 'message' in d and len(d['message'])>0" 2>/dev/null; then
  echo -e "  ${GREEN}✓${NC} Body contains non-empty message"
else
  echo -e "  ${RED}✗${NC} Body missing or empty 'message' field"
  PASS=false
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$PASS" = true ]; then
  echo -e "  ${GREEN}ALL CHECKS PASSED${NC} — errorPage JSON direct-serve works!"
else
  echo -e "  ${RED}SOME CHECKS FAILED${NC} — review output above"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# cleanup runs via trap
