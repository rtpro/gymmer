#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_JS="$ROOT_DIR/app.js"
INDEX_HTML="$ROOT_DIR/index.html"
SW_JS="$ROOT_DIR/sw.js"

pass() {
  printf 'PASS: %s\n' "$1"
}

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

assert_file() {
  local file="$1"
  [ -f "$file" ] || fail "Missing required file: $file"
}

assert_contains() {
  local file="$1"
  local pattern="$2"
  local label="$3"
  if rg -q "$pattern" "$file"; then
    pass "$label"
  else
    fail "$label"
  fi
}

assert_file "$APP_JS"
assert_file "$INDEX_HTML"
assert_file "$SW_JS"

assert_contains "$APP_JS" 'const PREP_SECONDS = 3;' 'Prep phase constant exists'
assert_contains "$APP_JS" 'const STORAGE_KEY = "gymmer_completions";' 'Completions storage key is stable'
assert_contains "$APP_JS" 'const SESSION_KEY = "gymmer_session_v1";' 'Session storage key is stable'

assert_contains "$APP_JS" 'phase: "work"' 'Initial phase remains work'
assert_contains "$APP_JS" '\["prep", "work", "rest"\]' 'Session restore supports prep/work/rest'
assert_contains "$APP_JS" 'navigator\.serviceWorker\.register\("sw\.js"' 'Service worker registration exists'

assert_contains "$INDEX_HTML" 'id="view-settings"' 'Settings view ID exists'
assert_contains "$INDEX_HTML" 'id="view-timer"' 'Timer view ID exists'
assert_contains "$INDEX_HTML" 'id="view-history"' 'History view ID exists'
assert_contains "$INDEX_HTML" 'id="btn-start-workout"' 'Start workout button ID exists'
assert_contains "$INDEX_HTML" 'id="btn-start"' 'Start/pause button ID exists'
assert_contains "$INDEX_HTML" 'id="btn-reset"' 'Reset button ID exists'
assert_contains "$INDEX_HTML" 'id="btn-view-history"' 'View history button ID exists'
assert_contains "$INDEX_HTML" 'id="btn-back-history"' 'Back history button ID exists'
assert_contains "$INDEX_HTML" 'id="btn-clear-history"' 'Clear history button ID exists'
assert_contains "$INDEX_HTML" 'id="custom-work"' 'Custom work input ID exists'
assert_contains "$INDEX_HTML" 'id="custom-rest"' 'Custom rest input ID exists'

assert_contains "$SW_JS" 'const CACHE_NAME = "gymmer-v[0-9]+"' 'Service worker cache key format exists'
assert_contains "$SW_JS" '"index\.html"' 'Service worker caches index.html'
assert_contains "$SW_JS" '"styles\.css"' 'Service worker caches styles.css'
assert_contains "$SW_JS" '"app\.js"' 'Service worker caches app.js'
assert_contains "$SW_JS" '"manifest\.json"' 'Service worker caches manifest.json'
assert_contains "$SW_JS" '"icon\.svg"' 'Service worker caches icon.svg'

printf '\nFeature smoke check passed.\n'
