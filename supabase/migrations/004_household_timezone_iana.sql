-- D-126: allow any non-empty IANA household timezone on hosted Development.
-- DO NOT APPLY without Jonathan's explicit approval.
-- Local PGlite already relaxes this in BOOKS_SCHEMA_VERSION 2.

ALTER TABLE households DROP CONSTRAINT IF EXISTS households_timezone_check;
ALTER TABLE households
  ADD CONSTRAINT households_timezone_nonempty CHECK (char_length(timezone) > 0);
