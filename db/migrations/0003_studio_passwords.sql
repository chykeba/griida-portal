-- Passwords, for studio users only.
--
-- 0001 said "No passwords anywhere in this product". That was right for
-- clients and wrong for the studio: a client signs in every few weeks and a
-- link in their inbox is genuinely the easiest thing, but the team signs in
-- daily, and making them fetch an email to open their own tool is a tax paid
-- several times a day. So the rule narrows rather than disappears — clients
-- stay link-only, and the CHECK below is what stops that drifting.
--
-- Magic links stay for everyone. For the studio they become the recovery path,
-- which is why there is no reset token, no reset email and no reset flow: the
-- mechanism already existed and already proves control of the address.

ALTER TABLE users ADD COLUMN password_hash TEXT;
ALTER TABLE users ADD COLUMN password_set_at TEXT;

-- Guessing counters. A magic link can't be brute-forced — single use, sixty
-- minutes, and already in the recipient's inbox. A password can be tried all
-- day, so this is the part that isn't optional.
ALTER TABLE users ADD COLUMN failed_signins INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TEXT;

-- SQLite can't add a CHECK to an existing table, so the invariant is a trigger.
-- Belt and braces: lib/auth/passwords.ts refuses first, and this refuses if a
-- future query forgets to.
CREATE TRIGGER users_passwords_are_studio_only
BEFORE UPDATE OF password_hash ON users
WHEN NEW.password_hash IS NOT NULL AND NEW.kind != 'studio'
BEGIN
  SELECT RAISE(ABORT, 'passwords are for studio users only');
END;
