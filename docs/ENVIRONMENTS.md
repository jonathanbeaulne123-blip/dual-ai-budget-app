# Environments

## Development

Default local snapshot `hearth:v1:development`. The top-bar pill reads Development. Demo data is fictional CAD.

## Production

Second local snapshot `hearth:v1:production`. Empty until Jonathan starts it. The pill reads Production.

## Sheets (main branch only)

The Google development Sheet and production Sheet remain on `main`. This branch does not clasp-push and does not store Script IDs.

## Hosted household

A linked household uses a six-character invite code. Shared rows live in one Netlify blob; each member's personal-only rows live in a second blob. Development and production on a phone can each link to a different code. Default experiments to development.
