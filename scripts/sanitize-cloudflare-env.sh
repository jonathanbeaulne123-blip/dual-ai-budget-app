# Source from GitHub Actions (or tests). Do not execute as a program.
# Drops wrapping quotes, BOM, newlines, HTML entities, and a leading Bearer
# so Wrangler does not send an invalid Authorization header (Cloudflare 6111).

_hearth_root="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
export CLOUDFLARE_API_TOKEN="$(python3 "$_hearth_root/scripts/sanitize-cloudflare-env.py" token)"
export CLOUDFLARE_ACCOUNT_ID="$(python3 "$_hearth_root/scripts/sanitize-cloudflare-env.py" account)"
export VITE_GOOGLE_CLIENT_ID="$(python3 "$_hearth_root/scripts/sanitize-cloudflare-env.py" google)"
unset _hearth_root
