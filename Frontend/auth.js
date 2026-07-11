(function () {
  var cfg = window._env || {};
  var sb = supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
    auth: { flowType: 'implicit' }
  });

  window.__sb = sb;
  window.__authReady = false;
  window.__session = null;
  window.__user = null;
  window.__authHeader = null;

  var PUBLIC_PAGES = ['login.html', 'index.html', ''];

  function currentPage() {
    var parts = window.location.pathname.split('/');
    return parts[parts.length - 1] || '';
  }

  function isPublicPage() {
    return PUBLIC_PAGES.indexOf(currentPage()) !== -1;
  }

  function isLoginPage() {
    var page = currentPage();
    return page === 'login.html' || page === '';
  }

  function revealPage() {
    document.documentElement.classList.remove('mn-auth-pending');
    document.documentElement.classList.add('mn-auth-ready');
  }

  function fireAuthReady() {
    if (window.__authReady) return;
    window.__authReady = true;
    revealPage();
    window.dispatchEvent(new Event('auth-ready'));
  }

  function sendToLogin() {
    var target = 'login.html';
    var here = window.location.pathname + window.location.search;
    window.location.href = target + '?redirect=' + encodeURIComponent(here);
  }

  function setSession(session) {
    window.__session = session;
    window.__user = session.user;
    window.__authHeader = 'Bearer ' + session.access_token;
  }

  function clearSession() {
    window.__session = null;
    window.__user = null;
    window.__authHeader = null;
  }

  function resolveSession(session) {
    if (!session) {
      clearSession();
      if (!isPublicPage()) {
        sendToLogin();
        return;
      }
      fireAuthReady();
      return;
    }
    setSession(session);
    fireAuthReady();
  }

  sb.auth.onAuthStateChange(function (event, session) {
    if (event === 'SIGNED_IN' && session) {
      setSession(session);

      if (!isLoginPage()) {
        fireAuthReady();
        return;
      }

      sb.from('user_preferences').select('user_id').eq('user_id', session.user.id).maybeSingle()
        .then(function (res) {
          window.location.href = res.data ? 'dashboard.html' : 'onboarding.html';
        })
        .catch(function () {
          window.location.href = 'onboarding.html';
        });
      return;
    }

    if (event === 'SIGNED_OUT') {
      clearSession();
      try { localStorage.clear(); } catch (e) {}
      if (!isPublicPage()) {
        sendToLogin();
        return;
      }
      fireAuthReady();
      return;
    }

    if (event === 'TOKEN_REFRESHED' && session) {
      setSession(session);
      return;
    }

    if (event === 'USER_UPDATED' && session) {
      setSession(session);
    }
  });

  var authTimedOut = false;
  var authTimeout = setTimeout(function () {
    authTimedOut = true;
    if (!window.__authReady && !isPublicPage()) {
      sendToLogin();
    } else if (!window.__authReady) {
      fireAuthReady();
    }
  }, 8000);

  sb.auth.getSession().then(function (res) {
    clearTimeout(authTimeout);
    if (authTimedOut) return;
    resolveSession(res.data.session);
  }).catch(function () {
    clearTimeout(authTimeout);
    if (authTimedOut) return;
    if (!isPublicPage()) {
      sendToLogin();
    } else {
      fireAuthReady();
    }
  });

  window.signOut = function () {
    return sb.auth.signOut().then(function () {
      try { localStorage.clear(); } catch (e) {}
      window.location.href = 'login.html';
    });
  };

  window.mnRequireUser = function () {
    if (!window.__user) {
      sendToLogin();
      return null;
    }
    return window.__user;
  };
})();