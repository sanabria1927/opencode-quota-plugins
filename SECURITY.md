# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Instead, use
GitHub's [private vulnerability reporting](../../security/advisories/new) or
contact the maintainer (`@sanabria1927`).

## Credentials

These plugins are designed to **never** persist, log, or print credentials:

- They read keys/tokens from the active OpenCode V2 credential store
  (`context.client.credential.list()`), from environment variables, or from
  legacy `auth.json` files — read only.
- No credential value is ever written to disk, echoed, or included in error
  messages.

When contributing, please make sure you never commit credentials, tokens, or
personal configuration. The repository `.gitignore` excludes `node_modules/`,
`.env*` and `auth.json`. CI rejects nothing automatically yet, so reviewers must
stay vigilant.
