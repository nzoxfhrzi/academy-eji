// api/auth/[action].js
// Sistem autentikasi Academy Eji
// Actions: register, login, verify, upgrade, list-users, delete-user

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action;

  switch (action) {
    case 'register':    return handleRegister(req, res);
    case 'login':       return handleLogin(req, res);
    case 'verify':      return handleVerify(req, res);
    case 'upgrade':     return handleUpgrade(req, res);
    case 'list-users':  return handleListUsers(req, res);
    case 'delete-user': return handleDeleteUser(req, res);
    default:
      return res.status(404).json({ error: `Action tidak dikenal: ${action}` });
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const USERS_FILE = 'users.json';

function ghHeaders(pat) {
  return {
    'Authorization': `Bearer ${pat}`,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

function ghUrl(owner, repo, path) {
  return `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
}

function checkEnv(res) {
  const { GITHUB_PAT, GITHUB_OWNER, GITHUB_REPO } = process.env;
  if (!GITHUB_PAT || !GITHUB_OWNER || !GITHUB_REPO) {
    res.status(500).json({ error: 'Environment variable belum dikonfigurasi.' });
    return null;
  }
  return { GITHUB_PAT, GITHUB_OWNER, GITHUB_REPO };
}

function checkAdmin(req, res) {
  const { ADMIN_KEY } = process.env;
  const key = req.headers['x-admin-key']
    || (req.body && (req.body.adminKey || req.body.key))
    || '';
  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    res.status(403).json({ error: 'Akses ditolak. Admin key tidak valid.' });
    return false;
  }
  return true;
}

// Buat token sesi sederhana (HMAC-like dengan SESSION_SECRET)
async function makeToken(username, role) {
  const secret = process.env.SESSION_SECRET || 'academy-eji-secret';
  const payload = `${username}|${role}|${Date.now()}`;
  // Encode payload + signature sederhana
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(payload);

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
  const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return btoa(`${payload}|${sigHex}`);
}

// Verifikasi token, kembalikan { username, role } atau null
async function verifyToken(token) {
  try {
    const secret = process.env.SESSION_SECRET || 'academy-eji-secret';
    const decoded = atob(token);
    const parts = decoded.split('|');
    if (parts.length < 4) return null;

    const sigHex = parts[parts.length - 1];
    const payload = parts.slice(0, parts.length - 1).join('|');
    const [username, role, tsStr] = parts;

    // Cek expired: reset setiap jam 12 malam
    const ts = parseInt(tsStr);
    const now = Date.now();
    const tokenDate = new Date(ts);
    const nowDate = new Date(now);

    // Cek apakah sudah lewat jam 12 malam sejak token dibuat
    const midnight = new Date(tokenDate);
    midnight.setHours(24, 0, 0, 0); // 12 malam hari yang sama
    if (now >= midnight.getTime()) return null;

    // Cek maks 24 jam
    if (now - ts > 24 * 60 * 60 * 1000) return null;

    // Verifikasi signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const msgData = encoder.encode(payload);
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sigBuf = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
    const expectedHex = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

    if (sigHex !== expectedHex) return null;
    return { username, role };
  } catch {
    return null;
  }
}

async function getUsers(env) {
  const url = ghUrl(env.GITHUB_OWNER, env.GITHUB_REPO, USERS_FILE);
  const r = await fetch(url, { headers: ghHeaders(env.GITHUB_PAT) });
  if (!r.ok) {
    if (r.status === 404) return { data: { users: [] }, sha: null };
    return null;
  }
  const j = await r.json();
  const raw = Buffer.from(j.content, 'base64').toString('utf-8');
  return { data: JSON.parse(raw), sha: j.sha };
}

async function saveUsers(env, data, sha) {
  const url = ghUrl(env.GITHUB_OWNER, env.GITHUB_REPO, USERS_FILE);
  const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
  const body = { message: 'Update users.json via auth system', content };
  if (sha) body.sha = sha;

  const r = await fetch(url, {
    method: 'PUT',
    headers: ghHeaders(env.GITHUB_PAT),
    body: JSON.stringify(body)
  });
  return r.ok;
}

// ─── REGISTER ────────────────────────────────────────────────────────────────

async function handleRegister(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  const env = checkEnv(res); if (!env) return;

  const { username } = req.body;
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Username diperlukan.' });
  }

  // Sanitasi nama: hanya huruf, angka, spasi, strip
  const clean = username.trim().replace(/[^a-zA-Z0-9 \-_.]/g, '');
  if (clean.length < 2 || clean.length > 40) {
    return res.status(400).json({ error: 'Nama harus 2–40 karakter.' });
  }

  const result = await getUsers(env);
  if (!result) return res.status(500).json({ error: 'Gagal membaca data user.' });

  const { data, sha } = result;
  const users = data.users || [];

  // Cek nama sudah ada (case-insensitive)
  const exists = users.find(u => u.username.toLowerCase() === clean.toLowerCase());
  if (exists) {
    return res.status(409).json({ error: 'Nama sudah terdaftar. Silakan login.' });
  }

  // Tambah user baru sebagai tamu
  const newUser = {
    id: `usr_${Date.now()}`,
    username: clean,
    role: 'tamu',
    created_at: new Date().toISOString()
  };
  users.push(newUser);
  data.users = users;

  const saved = await saveUsers(env, data, sha);
  if (!saved) return res.status(500).json({ error: 'Gagal menyimpan data user.' });

  const token = await makeToken(clean, 'tamu');
  return res.status(200).json({
    message: 'Registrasi berhasil!',
    token,
    user: { username: clean, role: 'tamu' }
  });
}

// ─── LOGIN ───────────────────────────────────────────────────────────────────

async function handleLogin(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  const env = checkEnv(res); if (!env) return;

  const { username } = req.body;
  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'Username diperlukan.' });
  }

  const clean = username.trim();
  const result = await getUsers(env);
  if (!result) return res.status(500).json({ error: 'Gagal membaca data user.' });

  const { data } = result;
  const users = data.users || [];

  const user = users.find(u => u.username.toLowerCase() === clean.toLowerCase());
  if (!user) {
    return res.status(404).json({ error: 'Nama tidak ditemukan. Silakan daftar terlebih dahulu.' });
  }

  const token = await makeToken(user.username, user.role);
  return res.status(200).json({
    message: 'Login berhasil!',
    token,
    user: { username: user.username, role: user.role }
  });
}

// ─── VERIFY ──────────────────────────────────────────────────────────────────

async function handleVerify(req, res) {
  const token = req.headers['x-session-token'] || (req.body && req.body.token);
  if (!token) return res.status(401).json({ valid: false, error: 'Token tidak ada.' });

  const session = await verifyToken(token);
  if (!session) return res.status(401).json({ valid: false, error: 'Sesi tidak valid atau sudah expired.' });

  return res.status(200).json({ valid: true, user: session });
}

// ─── UPGRADE (Admin only) ─────────────────────────────────────────────────────

async function handleUpgrade(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  if (!checkAdmin(req, res)) return;
  const env = checkEnv(res); if (!env) return;

  const { username, role } = req.body;
  if (!username || !role) return res.status(400).json({ error: 'username dan role diperlukan.' });
  if (!['tamu', 'vip'].includes(role)) return res.status(400).json({ error: 'Role harus "tamu" atau "vip".' });

  const result = await getUsers(env);
  if (!result) return res.status(500).json({ error: 'Gagal membaca data user.' });

  const { data, sha } = result;
  const users = data.users || [];
  const idx = users.findIndex(u => u.username.toLowerCase() === username.toLowerCase());
  if (idx === -1) return res.status(404).json({ error: 'User tidak ditemukan.' });

  users[idx].role = role;
  users[idx].upgraded_at = new Date().toISOString();
  data.users = users;

  const saved = await saveUsers(env, data, sha);
  if (!saved) return res.status(500).json({ error: 'Gagal menyimpan.' });

  return res.status(200).json({ message: `User ${username} berhasil diubah ke role ${role}.` });
}

// ─── LIST USERS (Admin only) ──────────────────────────────────────────────────

async function handleListUsers(req, res) {
  if (!checkAdmin(req, res)) return;
  const env = checkEnv(res); if (!env) return;

  const result = await getUsers(env);
  if (!result) return res.status(500).json({ error: 'Gagal membaca data user.' });

  return res.status(200).json({ users: result.data.users || [] });
}

// ─── DELETE USER (Admin only) ─────────────────────────────────────────────────

async function handleDeleteUser(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Gunakan POST.' });
  if (!checkAdmin(req, res)) return;
  const env = checkEnv(res); if (!env) return;

  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'username diperlukan.' });

  const result = await getUsers(env);
  if (!result) return res.status(500).json({ error: 'Gagal membaca data user.' });

  const { data, sha } = result;
  const before = (data.users || []).length;
  data.users = (data.users || []).filter(u => u.username.toLowerCase() !== username.toLowerCase());

  if (data.users.length === before) return res.status(404).json({ error: 'User tidak ditemukan.' });

  const saved = await saveUsers(env, data, sha);
  if (!saved) return res.status(500).json({ error: 'Gagal menyimpan.' });

  return res.status(200).json({ message: `User ${username} berhasil dihapus.` });
}
