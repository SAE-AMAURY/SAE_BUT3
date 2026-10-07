#!/usr/bin/env bash
set -euo pipefail

source "$(dirname "${BASH_SOURCE[0]}")/diff-base.sh"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m'

TEST_PATHS="^(backend/tests/|frontend/e2e/|tests/)"

RULE_PATHS=()
RULE_RE=()
RULE_SAYS=()

add_rule() {
  RULE_PATHS+=("$1")
  RULE_RE+=("$2")
  RULE_SAYS+=("$3")
}

# Détection des triches courantes (Playwright, Jest, Mocha, Python)
add_rule "${TEST_PATHS}" '^[[:space:]]*(\.only\(|test\.only\(|describe\.only\(|it\.only\()' "Test exclusif (.only) : les autres tests sont ignorés"
add_rule "${TEST_PATHS}" '^[[:space:]]*(test\.skip\(|describe\.skip\(|it\.skip\(|@skip|@wip)' "Test ignoré (.skip) : le test n'est plus exécuté"
add_rule "${TEST_PATHS}" '(eslint-disable|# ?noqa|ts-ignore)' "Suppression de règle de linter dans les tests"

BASE="$(resolve_diff_base)"
echo -e "${BLUE}🕵 Exécution du contrôle d'intégrité anti-triche (base: ${BASE})...${NC}"

diff_range=("${BASE}...HEAD")
if [ "${BASE}" = "HEAD" ]; then
  diff_range=(HEAD)
  git add -N . >/dev/null 2>&1 || true
fi

if ! diff_output="$(git diff --unified=0 --diff-filter=ACMR "${diff_range[@]}")"; then
  echo -e "${RED}❌ Impossible de calculer le diff contre ${BASE}.${NC}" >&2
  exit 1
fi

findings=()
file=''
lineno=0

while IFS= read -r line; do
  case "${line}" in
    '+++ b/'*)
      file="${line#+++ b/}"
      continue
      ;;
    '@@'*)
      hunk="${line#*+}"
      hunk="${hunk%% *}"
      lineno="${hunk%%,*}"
      continue
      ;;
    '+'*) ;;
    *) continue ;;
  esac

  [ -n "${file}" ] || continue
  content="${line#+}"

  for i in "${!RULE_RE[@]}"; do
    if [[ "${file}" =~ ${RULE_PATHS[$i]} ]] && [[ "${content}" =~ ${RULE_RE[$i]} ]]; then
      findings+=("${file}:${lineno}|${content}|${RULE_SAYS[$i]}")
    fi
  done
  lineno=$((lineno + 1))
done <<<"${diff_output}"

if [ "${#findings[@]}" -eq 0 ]; then
  echo -e "${GREEN}✅ Aucun contournement de test détecté.${NC}"
  exit 0
fi

if has_exempt_trailer "No-cheat" "${BASE}"; then
  echo -e "${YELLOW}⚠️ Contournement détecté mais validé par un trailer 'No-cheat-exempt:'.${NC}"
  exit 0
fi

echo -e "${RED}❌ Des tests ou règles de sécurité ont été neutralisés :${NC}"
for finding in "${findings[@]}"; do
  where="${finding%%|*}"
  rest="${finding#*|}"
  echo -e "   ${RED}~${NC} ${where}"
  echo "       Code : ${rest%%|*}"
  echo "       Raison : ${rest#*|}"
done
exit 1
