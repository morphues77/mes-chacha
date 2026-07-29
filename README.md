# mes.chacha

Serverless, end-to-end encrypted peer-to-peer chat. Runs entirely in the
browser — no backend, no accounts, no message storage anywhere. Two people
connect directly via WebRTC, authenticate each other with a shared
passphrase, and chat with AES-256-GCM encryption layered on top of WebRTC's
own DTLS transport encryption.

**[Live demo](#)** ← replace with your GitHub Pages URL once deployed

## How it works

1. Both people agree on a shared passphrase beforehand, over a channel they
   already trust (a call, in person — never over the same channel as the
   connection code).
2. One person clicks **host**, generates a connection code, and sends it to
   the other person (any channel — text, email, QR code, USB drive).
3. The other person pastes it, generates a reply code, sends it back.
4. Once connected, both browsers derive the same AES key from the shared
   passphrase — never transmitted — and display a short verification code
   both sides read aloud to rule out interception.
5. Messages are encrypted end-to-end; if the passphrase doesn't match on
   both sides, messages fail authentication and are flagged, not shown.

Includes an **offline / LAN-only mode** (skips the public STUN server, so
two devices on the same local network with no internet can still connect)
and QR-code / file-download options for transferring connection codes
without a network at all.

## Running it

No build step, no dependencies. Serve the folder with any static file
server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

**HTTPS is required** for clipboard copy and reliable WebRTC behavior
anywhere beyond `localhost` — for real deployment, use GitHub Pages or any
static host that provides HTTPS.

## Project structure

```
mes-chacha/
├── index.html      entry point
├── css/
│   └── style.css   terminal-style UI
├── js/
│   ├── qrcode.js   vendored QR encoder (MIT — Kazuhiko Arase, unmodified)
│   └── app.js      WebRTC signaling, encryption, chat logic
├── README.md
├── SECURITY.md
├── CONTRIBUTING.md
└── LICENSE
```

## Deploying with GitHub Pages

1. Push this repo to GitHub.
2. Repo → **Settings → Pages** → set source to the `main` branch, root
   folder.
3. Your app will be live at `https://<username>.github.io/<repo-name>/`.

## Known limitations

- **No TURN server included.** Works well on most home/mobile networks via
  STUN alone, but strict corporate firewalls or symmetric NAT may prevent a
  direct connection. Advanced users can supply their own TURN server in the
  UI.
- **No reconnect logic.** A dropped connection or refreshed tab ends the
  session; nothing is saved or replayed.
- **Two people only** — this is peer-to-peer, not a group chat.
- **No identity system.** Security relies entirely on both sides knowing the
  same passphrase and verifying the on-screen code together. This is not
  designed for anonymity or use against a well-resourced adversary — see
  [Security model](#security-model) below.

## Security model

- Transport encryption via WebRTC's built-in DTLS (automatic).
- A second, independent encryption layer: AES-256-GCM with a key derived
  via PBKDF2 (250,000 iterations) from the shared passphrase and per-session
  random salts exchanged in the connection codes.
- A verification code (derived the same way) lets both sides visually/verbally
  confirm they hold the same key material, which detects tampering with the
  connection codes in transit.
- The passphrase itself is never transmitted or stored anywhere.
- No server ever exists in the data path — nothing to log, breach, or
  subpoena from a third party.

This is appropriate for casual private conversations between two people who
can exchange a passphrase through a trusted side-channel. It is **not**
appropriate for high-stakes anonymity or adversarial threat models — IP
addresses are visible to whoever holds a connection code, and there's no
protection against a compromised passphrase-sharing channel.

## Credits

QR code generation uses an embedded copy of
[qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) by
Kazuhiko Arase (MIT licensed).

## License

MIT — see [LICENSE](LICENSE).
