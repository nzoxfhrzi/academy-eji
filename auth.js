// auth.js
// Utility autentikasi Academy Eji — di-include di semua halaman
// Versi: 1.0.0

const Auth = (() => {
  const TOKEN_KEY = 'eji_session';
  const USER_KEY  = 'eji_user';

  // ── Ambil token dari localStorage
  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  // ── Ambil data user dari localStorage
  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY));
    } catch { return null; }
  }

  // ── Simpan sesi ke localStorage
  function saveSession(token, user) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  // ── Hapus sesi (logout)
  function clearSession() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  // ── Cek apakah sesi masih valid (verifikasi ke server)
  async function verify() {
    const token = getToken();
    if (!token) return null;

    try {
      const r = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await r.json();
      if (data.valid) {
        // Refresh data user dari server
        saveSession(token, data.user);
        return data.user;
      } else {
        clearSession();
        return null;
      }
    } catch {
      // Jika offline, fallback ke data lokal (tapi tetap cek expiry midnight)
      const user = getUser();
      return user;
    }
  }

  // ── Cek role
  function isVIP() {
    const u = getUser();
    return u && u.role === 'vip';
  }

  function isTamu() {
    const u = getUser();
    return u && u.role === 'tamu';
  }

  function isLoggedIn() {
    return !!getToken() && !!getUser();
  }

  // ── Login
  async function login(username) {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    const data = await r.json();
    if (r.ok) {
      saveSession(data.token, data.user);
      return { ok: true, user: data.user };
    }
    return { ok: false, error: data.error };
  }

  // ── Register
  async function register(username) {
    const r = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    const data = await r.json();
    if (r.ok) {
      saveSession(data.token, data.user);
      return { ok: true, user: data.user };
    }
    return { ok: false, error: data.error };
  }

  // ── Logout
  function logout() {
    clearSession();
    window.location.href = '/index.html';
  }

  return { getToken, getUser, verify, login, register, logout, isVIP, isTamu, isLoggedIn, saveSession, clearSession };
})();
