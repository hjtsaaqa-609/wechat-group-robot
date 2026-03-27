#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
JOB_NAME="${1:-DAS周报}"

cd "$ROOT_DIR"
npm run once -- --job "$JOB_NAME"
