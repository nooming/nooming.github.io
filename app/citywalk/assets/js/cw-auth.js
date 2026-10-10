/**
 * WanderWalk · 邮箱登录 + Bearer Token（足迹/收藏云同步）
 */
(function (global) {
    const AUTH_TOKEN_KEY = 'citywalk_auth_token_v1';
    const AUTH_USER_KEY = 'citywalk_auth_user_v1';
    const SYNC_META_KEY = 'citywalk_footprint_sync_meta_v1';

    const _h = global.location && global.location.hostname;
    const API_BASE =
        _h === 'localhost' || _h === '127.0.0.1' || _h === '[::1]' || _h === '::1'
            ? 'http://localhost:5000'
            : 'https://noomings-backend.zeabur.app';
    const CW_API = `${API_BASE}/api/citywalk`;

    let _user = null;
    let _syncTimer = null;

    function readJson(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (_) {
            return null;
        }
    }

    function writeJson(key, val) {
        try {
            localStorage.setItem(key, JSON.stringify(val));
        } catch (_) { /* ignore */ }
    }

    function getToken() {
        try {
            return localStorage.getItem(AUTH_TOKEN_KEY) || '';
        } catch (_) {
            return '';
        }
    }

    function setSession(token, user) {
        try {
            if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
            else localStorage.removeItem(AUTH_TOKEN_KEY);
        } catch (_) { /* ignore */ }
        _user = user || null;
        if (user) writeJson(AUTH_USER_KEY, user);
        else {
            try { localStorage.removeItem(AUTH_USER_KEY); } catch (_) { /* ignore */ }
        }
        updateAuthChrome();
    }

    function loadCachedUser() {
        if (_user) return _user;
        _user = readJson(AUTH_USER_KEY);
        return _user;
    }

    function isLoggedIn() {
        return !!getToken();
    }

    async function apiJson(path, options) {
        const opts = options || {};
        const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
        const token = getToken();
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await fetch(`${CW_API}${path}`, Object.assign({}, opts, { headers }));
        const body = await res.json().catch(() => ({}));
        return { res, body };
    }

    async function register(email, password, displayName) {
        const { res, body } = await apiJson('/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                email: email,
                password: password,
                display_name: displayName || '',
            }),
        });
        if (!res.ok || !body.success) {
            throw new Error(body.message || '注册失败');
        }
        setSession(body.token, body.user);
        return body.user;
    }

    async function login(email, password) {
        const { res, body } = await apiJson('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email: email, password: password }),
        });
        if (!res.ok || !body.success) {
            throw new Error(body.message || '登录失败');
        }
        setSession(body.token, body.user);
        return body.user;
    }

    function logout() {
        setSession('', null);
        closeAuthModal();
        if (typeof showToast === 'function') showToast('已退出登录');
    }

    async function changePassword(currentPassword, newPassword) {
        const { res, body } = await apiJson('/auth/change-password', {
            method: 'POST',
            body: JSON.stringify({
                current_password: currentPassword,
                new_password: newPassword,
            }),
        });
        if (!res.ok || !body.success) {
            throw new Error(body.message || '修改失败');
        }
        if (body.token) setSession(body.token, body.user || loadCachedUser());
        return body;
    }

    async function refreshMe() {
        if (!getToken()) return null;
        const { res, body } = await apiJson('/auth/me', { method: 'GET' });
        if (!res.ok || !body.success) {
            setSession('', null);
            return null;
        }
        _user = body.user;
        writeJson(AUTH_USER_KEY, _user);
        updateAuthChrome();
        return _user;
    }

    function userInitial(user) {
        const u = user || loadCachedUser();
        if (!u) return '我';
        const name = (u.display_name || u.email || '?').trim();
        return name.slice(0, 1).toUpperCase();
    }

    function updateAuthChrome() {
        const btn = document.getElementById('cwAuthAvatarBtn');
        if (btn) {
            btn.textContent = userInitial();
            btn.title = isLoggedIn()
                ? ((loadCachedUser() && loadCachedUser().email) || '已登录')
                : '登录以同步足迹';
            btn.classList.toggle('user-avatar--logged-in', isLoggedIn());
            if (btn.classList.contains('panel-header-auth')) {
                btn.title = isLoggedIn()
                    ? ((loadCachedUser() && loadCachedUser().email) || '已登录 · 账号与改密')
                    : '登录以同步足迹与继续上次';
            } else if (isLoggedIn()) {
                btn.title = (loadCachedUser() && loadCachedUser().email) || '已登录 · 账号与改密';
            }
        }
        const sub = document.getElementById('footprintSyncHint');
        if (sub) {
            sub.textContent = isLoggedIn()
                ? '足迹与收藏已同步到账号，换设备登录即可找回。'
                : '登录后足迹与收藏会保存到账号；未登录时仍只在本浏览器。';
        }
    }

    function showAuthModalElement() {
        const modal = document.getElementById('cwAuthModal');
        if (!modal) return;
        if (typeof global.showModal === 'function' && !modal.classList.contains('cw-auth-modal-wrap')) {
            global.showModal('cwAuthModal');
            return;
        }
        modal.classList.add('show');
        if (global.document && global.document.body) global.document.body.style.overflow = 'hidden';
    }

    function openAuthModal(mode) {
        const modal = document.getElementById('cwAuthModal');
        if (!modal) return;
        const loginPane = document.getElementById('cwAuthLoginPane');
        const regPane = document.getElementById('cwAuthRegisterPane');
        const accountPane = document.getElementById('cwAuthAccountPane');
        const tabs = modal.querySelector('.cw-auth-tabs');
        const lead = modal.querySelector('.cw-auth-lead');
        const isAccount = mode === 'account';
        const isReg = mode === 'register';
        if (loginPane) loginPane.hidden = isAccount || isReg;
        if (regPane) regPane.hidden = isAccount || !isReg;
        if (accountPane) accountPane.hidden = !isAccount;
        if (tabs) tabs.hidden = isAccount;
        if (lead) {
            lead.hidden = isAccount;
            if (isAccount) lead.textContent = '';
        }
        if (isAccount) {
            const emailEl = document.getElementById('cwAuthAccountEmail');
            const u = loadCachedUser();
            if (emailEl) emailEl.textContent = (u && u.email) || '—';
            const cp = document.getElementById('cwAuthChangePasswordForm');
            if (cp) cp.reset();
        }
        showAuthModalElement();
    }

    function closeAuthModal() {
        if (typeof global.closeModal === 'function') {
            const modal = document.getElementById('cwAuthModal');
            if (modal && modal.classList.contains('show')) {
                global.closeModal('cwAuthModal');
                return;
            }
        }
        const modal = document.getElementById('cwAuthModal');
        if (modal) modal.classList.remove('show');
        if (global.document && global.document.body) global.document.body.style.overflow = '';
    }

    async function submitLoginForm(ev) {
        if (ev) ev.preventDefault();
        const email = (document.getElementById('cwAuthLoginEmail') || {}).value || '';
        const password = (document.getElementById('cwAuthLoginPassword') || {}).value || '';
        try {
            await login(email.trim(), password);
            closeAuthModal();
            if (typeof showToast === 'function') showToast('登录成功');
            if (typeof CitywalkFootprintSync !== 'undefined') {
                await CitywalkFootprintSync.onLoggedIn();
            }
        } catch (e) {
            if (typeof showToast === 'function') showToast(e.message || '登录失败');
        }
    }

    async function submitRegisterForm(ev) {
        if (ev) ev.preventDefault();
        const email = (document.getElementById('cwAuthRegEmail') || {}).value || '';
        const password = (document.getElementById('cwAuthRegPassword') || {}).value || '';
        const name = (document.getElementById('cwAuthRegName') || {}).value || '';
        try {
            await register(email.trim(), password, name.trim());
            closeAuthModal();
            if (typeof showToast === 'function') showToast('注册成功，正在同步…');
            if (typeof CitywalkFootprintSync !== 'undefined') {
                await CitywalkFootprintSync.onLoggedIn({ uploadLocalFirst: true });
            }
        } catch (e) {
            if (typeof showToast === 'function') showToast(e.message || '注册失败');
        }
    }

    async function submitChangePasswordForm(ev) {
        if (ev) ev.preventDefault();
        const current = (document.getElementById('cwAuthCurrentPassword') || {}).value || '';
        const next = (document.getElementById('cwAuthNewPassword') || {}).value || '';
        const confirm = (document.getElementById('cwAuthNewPasswordConfirm') || {}).value || '';
        if (next !== confirm) {
            if (typeof showToast === 'function') showToast('两次输入的新密码不一致');
            return;
        }
        try {
            await changePassword(current, next);
            closeAuthModal();
            if (typeof showToast === 'function') showToast('密码已更新，请在新设备用新密码登录');
        } catch (e) {
            if (typeof showToast === 'function') showToast(e.message || '修改失败');
        }
    }

    function bindAuthUi() {
        const btn = document.getElementById('cwAuthAvatarBtn');
        if (btn) {
            btn.addEventListener('click', () => {
                if (isLoggedIn()) {
                    openAuthModal('account');
                    return;
                }
                openAuthModal('login');
            });
        }
        const loginForm = document.getElementById('cwAuthLoginForm');
        if (loginForm) loginForm.addEventListener('submit', submitLoginForm);
        const regForm = document.getElementById('cwAuthRegisterForm');
        if (regForm) regForm.addEventListener('submit', submitRegisterForm);
        const changeForm = document.getElementById('cwAuthChangePasswordForm');
        if (changeForm) changeForm.addEventListener('submit', submitChangePasswordForm);
        const logoutBtn = document.getElementById('cwAuthLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                const ok = global.confirm('退出登录？本地仍会保留一份缓存。');
                if (ok) logout();
            });
        }
        updateAuthChrome();
    }

    async function initAuth() {
        bindAuthUi();
        if (!getToken()) return;
        await refreshMe();
        if (typeof CitywalkFootprintSync !== 'undefined') {
            await CitywalkFootprintSync.pullFromCloud({ silent: true });
        }
    }

    global.CitywalkAuth = {
        AUTH_TOKEN_KEY,
        CW_API,
        getToken,
        isLoggedIn,
        loadCachedUser,
        userInitial,
        login,
        register,
        logout,
        changePassword,
        refreshMe,
        openAuthModal,
        closeAuthModal,
        initAuth,
        updateAuthChrome,
    };
})(typeof window !== 'undefined' ? window : globalThis);
