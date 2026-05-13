(function() {
  const { createClient } = supabase;
  const sb = createClient(
    'https://dowtaqgkcbppyjxknaqx.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvd3RhcWdrY2JwcHlqeGtuYXF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5ODcyMTMsImV4cCI6MjA4ODU2MzIxM30.1dlwW0ZoQEEKjweXpGUcVKyd_Rlap-gC2CcwkZXwEgk'
  );

  window.__sb = sb;

  sb.auth.getSession().then(({ data: { session } }) => {
    if (!session) {
      window.location.href = 'login.html';
      return;
    }
    window.__session = session;
    window.__user = session.user;
    window.__authHeader = `Bearer ${session.access_token}`;
    const event = new Event('auth-ready');
    window.dispatchEvent(event);
  });

  window.signOut = async function() {
    await sb.auth.signOut();
    localStorage.clear();
    window.location.href = 'login.html';
  };
})();