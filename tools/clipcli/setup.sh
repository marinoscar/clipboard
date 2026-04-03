#!/usr/bin/env bash
#
# setup.sh — One-liner installer for clipcli
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/marinoscar/clipboard/main/tools/clipcli/setup.sh | bash
#
# This script:
#   1. Checks prerequisites (git, Node.js >= 18)
#   2. Clones the clipboard repo (or pulls if already cloned)
#   3. Runs the full install.sh
#
set -euo pipefail

REPO_URL="https://github.com/marinoscar/clipboard.git"
INSTALL_DIR="${HOME}/clipboard"

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------

if [ -t 1 ]; then
  RED='\033[0;31m' GREEN='\033[0;32m' CYAN='\033[0;36m' BOLD='\033[1m' DIM='\033[2m' RESET='\033[0m'
else
  RED='' GREEN='' CYAN='' BOLD='' DIM='' RESET=''
fi

info()    { echo -e "${CYAN}${BOLD}[info]${RESET}  $*"; }
success() { echo -e "${GREEN}${BOLD}[ok]${RESET}    $*"; }
fail()    { echo -e "${RED}${BOLD}[error]${RESET} $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Prerequisites
# ---------------------------------------------------------------------------

echo ""
echo -e "${BOLD}clipcli — Quick Setup${RESET}"
echo -e "${DIM}─────────────────────${RESET}"
echo ""

command -v git &>/dev/null || fail "git is not installed."
command -v node &>/dev/null || fail "Node.js is not installed. Install Node.js 18+ first."

NODE_MAJOR="$(node -v | sed 's/^v//' | cut -d. -f1)"
[ "${NODE_MAJOR}" -ge 18 ] || fail "Node.js $(node -v) found but 18+ is required."

# ---------------------------------------------------------------------------
# Clone or update
# ---------------------------------------------------------------------------

if [ -d "${INSTALL_DIR}/.git" ]; then
  info "Repository already exists at ${INSTALL_DIR} — pulling latest..."
  (cd "${INSTALL_DIR}" && git pull origin main 2>&1 | tail -3)
  success "Updated"
else
  info "Cloning repository to ${INSTALL_DIR}..."
  git clone "${REPO_URL}" "${INSTALL_DIR}" 2>&1 | tail -3
  success "Cloned"
fi

# ---------------------------------------------------------------------------
# Run install.sh
# ---------------------------------------------------------------------------

info "Running install script..."
echo ""
bash "${INSTALL_DIR}/tools/clipcli/install.sh"
