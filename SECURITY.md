# Security Policy

## Reporting a vulnerability

If you believe you've found a security vulnerability in mes.chacha, please
**do not open a public GitHub issue**. Instead, report it privately:

- Open a [GitHub Security Advisory](../../security/advisories/new) on this
  repo (preferred — keeps the report private until resolved), or
- Contact the maintainer directly (see profile for contact info).

Please include:
- A description of the issue and its potential impact
- Steps to reproduce
- Which part of the app is affected (WebRTC signaling, the encryption layer,
  the QR/connection-code parsing, etc.)

## What's in scope

- The application code in `js/app.js` and `index.html`
- The encryption design (passphrase-derived AES-GCM, PBKDF2 key derivation,
  the verification-code scheme)
- Connection-code parsing and validation

## What's out of scope

- The vendored `js/qrcode.js` library — report issues with it upstream at
  [kazuhikoarase/qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)
  unless the issue is specifically in how *this project* uses it
- Browser-level WebRTC/DTLS implementation bugs — report those to the
  relevant browser vendor
- Denial-of-service via someone you've already voluntarily connected to and
  exchanged a passphrase with (the threat model here is a passive/active
  network attacker or a malicious code sender, not an already-trusted peer)

## Design limitations (known, not vulnerabilities)

These are documented tradeoffs, not bugs — see the README's
[Security model](README.md#security-model) section for the full explanation:

- No peer identity system beyond the shared passphrase + verification code
- Connection codes reveal ICE candidate metadata (local/public IP) to
  whoever holds them
- No TURN server is bundled by default, so connectivity — not security — can
  fail on strict NATs/firewalls
- No protection against a compromised passphrase-sharing channel; the
  passphrase must be exchanged through a channel you already trust

## Disclosure timeline

This is a hobby/open-source project without a dedicated security team.
Please allow a reasonable window (aim for 90 days) before public disclosure
so a fix can be released.
