const features = [
  { id: '01', title: 'Real-Book Experience', desc: 'Minimalist, distraction-free journaling.', img: '1.jpeg' },
  { id: '02', title: 'Vocabulary Builder', desc: 'Enhance your language with AI-powered suggestions.', img: '2.jpeg' },
  { id: '03', title: 'Growth Analytics', desc: 'Track moods, goals, and progress over time.', img: '3.jpeg' },
  { id: '04', title: 'Typography Insights', desc: 'Discover patterns in your writing style.', img: '4.jpeg' },
  { id: '05', title: 'AI Writing Assistant', desc: 'Improve your writing with smart feedback.', img: '5.jpeg' },
  { id: '06', title: 'Sentiment Analysis', desc: 'Tracks mood and generates uplifting AI stories.', img: '6.jpeg' }
];

const grid = document.getElementById('feature-container');
if (grid) {
  features.forEach(f => {
    grid.innerHTML += `
      <div class="feature-card-new">
        <span class="card-num">${f.id}</span>
        <h3>${f.title}</h3>
        <p>${f.desc}</p>
        <div class="asset-mini-placeholder">
          <img src="images/${f.img}" alt="${f.title}" class="feature-image">
        </div>
      </div>
    `;
  });
}

const toggleBtn = document.getElementById('theme-toggle');
if (toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    const body = document.body;
    body.classList.toggle('light');
    body.classList.toggle('dark');
    toggleBtn.innerText = body.classList.contains('light') ? '☀️' : '🌙';
  });
}

async function analyzeJournalEntry(journalText) {
  const url = 'https://dowtaqgkcbppyjxknaqx.supabase.co/functions/v1/analyze-journal';
  const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvd3RhcWdrY2JwcHlqeGtuYXF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5ODcyMTMsImV4cCI6MjA4ODU2MzIxM30.1dlwW0ZoQEEKjweXpGUcVKyd_Rlap-gC2CcwkZXwEgk';
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${anonKey}` },
      body: JSON.stringify({ text: journalText })
    });
    const result = await response.json();
    console.log("AI Analysis:", result);
    alert("Analysis received! Check the console.");
  } catch (error) {
    console.error("Error calling AI:", error);
  }
  window.MindNookHistory = (function () {
  function timeOfDayBucket(date) {
    const h = date.getHours();
    if (h >= 5 && h < 12) return 'morning';
    if (h >= 12 && h < 17) return 'afternoon';
    if (h >= 17 && h < 21) return 'evening';
    return 'night';
  }

  function wordCountBucket(count) {
    if (!count || count <= 0) return 'unknown';
    if (count < 80) return 'short';
    if (count < 300) return 'medium';
    return 'long';
  }

  function detectDevice() {
    const ua = (navigator.userAgent || '').toLowerCase();
    if (!ua) return 'desktop';
    if (/ipad|android(?!.*mobile)|tablet/.test(ua)) return 'mobile';
    if (/mobile|iphone|ipod|blackberry|windows phone/.test(ua)) return 'mobile';
    return 'desktop';
  }

  function buildEntryMetadata(opts) {
    opts = opts || {};
    return {
      mode: opts.mode || 'journal',
      device: detectDevice(),
      time_of_day_bucket: timeOfDayBucket(new Date()),
      word_count_bucket: wordCountBucket(opts.wordCount || 0)
    };
  }

  async function fallbackFetch(userId, limit) {
    const { data, error } = await window.__sb
      .from('journal_entries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit || 50);
    if (error) throw error;
    return (data || []).map(function (row) {
      return Object.assign({}, row, {
        x: row.id,
        t: row.created_at,
        s: row.sentiment_score != null ? row.sentiment_score : null,
        m: row.metadata || {}
      });
    });
  }

  async function getHistory(userId, limit) {
    if (!userId || !window.__sb) return [];
    try {
      const { data, error } = await window.__sb.functions.invoke('user-history', {
        body: { limit: limit || 50 }
      });
      if (error) throw error;
      if (!data || !data.history) throw new Error('empty_history_response');
      return data.history;
    } catch (err) {
      console.warn('getHistory: edge function failed, falling back to direct query.', err && err.message);
      try {
        return await fallbackFetch(userId, limit);
      } catch (fallbackErr) {
        console.error('getHistory: fallback query failed.', fallbackErr);
        return [];
      }
    }
  }

  return { getHistory: getHistory, buildEntryMetadata: buildEntryMetadata };
})();
}