#!/usr/bin/env python3
"""Make Cloudflare/GitHub secret values safe for Wrangler Authorization headers.

GitHub secret pastes often include wrapping quotes (ASCII or curly), a UTF-8 BOM,
newlines, HTML entities, or a leading \"Bearer \". Wrangler then sends
`Authorization: Bearer \"…\"` and Cloudflare returns 6111.
"""

from __future__ import annotations

import html
import os
import sys

QUOTES = set("\"'`«»“”‘’＂＇")
TOKEN_CHARS = set("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.")


def clean(raw: str) -> str:
    s = html.unescape(raw or "")
    s = s.lstrip("\ufeff").replace("\r", "").replace("\n", "").replace("\\", "")
    s = s.strip()
    while s and (s[0] in QUOTES or s[-1] in QUOTES):
        if s[0] in QUOTES:
            s = s[1:]
        if s and s[-1] in QUOTES:
            s = s[:-1]
        s = s.strip()
    if s[:6].lower() == "bearer" and (len(s) == 6 or s[6].isspace() or s[6] in QUOTES):
        s = s[6:].strip()
        while s and s[0] in QUOTES:
            s = s[1:].strip()
    return "".join(c for c in s if c in TOKEN_CHARS)


def main() -> None:
    kind = sys.argv[1] if len(sys.argv) > 1 else ""
    mapping = {
        "token": "CLOUDFLARE_API_TOKEN",
        "account": "CLOUDFLARE_ACCOUNT_ID",
        "google": "VITE_GOOGLE_CLIENT_ID",
    }
    if kind not in mapping:
        sys.stderr.write("usage: sanitize-cloudflare-env.py token|account|google\n")
        sys.exit(2)
    sys.stdout.write(clean(os.environ.get(mapping[kind], "")))


if __name__ == "__main__":
    main()
