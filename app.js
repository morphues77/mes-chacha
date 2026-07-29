
let pc, dc;
let aesKey = null;
let localSalt = null;
let remoteSalt = null;

const statusText = document.getElementById('statusText');
const setupScreen = document.getElementById('setupScreen');
const chatScreen = document.getElementById('chatScreen');
const messagesEl = document.getElementById('messages');
const verifyCodeEl = document.getElementById('verifyCode');

function setStatus(state, text) {
  statusText.className = 'status ' + (state === 'connected' ? 'on' : state === 'warn' ? 'warn' : 'off');
  statusText.textContent = text;
}

function addMessage(text, type) {
  const div = document.createElement('div');
  div.className = 'msg ' + type;
  const time = new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  if (type === 'sys' || type === 'tamper') {
    div.textContent = text;
  } else {
    const tagSpan = document.createElement('span');
    tagSpan.className = 'tag';
    tagSpan.textContent = (type === 'me' ? 'you>' : 'peer>');
    const bodySpan = document.createElement('span');
    bodySpan.className = 'body';
    bodySpan.textContent = text; // textContent — never interpreted as HTML
    const timeSpan = document.createElement('span');
    timeSpan.className = 'time';
    timeSpan.textContent = time;
    div.appendChild(tagSpan);
    div.appendChild(document.createTextNode(' '));
    div.appendChild(bodySpan);
    div.appendChild(timeSpan);
  }
  messagesEl.appendChild(div);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}


// ---------- Crypto helpers ----------
const enc = new TextEncoder();
const dec = new TextDecoder();

function randomBytes(n) {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}
function bufToB64(buf) { return btoa(String.fromCharCode(...new Uint8Array(buf))); }
function b64ToBuf(b64) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

// Validates the decoded {desc, salt} shape before it's ever handed to
// RTCPeerConnection, so a malformed or malicious pasted code fails fast
// with a clear message instead of reaching setRemoteDescription().
function parseConnectionCode(raw, expectedType) {
  const parsed = JSON.parse(atob(raw));
  if (!parsed || typeof parsed !== 'object') throw new Error('malformed code');
  const desc = parsed.desc;
  if (!desc || typeof desc !== 'object') throw new Error('missing session description');
  if (desc.type !== expectedType) throw new Error('unexpected session description type: ' + desc.type);
  if (typeof desc.sdp !== 'string' || desc.sdp.length < 10 || desc.sdp.length > 20000) {
    throw new Error('sdp missing or implausible length');
  }
  if (typeof parsed.salt !== 'string') throw new Error('missing salt');
  const saltBytes = b64ToBuf(parsed.salt);
  if (saltBytes.length !== 16) throw new Error('unexpected salt length');
  return { desc, salt: saltBytes };
}
function compareBytes(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return a.length - b.length;
}
function orderedSalts(saltA, saltB) {
  const [first, second] = compareBytes(saltA, saltB) <= 0 ? [saltA, saltB] : [saltB, saltA];
  const combined = new Uint8Array(first.length + second.length);
  combined.set(first, 0);
  combined.set(second, first.length);
  return combined;
}

async function deriveKey(passphrase, saltA, saltB) {
  const combined = orderedSalts(saltA, saltB);
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: combined, iterations: 250000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptMessage(plaintext) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, enc.encode(plaintext));
  return JSON.stringify({ iv: bufToB64(iv), ct: bufToB64(ct) });
}
async function decryptMessage(payload) {
  if (typeof payload !== 'string' || payload.length > 10000) {
    throw new Error('payload too large or malformed');
  }
  const parsed = JSON.parse(payload);
  if (typeof parsed.iv !== 'string' || typeof parsed.ct !== 'string') {
    throw new Error('malformed ciphertext payload');
  }
  const { iv, ct } = parsed;
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64ToBuf(iv) }, aesKey, b64ToBuf(ct));
  return dec.decode(pt);
}

const VERIFY_EMOJI = ['🍎','🍋','🍇','🍉','🍓','🍒','🍑','🥝','🍍','🥑','🌽','🥕','🍄','🌶️','🥦','🧄'];

