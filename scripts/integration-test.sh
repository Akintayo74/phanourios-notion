#!/usr/bin/env bash
# Integration test: run pan --dry-run against a test page and verify output.
# Usage: ./scripts/integration-test.sh <notion-page-url>
#
# Requires:
#   - ANTHROPIC_API_KEY set in environment
#   - pan init already completed (~/.pan/config.json must exist)
#   - bun link run so that `pan` is available, OR bun run dev used directly

set -e

URL="${1:-}"
if [[ -z "$URL" ]]; then
  echo "Usage: $0 <notion-page-url>"
  exit 1
fi

if [[ -z "$ANTHROPIC_API_KEY" ]]; then
  echo "Error: ANTHROPIC_API_KEY is not set."
  exit 1
fi

echo "Running integration test against: $URL"
echo ""

OUTPUT=$(pan --dry-run "$URL" 2>&1)
EXIT_CODE=$?

if [[ $EXIT_CODE -ne 0 ]]; then
  echo "FAIL: pan exited with code $EXIT_CODE"
  echo ""
  echo "$OUTPUT"
  exit 1
fi

if ! echo "$OUTPUT" | grep -q "Threads & Constellations"; then
  echo "FAIL: output does not contain 'Threads & Constellations'"
  echo ""
  echo "$OUTPUT"
  exit 1
fi

if [[ $(echo "$OUTPUT" | grep -c "<details>") -lt 2 ]]; then
  echo "FAIL: output does not contain any sub-toggles"
  echo ""
  echo "$OUTPUT"
  exit 1
fi

echo "PASS: toggle found in output"
echo ""
echo "$OUTPUT"
