-- Notification emails now carry a sign-in link, so a client goes from "there's
-- an update" to reading it in one click instead of being asked to prove they
-- own the inbox the email was just delivered to.
--
-- These tokens differ from a requested magic link in two ways, and the column
-- is what keeps them apart:
--
--   1. They live longer. A sign-in link is used within minutes of asking for
--      one; a notification is read whenever the inbox is next opened, and a
--      60-minute link would usually be dead on arrival — which is the second
--      round trip we are removing.
--   2. They must not count toward the anti-mailbox-spam rate limit. That limit
--      exists to stop someone hammering "send me a link"; publishing an update
--      is not that, and letting it consume the allowance would lock a client
--      out of requesting a link of their own.
ALTER TABLE auth_tokens ADD COLUMN purpose TEXT NOT NULL DEFAULT 'login'
  CHECK (purpose IN ('login','notify'));
