# Source from GitHub Actions (or tests). Do not execute as a program.
# Drops wrapping quotes, BOM, newlines, HTML entities, and a leading Bearer
# so Wrangler does not send an invalid Authorization header (Cloudflare 6111).

_hearth_root="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
if python3 --version >/dev/null 2>&1; then
  _hearth_python=python3
elif python --version >/dev/null 2>&1; then
  _hearth_python=python
else
  echo "Python is required to sanitize deployment environment values." >&2
  return 1
fi
export CLOUDFLARE_API_TOKEN="$("$_hearth_python" "$_hearth_root/scripts/sanitize-cloudflare-env.py" token)"
export CLOUDFLARE_ACCOUNT_ID="$("$_hearth_python" "$_hearth_root/scripts/sanitize-cloudflare-env.py" account)"
export VITE_GOOGLE_CLIENT_ID="$("$_hearth_python" "$_hearth_root/scripts/sanitize-cloudflare-env.py" google)"
unset _hearth_python _hearth_root
