#!/usr/bin/env bash
set -euo pipefail

export GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=safe.directory GIT_CONFIG_VALUE_0="${PWD}"

resolve_diff_base() {
  local base="${BASE:-${GITHUB_BASE_REF:-origin/main}}"
  if ! git rev-parse --verify --quiet "${base}^{commit}" >/dev/null 2>&1; then
    base="HEAD~1"
  fi
  printf '%s' "${base}"
}

has_exempt_trailer() {
  git log "${2}..HEAD" --format='%B' 2>/dev/null | grep -qiE "^${1}-exempt:[[:space:]]*\S"
}
