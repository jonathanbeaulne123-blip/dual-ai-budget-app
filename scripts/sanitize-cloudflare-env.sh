# Source from GitHub Actions (or tests). Do not execute as a program.
# GitHub secret values are sometimes pasted with wrapping quotes, CR, or a
# leading "Bearer ". Wrangler then sends an invalid Authorization header (6111).

_hearth_sanitize() {
  local v
  v=$(printf '%s' "${1-}" | tr -d '\r')
  v="${v#"${v%%[![:space:]]*}"}"
  v="${v%"${v##*[![:space:]]}"}"
  while [[ "$v" == \"*\" || "$v" == \'*\' ]]; do
    v="${v:1:${#v}-2}"
  done
  if [[ "$v" =~ ^[Bb]earer[[:space:]]+ ]]; then
    v="${v:6}"
    v="${v#"${v%%[![:space:]]*}"}"
  fi
  printf '%s' "$v"
}

export CLOUDFLARE_API_TOKEN="$(_hearth_sanitize "${CLOUDFLARE_API_TOKEN-}")"
export CLOUDFLARE_ACCOUNT_ID="$(_hearth_sanitize "${CLOUDFLARE_ACCOUNT_ID-}")"
export VITE_GOOGLE_CLIENT_ID="$(_hearth_sanitize "${VITE_GOOGLE_CLIENT_ID-}")"
unset -f _hearth_sanitize
