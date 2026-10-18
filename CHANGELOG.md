# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-10-18

### Added
- `opencode-go-usage`: sidebar widget for OpenCode Go quota (5h / weekly /
  monthly), `/go-usage` toast, multi-account support with a native account
  switcher (`/go-accounts`) and `●`/`○` active markers. Shows only the account
  currently in use.
- `codex-quota`: sidebar widget for Codex (ChatGPT) primary/secondary windows,
  `/codex-quota` toast, 5-minute refresh to avoid `HTTP 429`.
- `cline-quota`: sidebar widget for ClinePass 5h / weekly / monthly windows plus
  the active plan, `/cline-usage` toast.
- Credential resolution from the active OpenCode V2 credential store
  (`context.client.credential.list()`), with environment variables and legacy
  `auth.json` files as fallbacks. Keys are never logged or printed.
- Bilingual documentation (English / Español), CI, and unit tests.

[1.0.0]: https://github.com/sanabria1927/opencode-quota-plugins/releases/tag/v1.0.0
