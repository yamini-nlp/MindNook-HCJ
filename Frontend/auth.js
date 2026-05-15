(function () {
  const { createClient } = supabase;
  const sb = createClient(
    'https://dowtaqgkcbppyjxknaqx.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvd3RhcWdrY2JwcHlqeGtuYXF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5ODcyMTMsImV4cCI6MjA4ODU2MzIxM30.1dlwW0ZoQEEKjweXpGUcVKyd_Rlap-gC2CcwkZXwEgk'
  );

  window.__sb = sb;

  const PUBLIC_PAGES = ['login.html', 'index.html', ''];

  function currentPage() {
    const parts = window.location.pathname.split('/');
    return parts[parts.length - 1] || '';
  }

  function isPublicPage() {
    const page = currentPage();
    return PUBLIC_PAGES.some(p => page === p || page === '');
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
    window.dispatchEvent(new Event('auth-ready'));
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      window.__session = session;
      window.__user = session.user;
      window.__authHeader = `Bearer ${session.access_token}`;

      const { data: prefs } = await sb
        .from('user_preferences')
        .select('user_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      const page = currentPage();
      if (page === 'login.html' || page === '') {
        if (prefs) {
          window.location.href = 'dashboard.html';
        } else {
          window.location.href = 'onboarding.html';
        }
      } else {
        window.dispatchEvent(new Event('auth-ready'));
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