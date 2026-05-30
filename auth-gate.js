// auth-gate.js
// Sistem gate konten Academy Eji
// Include di semua halaman SETELAH auth.js
// Menangani: popup login/register, gate konten berdasarkan role, popup upgrade VIP

(async () => {

  // ══════════════════════════════════════════════
  // 1. CEK SESI — tampilkan modal jika belum login
  // ══════════════════════════════════════════════

  let currentUser = null;

  // Coba ambil dari cache lokal dulu (cepat)
  const cached = Auth.getUser();
  if (cached) currentUser = cached;

  // Inject styles modal
  injectStyles();

  // Inject modal HTML ke body
  injectModal();

  // Jika belum login, tampilkan modal
  if (!currentUser) {
    showAuthModal();
  } else {
    // Verifikasi ke server di background (tidak memblokir render)
    Auth.verify().then(user => {
      if (!user) {
        showAuthModal();
      } else {
        currentUser = user;
        updateUI(user);
        applyContentGate(user);
      }
    });
    updateUI(currentUser);
    applyContentGate(currentUser);
  }

  // ══════════════════════════════════════════════
  // 2. INJECT STYLES
  // ══════════════════════════════════════════════

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* ── AUTH MODAL ── */
      #auth-modal-overlay {
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(0,0,0,0.6); backdrop-filter: blur(6px);
        display: flex; align-items: center; justify-content: center;
        padding: 16px;
        opacity: 0; transition: opacity 0.3s;
        pointer-events: none;
      }
      #auth-modal-overlay.show { opacity: 1; pointer-events: all; }
      #auth-modal {
        background: var(--surface, #fff); border-radius: 20px;
        padding: 40px 36px; width: 100%; max-width: 420px;
        box-shadow: 0 25px 60px rgba(0,0,0,0.25);
        transform: translateY(20px) scale(0.97); transition: transform 0.3s;
        position: relative;
      }
      #auth-modal-overlay.show #auth-modal { transform: translateY(0) scale(1); }
      .auth-logo { text-align: center; margin-bottom: 24px; }
      .auth-logo-icon {
        width: 56px; height: 56px; border-radius: 16px;
        background: linear-gradient(135deg, #2563eb, #60a5fa);
        display: inline-flex; align-items: center; justify-content: center;
        font-size: 28px; color: #fff; margin-bottom: 10px;
        box-shadow: 0 8px 20px rgba(37,99,235,0.3);
      }
      .auth-logo-name { font-family: 'Sora', sans-serif; font-size: 20px; font-weight: 700; color: var(--ink, #0f172a); }
      .auth-logo-name span { color: #2563eb; }
      .auth-tab-row { display: flex; background: var(--surface2, #f8fafc); border-radius: 10px; padding: 4px; margin-bottom: 24px; gap: 4px; }
      .auth-tab {
        flex: 1; padding: 8px; text-align: center; border-radius: 8px; cursor: pointer;
        font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600;
        color: var(--ink3, #64748b); border: none; background: transparent; transition: all 0.2s;
      }
      .auth-tab.active { background: var(--surface, #fff); color: var(--primary, #2563eb); box-shadow: 0 1px 4px rgba(0,0,0,0.1); }
      .auth-panel { display: none; }
      .auth-panel.active { display: block; }
      .auth-label { font-family: 'Sora', sans-serif; font-size: 12px; font-weight: 600; color: var(--ink3, #64748b); display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
      .auth-title { font-family: 'Sora', sans-serif; font-size: 22px; font-weight: 700; color: var(--ink, #0f172a); margin-bottom: 6px; }
      .auth-sub { font-family: 'Sora', sans-serif; font-size: 13px; color: var(--ink3, #64748b); margin-bottom: 20px; }
      .auth-input-wrap { position: relative; margin-bottom: 16px; }
      .auth-input-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-size: 18px; color: var(--ink4, #94a3b8); pointer-events: none; }
      .auth-input {
        width: 100%; padding: 12px 14px 12px 42px;
        font-family: 'Sora', sans-serif; font-size: 14px;
        border: 1.5px solid var(--border, #e2e8f0); border-radius: 10px;
        background: var(--surface2, #f8fafc); color: var(--ink, #0f172a);
        outline: none; transition: border-color 0.2s, box-shadow 0.2s; box-sizing: border-box;
      }
      .auth-input:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.12); background: var(--surface, #fff); }
      .auth-btn {
        width: 100%; padding: 13px;
        background: linear-gradient(135deg, #2563eb, #1d4ed8);
        color: #fff; border: none; border-radius: 10px; cursor: pointer;
        font-family: 'Sora', sans-serif; font-size: 14px; font-weight: 600;
        transition: all 0.2s; margin-top: 4px;
      }
      .auth-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(37,99,235,0.35); }
      .auth-btn:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }
      .auth-error {
        background: #fef2f2; border: 1px solid #fecaca; color: #dc2626;
        border-radius: 8px; padding: 10px 14px; font-size: 13px;
        font-family: 'Sora', sans-serif; margin-bottom: 12px; display: none;
      }
      .auth-error.show { display: block; }
      .auth-success {
        background: #f0fdf4; border: 1px solid #bbf7d0; color: #16a34a;
        border-radius: 8px; padding: 10px 14px; font-size: 13px;
        font-family: 'Sora', sans-serif; margin-bottom: 12px; display: none;
      }
      .auth-success.show { display: block; }
      .auth-note { font-family: 'Sora', sans-serif; font-size: 12px; color: var(--ink3, #64748b); text-align: center; margin-top: 16px; }

      /* ── VIP POPUP ── */
      #vip-popup-overlay {
        position: fixed; inset: 0; z-index: 9998;
        background: rgba(0,0,0,0.6); backdrop-filter: blur(6px);
        display: none; align-items: center; justify-content: center;
        padding: 16px;
      }
      #vip-popup-overlay.show { display: flex; }
      #vip-popup {
        background: var(--surface, #fff); border-radius: 20px;
        padding: 40px 32px; width: 100%; max-width: 380px;
        box-shadow: 0 25px 60px rgba(0,0,0,0.25);
        text-align: center;
      }
      .vip-popup-crown { font-size: 48px; margin-bottom: 8px; }
      .vip-popup-title { font-family: 'Sora', sans-serif; font-size: 20px; font-weight: 700; color: var(--ink, #0f172a); margin-bottom: 8px; }
      .vip-popup-price { font-family: 'Sora', sans-serif; font-size: 28px; font-weight: 700; color: #d97706; margin: 8px 0; }
      .vip-popup-price small { font-size: 14px; font-weight: 400; color: var(--ink3, #64748b); }
      .vip-popup-sub { font-family: 'Sora', sans-serif; font-size: 13px; color: var(--ink3, #64748b); margin-bottom: 20px; line-height: 1.5; }
      .vip-popup-btns { display: flex; flex-direction: column; gap: 8px; }
      .vip-btn-upgrade {
        display: block; padding: 13px;
        background: linear-gradient(135deg, #f59e0b, #d97706);
        color: #fff; border-radius: 10px; font-family: 'Sora', sans-serif;
        font-size: 14px; font-weight: 700; text-decoration: none;
        transition: all 0.2s; border: none; cursor: pointer;
      }
      .vip-btn-upgrade:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(245,158,11,0.35); }
      .vip-btn-back {
        display: block; padding: 12px;
        background: var(--surface2, #f8fafc); border: 1.5px solid var(--border, #e2e8f0);
        border-radius: 10px; font-family: 'Sora', sans-serif;
        font-size: 14px; font-weight: 600; color: var(--ink2, #334155);
        cursor: pointer; transition: all 0.2s; text-decoration: none;
      }
      .vip-btn-back:hover { background: var(--border, #e2e8f0); }

      /* ── PREMIUM BADGES & LOCK ── */
      .premium-badge {
        display: inline-flex; align-items: center; gap: 3px;
        background: linear-gradient(135deg, #f59e0b, #d97706);
        color: #fff; font-size: 10px; font-weight: 700;
        padding: 2px 8px; border-radius: 20px;
        text-transform: uppercase; letter-spacing: 0.5px;
        vertical-align: middle;
      }
      .btn-premium-locked {
        background: linear-gradient(135deg, #f59e0b, #d97706) !important;
        color: #fff !important; cursor: pointer !important;
        pointer-events: all !important;
        border: none !important;
      }
      .btn-premium-locked:disabled { opacity: 1 !important; }
      .content-locked { position: relative; }
      .content-locked .a-card-desc,
      .content-locked .desc,
      .content-locked .description,
      .content-locked .card-desc,
      .content-locked .artikel-desc,
      .content-locked .artikel-deskripsi {
        filter: blur(4px);
        user-select: none;
        pointer-events: none;
      }

      /* ── TOPBAR USER PILL ── */
      .topbar-user-pill {
        display: flex; align-items: center; gap: 8px;
        background: var(--surface2, #f8fafc);
        border: 1px solid var(--border, #e2e8f0);
        border-radius: 20px; padding: 6px 14px 6px 8px;
        cursor: pointer; transition: all 0.2s;
      }
      .topbar-user-pill:hover { background: var(--border, #e2e8f0); }
      .pill-avatar {
        width: 28px; height: 28px; border-radius: 50%;
        background: var(--primary-light, #eff6ff);
        display: flex; align-items: center; justify-content: center;
        font-size: 16px; color: var(--primary, #2563eb);
      }
      .pill-name { font-family: 'Sora', sans-serif; font-size: 13px; font-weight: 600; color: var(--ink, #0f172a); }
      .pill-role { font-family: 'Sora', sans-serif; font-size: 11px; color: var(--ink3, #64748b); }
      .vip-badge { display: inline-flex; align-items: center; gap: 3px; background: linear-gradient(135deg, #f59e0b, #d97706); color: #fff; font-size: 9px; font-weight: 700; padding: 1px 6px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; }
      .vip-crown { color: #f59e0b; font-size: 12px; }
    `;
    document.head.appendChild(style);
  }

  // ══════════════════════════════════════════════
  // 3. INJECT MODAL HTML
  // ══════════════════════════════════════════════

  function injectModal() {
    // Auth modal
    const overlay = document.createElement('div');
    overlay.id = 'auth-modal-overlay';
    overlay.innerHTML = `
      <div id="auth-modal">
        <div class="auth-logo">
          <div class="auth-logo-icon">🎓</div>
          <div class="auth-logo-name">Academy <span>Eji</span></div>
        </div>
        <div class="auth-tab-row">
          <button class="auth-tab active" id="tab-login" onclick="switchTab('login')">Masuk</button>
          <button class="auth-tab" id="tab-register" onclick="switchTab('register')">Daftar</button>
        </div>

        <!-- LOGIN PANEL -->
        <div class="auth-panel active" id="panel-login">
          <div class="auth-title">Selamat datang! 👋</div>
          <div class="auth-sub">Masukkan namamu untuk lanjut</div>
          <div class="auth-error" id="login-error"></div>
          <div class="auth-success" id="login-success"></div>
          <div class="auth-input-wrap">
            <span class="auth-input-icon">👤</span>
            <input class="auth-input" id="login-name" type="text" placeholder="Nama kamu..." autocomplete="off" />
          </div>
          <button class="auth-btn" id="login-btn" onclick="doLogin()">Masuk</button>
          <div class="auth-note">Belum terdaftar? <a href="#" onclick="switchTab('register');return false;" style="color:#2563eb;">Daftar dulu</a></div>
        </div>

        <!-- REGISTER PANEL -->
        <div class="auth-panel" id="panel-register">
          <div class="auth-title">Buat akun baru ✨</div>
          <div class="auth-sub">Daftar gratis, cukup pakai nama</div>
          <div class="auth-error" id="register-error"></div>
          <div class="auth-success" id="register-success"></div>
          <div class="auth-input-wrap">
            <span class="auth-input-icon">✏️</span>
            <input class="auth-input" id="register-name" type="text" placeholder="Nama kamu..." autocomplete="off" />
          </div>
          <button class="auth-btn" id="register-btn" onclick="doRegister()">Daftar Sekarang</button>
          <div class="auth-note">Sudah punya akun? <a href="#" onclick="switchTab('login');return false;" style="color:#2563eb;">Masuk</a></div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // VIP popup
    const vipOverlay = document.createElement('div');
    vipOverlay.id = 'vip-popup-overlay';
    vipOverlay.innerHTML = `
      <div id="vip-popup">
        <div class="vip-popup-crown">👑</div>
        <div class="vip-popup-title">Konten Premium!</div>
        <div class="vip-popup-price">Rp 5.000 <small>/ bulan</small></div>
        <div class="vip-popup-sub">Upgrade VIP yuk, murah banget cuman 5K/Bulan!<br>Buka akses semua konten eksklusif.</div>
        <div class="vip-popup-btns">
          <a href="/premium/index.html" class="vip-btn-upgrade">👑 Upgrade VIP Sekarang</a>
          <button class="vip-btn-back" id="vip-popup-close">← Kembali ke Dashboard</button>
        </div>
      </div>
    `;
    document.body.appendChild(vipOverlay);

    // Expose tab switcher globally
    window.switchTab = function(tab) {
      document.getElementById('tab-login').classList.toggle('active', tab === 'login');
      document.getElementById('tab-register').classList.toggle('active', tab === 'register');
      document.getElementById('panel-login').classList.toggle('active', tab === 'login');
      document.getElementById('panel-register').classList.toggle('active', tab === 'register');
    };

    window.doLogin = async function() {
      const nameEl = document.getElementById('login-name');
      const errEl = document.getElementById('login-error');
      const sucEl = document.getElementById('login-success');
      const btn = document.getElementById('login-btn');
      const name = nameEl.value.trim();
      errEl.classList.remove('show'); sucEl.classList.remove('show');
      if (!name) { errEl.textContent = 'Masukkan namamu dulu.'; errEl.classList.add('show'); return; }
      btn.disabled = true; btn.textContent = 'Memuat...';
      const result = await Auth.login(name);
      btn.disabled = false; btn.textContent = 'Masuk';
      if (result.ok) {
        sucEl.textContent = `Selamat datang, ${result.user.username}!`;
        sucEl.classList.add('show');
        setTimeout(() => {
          hideAuthModal();
          currentUser = result.user;
          updateUI(result.user);
          applyContentGate(result.user);
        }, 800);
      } else {
        errEl.textContent = result.error || 'Login gagal.';
        errEl.classList.add('show');
      }
    };

    window.doRegister = async function() {
      const nameEl = document.getElementById('register-name');
      const errEl = document.getElementById('register-error');
      const sucEl = document.getElementById('register-success');
      const btn = document.getElementById('register-btn');
      const name = nameEl.value.trim();
      errEl.classList.remove('show'); sucEl.classList.remove('show');
      if (!name) { errEl.textContent = 'Masukkan namamu dulu.'; errEl.classList.add('show'); return; }
      btn.disabled = true; btn.textContent = 'Mendaftarkan...';
      const result = await Auth.register(name);
      btn.disabled = false; btn.textContent = 'Daftar Sekarang';
      if (result.ok) {
        sucEl.textContent = `Berhasil daftar! Selamat datang, ${result.user.username}!`;
        sucEl.classList.add('show');
        setTimeout(() => {
          hideAuthModal();
          currentUser = result.user;
          updateUI(result.user);
          applyContentGate(result.user);
        }, 800);
      } else {
        errEl.textContent = result.error || 'Pendaftaran gagal.';
        errEl.classList.add('show');
      }
    };

    // Enter key support
    document.getElementById('login-name').addEventListener('keydown', e => { if (e.key === 'Enter') window.doLogin(); });
    document.getElementById('register-name').addEventListener('keydown', e => { if (e.key === 'Enter') window.doRegister(); });

    // VIP popup close → kembali ke dashboard
    document.getElementById('vip-popup-close').addEventListener('click', () => {
      hideVipPopup();
      window.location.href = '/index.html';
    });
  }

  // ══════════════════════════════════════════════
  // 4. SHOW / HIDE HELPERS
  // ══════════════════════════════════════════════

  function showAuthModal() {
    const overlay = document.getElementById('auth-modal-overlay');
    if (overlay) {
      overlay.style.display = 'flex';
      requestAnimationFrame(() => overlay.classList.add('show'));
    }
  }

  function hideAuthModal() {
    const overlay = document.getElementById('auth-modal-overlay');
    if (overlay) {
      overlay.classList.remove('show');
      setTimeout(() => { overlay.style.display = 'none'; }, 300);
    }
  }

  function showVipPopup() {
    const overlay = document.getElementById('vip-popup-overlay');
    if (overlay) overlay.classList.add('show');
  }

  function hideVipPopup() {
    const overlay = document.getElementById('vip-popup-overlay');
    if (overlay) overlay.classList.remove('show');
  }

  // ══════════════════════════════════════════════
  // 5. UPDATE UI (sidebar user info)
  // ══════════════════════════════════════════════

  function updateUI(user) {
    // Sidebar username & role
    const nameEl = document.getElementById('sidebar-username');
    const roleEl = document.getElementById('sidebar-role');
    if (nameEl) nameEl.textContent = user.username;
    if (roleEl) {
      if (user.role === 'vip') {
        roleEl.innerHTML = '<span class="vip-badge"><i class="bx bxs-crown"></i> VIP</span>';
      } else {
        roleEl.textContent = 'Tamu';
      }
    }

    // Topbar user pill (jika ada)
    const pillName = document.getElementById('topbar-user-name');
    const pillRole = document.getElementById('topbar-user-role');
    if (pillName) pillName.textContent = user.username;
    if (pillRole) {
      pillRole.innerHTML = user.role === 'vip'
        ? '<span class="vip-crown">👑</span> VIP'
        : 'Tamu';
    }

    // Show/hide nav upgrade VIP
    const navUpgrade = document.getElementById('nav-upgrade-vip');
    if (navUpgrade) {
      navUpgrade.style.display = user.role === 'tamu' ? 'flex' : 'none';
    }

    // Tambah nav item Upgrade VIP di sidebar jika tamu & belum ada (untuk halaman sub-dir)
    if (user.role === 'tamu') {
      const sidebarScroll = document.querySelector('.sidebar-scroll');
      if (sidebarScroll && !document.getElementById('nav-upgrade-vip') && !document.getElementById('nav-upgrade')) {
        const link = document.createElement('a');
        link.id = 'nav-upgrade';
        link.className = 'nav-item';
        link.href = '/premium/index.html';
        link.style.cssText = 'color:#d97706;';
        link.innerHTML = `<i class='bx bxs-crown nav-icon'></i> Upgrade Premium`;
        sidebarScroll.appendChild(link);
      }
    }

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.style.display = 'block';
      logoutBtn.addEventListener('click', () => Auth.logout(), { once: true });
    }
  }

  // ══════════════════════════════════════════════
  // 6. CONTENT GATE
  // ══════════════════════════════════════════════

  function applyContentGate(user) {
    const isVip = user.role === 'vip';
    const path = window.location.pathname;

    // ── A. Blokir total halaman Referensi & Ebook untuk Tamu ──
    if (!isVip && (path.includes('/referensi/') || path.endsWith('/referensi'))) {
      showVipPopup();
      return;
    }

    // ── B. Blokir halaman ujicoba TOEFL & UKBI untuk Tamu ──
    // Berlaku di instruksi.html, tes.html, hasil.html
    if (!isVip && (
      path.includes('/ujicoba/instruksi.html') ||
      path.includes('/ujicoba/tes.html') ||
      path.includes('/ujicoba/hasil.html')
    )) {
      const params = new URLSearchParams(window.location.search);
      const tes = params.get('tes');
      if (tes === 'toefl' || tes === 'ukbi') {
        showVipPopup();
        return;
      }
    }

    // ── C. Gate card TOEFL & UKBI di halaman ujicoba/index.html ──
    if (!isVip) {
      document.querySelectorAll(
        'a[href*="instruksi.html?tes=toefl"], a[href*="instruksi.html?tes=ukbi"], .tc-toefl, .tc-ukbi'
      ).forEach(el => {
        el.addEventListener('click', e => {
          e.preventDefault();
          showVipPopup();
        });
        // Tambah badge premium
        const titleEl = el.querySelector('.tc-title, .exam-title, .card-title, h3, strong');
        if (titleEl && !titleEl.querySelector('.premium-badge')) {
          const badge = document.createElement('span');
          badge.className = 'premium-badge';
          badge.style.marginLeft = '6px';
          badge.innerHTML = '👑 Premium';
          titleEl.appendChild(badge);
        }
      });
    }

    // ── D. Gate artikel/prompt Unggulan (featured) untuk Tamu ──
    if (!isVip) {
      // Gate cards yang sudah ada
      function gateAllFeatured() {
        document.querySelectorAll('[data-featured="true"], [data-premium="true"]').forEach(card => {
          gateCard(card);
        });
      }
      // Jalankan sekarang + observe perubahan DOM (untuk konten dinamis)
      gateAllFeatured();
      const observer = new MutationObserver(() => gateAllFeatured());
      const grid = document.getElementById('articles-grid') || document.querySelector('.articles-grid');
      if (grid) observer.observe(grid, { childList: true, subtree: true });
      // Fallback timeout untuk halaman prompt
      setTimeout(gateAllFeatured, 500);
      setTimeout(gateAllFeatured, 1200);
    }
  }

  function gateCard(card) {
    if (card.dataset.gated) return; // Jangan gate dua kali
    card.dataset.gated = 'true';
    card.classList.add('content-locked');

    // Blur deskripsi & no-copy
    card.querySelectorAll('.a-card-desc, .desc, .description, .card-desc, .artikel-desc, .artikel-deskripsi').forEach(el => {
      el.style.filter = 'blur(4px)';
      el.style.userSelect = 'none';
      el.style.pointerEvents = 'none';
      el.setAttribute('oncopy', 'return false');
    });

    // Disable & ubah teks tombol
    card.querySelectorAll('a.btn, button.btn, .btn-baca, .btn-buka, .btn-open').forEach(btn => {
      btn.classList.add('btn-premium-locked');
      const origText = btn.textContent;
      btn.textContent = '👑 Premium Content';
      if (btn.tagName === 'A') {
        btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); showVipPopup(); });
      } else {
        btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); showVipPopup(); });
      }
    });

    // Tambah premium badge jika belum ada
    const titleEl = card.querySelector('h2, h3, .card-title, .artikel-judul, .a-card-title');
    if (titleEl && !titleEl.querySelector('.premium-badge')) {
      const badge = document.createElement('span');
      badge.className = 'premium-badge';
      badge.style.marginLeft = '8px';
      badge.innerHTML = '👑 Premium';
      titleEl.appendChild(badge);
    }
  }

  // Expose untuk dipakai halaman lain
  window.AuthGate = { showVipPopup, hideVipPopup, gateCard, showAuthModal, hideAuthModal };

})();
