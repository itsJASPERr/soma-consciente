-- Record the two migrations already applied to the first SOMA waitlist databases.
-- A new database has no waitlist table and Wrangler applies both migrations normally.
CREATE TABLE IF NOT EXISTS d1_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

INSERT OR IGNORE INTO d1_migrations (name)
SELECT '0001_waitlist.sql'
WHERE EXISTS (
  SELECT 1 FROM sqlite_schema
  WHERE type = 'table' AND name = 'waitlist_signups'
    AND instr(sql, 'CHECK (channel IN (') > 0
    AND instr(sql, 'PRIMARY KEY (channel, contact)') > 0
    AND instr(sql, 'consented_at TEXT NOT NULL DEFAULT') > 0
)
AND (
  SELECT COUNT(*) FROM pragma_table_info('waitlist_signups')
  WHERE name IN ('channel', 'contact', 'consent_version', 'consented_at')
    AND type = 'TEXT' AND "notnull" = 1
) = 4;

INSERT OR IGNORE INTO d1_migrations (name)
SELECT '0002_waitlist_name.sql'
WHERE EXISTS (SELECT 1 FROM d1_migrations WHERE name = '0001_waitlist.sql')
  AND EXISTS (
    SELECT 1 FROM sqlite_schema
    WHERE type = 'table' AND name = 'waitlist_signups'
      AND instr(sql, 'length(trim(name)) BETWEEN 1 AND 120') > 0
  )
  AND EXISTS (
    SELECT 1 FROM pragma_table_info('waitlist_signups')
    WHERE name = 'name' AND type = 'TEXT' AND "notnull" = 0
  );
