(function () {
  const { createClient } = supabase;
  const sb = createClient(
    'https://dowtaqgkcbppyjxknaqx.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvd3RhcWdrY2JwcHlqeGtuYXF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5ODcyMTMsImV4cCI6MjA4ODU2MzIxM30.1dlwW0ZoQEEKjweXpGUcVKyd_Rlap-gC2CcwkZXwEgk',
    { auth: { flowType: 'implicit' } }
  );

  window.__sb = sb;
  window.__authReady = false;

  const PUBLIC_PAGES = ['login.html', 'index.html', ''];

  function currentPage() {
    const parts = window.location.pathname.split('/');
    return parts[parts.length - 1] || '';
  }

  function isPublicPage() {
    const page = currentPage();
    return PUBLIC_PAGES.some(p => page === p);
  }

  function isLoginPage() {
    const page = currentPage();
    return page === 'login.html' || page === '';
  }

  function fireAuthReady() {
    if (window.__authReady) return;
    window.__authReady = true;
    window.dispatchEvent(new Event('auth-ready'));
  }

  function resolveSession(session) {
    if (!session) {
      if (!isPublicPage()) {
        window.location.href = 'login.html';
      }
      return;
    }
    window.__session = session;
    window.__user = session.user;
    window.__authHeader = `Bearer ${session.access_token}`;
    fireAuthReady();
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      window.__session = session;
      window.__user = session.user;
      window.__authHeader = `Bearer ${session.access_token}`;

      if (!isLoginPage()) {
        fireAuthReady();
        return;
      }

      try {
        const { data: prefs } = await sb
          .from('user_preferences')
          .select('user_id')
          .eq('user_id', session.user.id)
          .maybeSingle();
        window.location.href = prefs ? 'dashboard.html' : 'onboarding.html';
      } catch (e) {
        window.location.href = 'onboarding.html';
      }
      return;
    }

    if (event === 'SIGNED_OUT') {
      localStorage.clear();
      if (!isPublicPage()) {
        window.location.href = 'login.html';
      }
      return;
    }

    if (event === 'TOKEN_REFRESHED' && session) {
      window.__session = session;
      window.__user = session.user;
      window.__authHeader = `Bearer ${session.access_token}`;
      return;
    }
  });

  sb.auth.getSession().then(({ data: { session } }) => {
    resolveSession(session);
  });

  window.signOut = async function () {
    await sb.auth.signOut();
    localStorage.clear();
    window.location.href = 'login.html';
  };
})();