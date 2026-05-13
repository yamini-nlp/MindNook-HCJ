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
  }