async function computeVerifyCode(passphrase, saltA, saltB) {
  const combined = orderedSalts(saltA, saltB);
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  const tagKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: combined, iterations: 250000, hash: 'SHA-256' },
    baseKey, { name: 'HMAC', hash: 'SHA-256', length: 256 }, false, ['sign']
  );
  const tagBits = new Uint8Array(await crypto.subtle.sign('HMAC', tagKey, enc.encode('meschacha-verify-v1')));
  const digits = String(tagBits[0] % 100).padStart(2,'0') + '-' + String(tagBits[1] % 100).padStart(2,'0');
  const emojis = VERIFY_EMOJI[tagBits[2] % VERIFY_EMOJI.length]
               + VERIFY_EMOJI[tagBits[3] % VERIFY_EMOJI.length]
               + VERIFY_EMOJI[tagBits[4] % VERIFY_EMOJI.length];
  return digits + '   ' + emojis;
}

// ---------- WebRTC ----------
function getIceServers() {
  const lanOnly = document.getElementById('lanOnly').checked;
  const servers = lanOnly ? [] : [{ urls: 'stun:stun.l.google.com:19302' }];
  const turnUrl = document.getElementById('turnUrl').value.trim();
  const turnUser = document.getElementById('turnUser').value.trim();
  const turnPass = document.getElementById('turnPass').value.trim();
  // In LAN-only mode a TURN server is still allowed if it's reachable on
  // the local network itself (e.g. a coturn instance on the same LAN) —
  // it's the public STUN lookup specifically that requires internet.
  if (turnUrl) servers.push({ urls: turnUrl, username: turnUser, credential: turnPass });
  return servers;
}

// ---------- QR + offline file transfer helpers ----------
function renderQR(containerId, text) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  try {
    const qr = qrcode(0, 'L'); // typeNumber 0 = auto-select smallest version that fits
    qr.addData(text);
    qr.make();
    el.innerHTML = qr.createSvgTag(3, 8);
    const label = document.createElement('p');
    label.className = 'line dim';
    label.style.marginTop = '4px';
    label.textContent = 'scan with peer\'s camera app, or use download_as_file below';
    el.appendChild(label);
  } catch (e) {
    el.innerHTML = '<p class="line warn">code too large for a single QR — use download_as_file below and transfer it via USB, Bluetooth, or AirDrop instead.</p>';
  }
}

function downloadAsFile(text, filename) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function createPeerConnection() {
  const conn = new RTCPeerConnection({ iceServers: getIceServers() });
  conn.onconnectionstatechange = () => {
    if (conn.connectionState === 'connected') {
      setStatus('connected', 'connected // e2e');
    } else if (['disconnected','failed','closed'].includes(conn.connectionState)) {
      setStatus('bad', 'disconnected');
    }
  };
  return conn;
}

function setupDataChannelEvents(channel) {
  channel.onopen = async () => {
    setupScreen.style.display = 'none';
    chatScreen.style.display = 'flex';
    setStatus('connected', 'connected // e2e');
    addMessage('transport connected. deriving e2e key from passphrase...', 'sys');

    const passphrase = document.getElementById('passphrase').value;
    if (!passphrase) {
      addMessage('no passphrase set — transport encryption only, no peer auth. reload and set one for full protection.', 'tamper');
      setStatus('warn', 'connected // unverified');
      return;
    }
    aesKey = await deriveKey(passphrase, localSalt, remoteSalt);
    verifyCodeEl.textContent = await computeVerifyCode(passphrase, localSalt, remoteSalt);
    addMessage('key established. compare the verify code above out loud — mismatch means possible interception.', 'sys');
  };
  channel.onclose = () => setStatus('bad', 'disconnected');
  channel.onmessage = async (e) => {
    if (typeof e.data !== 'string' || e.data.length > 10000) {
      addMessage('[message rejected — too large or malformed]', 'tamper');
      return;
    }
    if (!aesKey) {
      addMessage('[unencrypted message received — no shared key]', 'tamper');
      return;
    }
    try {
      const plaintext = await decryptMessage(e.data);
      addMessage(plaintext, 'them');
    } catch (err) {
      addMessage('message failed authentication and was discarded — mismatched passphrase or tampering.', 'tamper');
    }
  };
}

async function waitForIceGathering(conn) {
  return new Promise(resolve => {
    if (conn.iceGatheringState === 'complete') { resolve(); return; }
    function check() {
      if (conn.iceGatheringState === 'complete') {
        conn.removeEventListener('icegatheringstatechange', check);
        resolve();
      }
    }
    conn.addEventListener('icegatheringstatechange', check);
  });
}

