# Environments

## Development

Default local snapshot `hearth:v1:development`. The top-bar pill reads Development. Demo data is fictional CAD.

## Production

Second local snapshot `hearth:v1:production`. Empty until Jonathan starts it. The pill reads Production.

## Sheets (main branch only)

The Google development Sheet and production Sheet remain on `main`. This branch does not clasp-push and does not store Script IDs.

## Hosted household

The books are PostgreSQL (PGlite on the phone; Neon or Supabase when Jonathan creates a project). A linked household may still use a Netlify blob as a pairing envelope. That blob is not the ledger. Development and production on a phone can each hold a different household. Default experiments to development.
