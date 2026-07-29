# Contributing to mes.chacha

Thanks for considering a contribution. This is a small, static, no-build-step
project, so the barrier to entry is intentionally low.

## Project structure

```
mes-chacha/
├── index.html      entry point, GitHub Pages serves this
├── css/
│   └── style.css   terminal-style UI
├── js/
│   ├── qrcode.js   vendored QR encoder (MIT, unmodified — see file header)
│   └── app.js      application logic: WebRTC signaling, crypto, chat UI
├── README.md
├── SECURITY.md
└── LICENSE
```

## Local development

No build step, no dependencies to install. Just open `index.html` in a
browser, or serve the folder with any static file server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Note: some browser features used here (clipboard access, reliable WebRTC
behavior) require a secure context. `localhost` counts as secure for local
testing; anywhere else you'll need HTTPS.

## Making changes

- Keep `js/qrcode.js` untouched — it's a vendored third-party library. If it
  ever needs updating, replace the whole file from upstream rather than
  hand-editing it, and update the license header accordingly.
- All application logic lives in `js/app.js`. Please keep the crypto
  functions (`deriveKey`, `encryptMessage`, `decryptMessage`,
  `computeVerifyCode`) isolated and well-commented — they're the part of
  this project most worth being careful with.
- If you touch anything related to encryption, connection-code parsing, or
  the verification-code flow, please explain *why* in your PR description,
  not just *what* — these are the security-relevant parts of the codebase.

## Reporting bugs

Open a GitHub issue. Please include:
- Browser + OS
- Whether you were in "offline / LAN-only mode"
- Console errors, if any (browser devtools → Console tab)

## Reporting security issues

Please see [SECURITY.md](SECURITY.md) — do not open a public issue for
anything you believe is a security vulnerability.

## Code style

No linter is currently enforced. Please match the existing style: no
semicolons-optional inconsistency, 2-space indentation, `const`/`let` over
`var` (except inside the vendored QR library, which stays as-is).
