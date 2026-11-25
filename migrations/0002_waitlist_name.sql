ALTER TABLE waitlist_signups
  ADD COLUMN name TEXT CHECK (length(trim(name)) BETWEEN 1 AND 120);