function requirePassphrase() {
  if (!document.getElementById('passphrase').value) {
    return confirm('no passphrase set — session relies on transport encryption only, no peer auth or message-layer encryption. continue anyway?');
  }
  return true;
}

// ---- HOST FLOW ----
document.getElementById('btnCreateOffer').onclick = async () => {
  if (!requirePassphrase()) return;
  localSalt = randomBytes(16);

  pc = createPeerConnection();
  dc = pc.createDataChannel('chat');
  setupDataChannelEvents(dc);

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIceGathering(pc);

  const payload = btoa(JSON.stringify({ desc: pc.localDescription, salt: bufToB64(localSalt) }));
  document.getElementById('hostOfferOut').value = payload;
  document.getElementById('hostOfferLabel').style.display = 'block';
  document.getElementById('hostOfferOut').style.display = 'block';
  document.getElementById('copyOffer').style.display = 'inline-block';
  document.getElementById('downloadOffer').style.display = 'inline-block';
  document.getElementById('hostStep2').style.display = 'block';
  renderQR('hostOfferQR', payload);
};

document.getElementById('downloadOffer').onclick = () => {
  downloadAsFile(document.getElementById('hostOfferOut').value, 'meschacha-invite-code.txt');
};

document.getElementById('copyOffer').onclick = () => {
  navigator.clipboard.writeText(document.getElementById('hostOfferOut').value);
  document.getElementById('copyOffer').textContent = 'copied';
  setTimeout(() => document.getElementById('copyOffer').textContent = 'copy', 1500);
};

document.getElementById('btnConnectHost').onclick = async () => {
  try {
    const raw = document.getElementById('hostAnswerIn').value.trim();
    const { desc, salt } = parseConnectionCode(raw, 'answer');
    remoteSalt = salt;
    await pc.setRemoteDescription(desc);
  } catch (e) {
    alert('invalid code — check you pasted the full reply code.');
  }
};

// ---- JOIN FLOW ----
document.getElementById('btnCreateAnswer').onclick = async () => {
  if (!requirePassphrase()) return;
  try {
    localSalt = randomBytes(16);

    const raw = document.getElementById('joinOfferIn').value.trim();
    const { desc, salt } = parseConnectionCode(raw, 'offer');
    remoteSalt = salt;

    pc = createPeerConnection();
    pc.ondatachannel = (e) => { dc = e.channel; setupDataChannelEvents(dc); };

    await pc.setRemoteDescription(desc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitForIceGathering(pc);

    const payload = btoa(JSON.stringify({ desc: pc.localDescription, salt: bufToB64(localSalt) }));
    document.getElementById('joinAnswerOut').value = payload;
    document.getElementById('joinStep2').style.display = 'block';
    renderQR('joinAnswerQR', payload);
  } catch (e) {
    alert('invalid code — check you pasted the full invite code.');
  }
};

document.getElementById('downloadAnswer').onclick = () => {
  downloadAsFile(document.getElementById('joinAnswerOut').value, 'meschacha-reply-code.txt');
};

document.getElementById('copyAnswer').onclick = () => {
  navigator.clipboard.writeText(document.getElementById('joinAnswerOut').value);
  document.getElementById('copyAnswer').textContent = 'copied';
  setTimeout(() => document.getElementById('copyAnswer').textContent = 'copy', 1500);
};

// ---- TABS ----
document.getElementById('tabHost').onclick = () => {
  document.getElementById('tabHost').classList.add('active');
  document.getElementById('tabJoin').classList.remove('active');
  document.getElementById('hostPane').style.display = 'block';
  document.getElementById('joinPane').style.display = 'none';
};
document.getElementById('tabJoin').onclick = () => {
  document.getElementById('tabJoin').classList.add('active');
  document.getElementById('tabHost').classList.remove('active');
  document.getElementById('joinPane').style.display = 'block';
  document.getElementById('hostPane').style.display = 'none';
};

document.getElementById('advToggle').onclick = () => {
  const p = document.getElementById('advPanel');
  p.style.display = p.style.display === 'block' ? 'none' : 'block';
};

// ---- CHAT ----
async function sendMessage() {
  const input = document.getElementById('msgInput');
  const text = input.value.trim();
  if (!text || !dc || dc.readyState !== 'open') return;
  if (aesKey) {
    dc.send(await encryptMessage(text));
  } else {
    dc.send(text);
  }
  addMessage(text, 'me');
  input.value = '';
}
document.getElementById('btnSend').onclick = sendMessage;
document.getElementById('msgInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});
