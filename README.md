# 🔒 mes.chacha
# Secure P2P Communication System

### Serverless, End-to-End Encrypted Peer-to-Peer Chat

[![Encryption](https://img.shields.io/badge/Encryption-AES--256--GCM-blue)](#-security-model)
[![Transport](https://img.shields.io/badge/Transport-WebRTC%20DTLS-orange)](#-how-it-works)
[![Backend](https://img.shields.io/badge/Backend-None-brightgreen)](#-project-overview)
[![License](https://img.shields.io/badge/License-MIT-lightgrey)](#-license)

## 📌 Project Overview

**mes.chacha** is a browser-only, peer-to-peer chat application. There is no
backend, no accounts, and no message storage anywhere — two people connect
directly via **WebRTC**, authenticate each other with a shared passphrase,
and exchange messages secured by **AES-256-GCM** layered on top of WebRTC's
own DTLS transport encryption.

---

## 🖥️ How It Works

| Step | Action |
| ---- | ------ |
| 1 | Both people agree on a shared passphrase beforehand, over a channel they already trust (a call, in person — never the same channel as the connection code) |
| 2 | One person clicks **host**, generates a connection code, and sends it to the other person (text, email, QR code, USB drive) |
| 3 | The other person pastes it, generates a reply code, and sends it back |
| 4 | Both browsers derive the same AES key from the shared passphrase — never transmitted — and display a short verification code both sides read aloud to rule out interception |
| 5 | Messages are encrypted end-to-end; if the passphrase doesn't match, messages fail authentication and are flagged, not shown |

Includes an **offline / LAN-only mode** (skips the public STUN server, so two
devices on the same local network with no internet can still connect) and
QR-code / file-download options for transferring connection codes without a
network at all.

---

## 🚨 Security Model

- **Transport encryption** via WebRTC's built-in DTLS (automatic)
- **Application-layer encryption:** AES-256-GCM with a key derived via
  PBKDF2 (250,000 iterations) from the shared passphrase and per-session
  random salts exchanged in the connection codes
- **Verification code**, derived the same way, lets both sides
  visually/verbally confirm they hold the same key material — detects
  tampering with connection codes in transit
- The passphrase is **never transmitted or stored** anywhere
- **No server exists in the data path** — nothing to log, breach, or
  subpoena from a third party

> Appropriate for casual private conversations between two people who can
> exchange a passphrase through a trusted side-channel. **Not** appropriate
> for high-stakes anonymity or adversarial threat models — IP addresses are
> visible to whoever holds a connection code, and there's no protection
> against a compromised passphrase-sharing channel.

---

## 📂 Project Structure

```
mes-chacha/
├── index.html      entry point
├── style.css       terminal-style UI
├── app.js          WebRTC signaling, encryption, chat logic
├── qrcode.js        vendored QR encoder (MIT — Kazuhiko Arase, unmodified)
├── p2p-chat-terminal.html
├── README.md
├── SECURITY.md
├── CONTRIBUTING.md
└── LICENSE
```

---

## ▶️ Running It

No build step, no dependencies. Serve the folder with any static file
server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

**HTTPS is required** for clipboard copy and reliable WebRTC behavior beyond
`localhost` — for real deployment, use GitHub Pages or any static host that
provides HTTPS.

---

## ⚠️ Known Limitations

- **No TURN server included.** Works well on most home/mobile networks via
  STUN alone, but strict corporate firewalls or symmetric NAT may prevent a
  direct connection. Advanced users can supply their own TURN server in the UI.
- **No reconnect logic.** A dropped connection or refreshed tab ends the
  session; nothing is saved or replayed.
- **Two people only** — this is peer-to-peer, not a group chat.
- **No identity system.** Security relies entirely on both sides knowing the
  same passphrase and verifying the on-screen code together.

---

## 🛠️ Tools & Technologies Used

- WebRTC (DTLS transport + data channels)
- Web Crypto API (AES-256-GCM, PBKDF2)
- Vanilla JavaScript, HTML, CSS — no frameworks, no build tooling

---

## 🎯 Skills Demonstrated

- Client-side cryptography and secure key derivation
- WebRTC peer connection signaling without a backend
- Threat modeling and honest documentation of security trade-offs
- Zero-dependency, static-hosting-friendly application design

---

## 🙌 Credits

QR code generation uses an embedded copy of
[qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) by
Kazuhiko Arase (MIT licensed).

---

## 📄 License

MIT — see [LICENSE](./LICENSE).
