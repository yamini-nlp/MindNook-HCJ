window.MindNookBaseline = (function () {
    function classifyPragmatic(text) {
      const t = text.trim().toLowerCase();
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 4);
      let questionCount = 0, helpCount = 0, assertCount = 0, expressCount = 0;
  
      const helpPhrases = ['i need', 'i want', 'help me', 'how do i', 'what should', 'i wish', 'i hope', 'i wish', 'please', 'can i', 'should i'];
      const expressPhrases = ['i feel', 'i felt', 'i am feeling', 'i was feeling', 'i\'m', 'i\'ve been', 'i was', 'i am', 'makes me', 'i love', 'i hate', 'i miss', 'i fear', 'i enjoy'];
  
      sentences.forEach(s => {
        const st = s.trim().toLowerCase();
        if (st.endsWith('?') || /^(what|why|how|when|where|who|is|are|do|did|can|could|would|should)\b/.test(st)) {
          questionCount++;
        } else if (helpPhrases.some(p => st.includes(p))) {
          helpCount++;
        } else if (expressPhrases.some(p => st.includes(p))) {
          expressCount++;
        } else {
          assertCount++;
        }
      });
  
      const total = sentences.length || 1;
      const dominant = [
        { type: 'question', count: questionCount },
        { type: 'help-seeking', count: helpCount },
        { type: 'expression', count: expressCount },
        { type: 'assertion', count: assertCount },
      ].sort((a, b) => b.count - a.count)[0].type;
  
      return {
        dominant,
        distribution: {
          assertion: Math.round(assertCount / total * 100),
          expression: Math.round(expressCount / total * 100),
          helpSeeking: Math.round(helpCount / total * 100),
          question: Math.round(questionCount / total * 100),
        }
      };
    }
  
    function classifyTemporalTrend(entries) {
      if (!entries || entries.length < 3) return { label: 'insufficient data', direction: 'neutral' };
  
      const scores = entries.slice(0, 10).reverse().map(e => {
        if (!e.sentiment) return 50;
        const s = e.sentiment.toLowerCase();
        if (s.includes('positive')) return 75 + Math.random() * 15;
        if (s.includes('negative')) return 20 + Math.random() * 20;
        return 45 + Math.random() * 15;
      });
  
      const n = scores.length;
      const xMean = (n - 1) / 2;
      const yMean = scores.reduce((a, b) => a + b, 0) / n;
      let num = 0, den = 0;
      scores.forEach((y, x) => {
        num += (x - xMean) * (y - yMean);
        den += (x - xMean) ** 2;
      });
      const slope = den !== 0 ? num / den : 0;
  
      const variance = scores.reduce((acc, s) => acc + (s - yMean) ** 2, 0) / n;
  
      let label, direction;
      if (Math.abs(slope) < 1 && variance < 80) {
        label = 'stable';
        direction = 'neutral';
      } else if (slope >= 1) {
        label = 'improving';
        direction = 'up';
      } else if (slope <= -1) {
        label = 'declining';
        direction = 'down';
      } else if (variance >= 200) {
        label = 'cyclical';
        direction = 'mixed';
      } else {
        label = 'stable';
        direction = 'neutral';
      }
  
      return { label, slope: +slope.toFixed(2), variance: +variance.toFixed(1), direction, scores };
    }
  
    function computeGoalAlignment(analysisResult, entries) {
      const storedGoals = JSON.parse(localStorage.getItem('mindnook_goals') || '[]');
      const storedEmotions = JSON.parse(localStorage.getItem('mindnook_emotions') || '[]');
      const stressLevel = parseInt(localStorage.getItem('mindnook_stress') || '5');
  
      if (!storedGoals.length) return { score: null, label: 'No goals set', detail: 'Complete onboarding to enable goal alignment.' };
  
      let score = 50; 
      const sentiment = (analysisResult && analysisResult.sentiment) || 'Neutral';
      const ld = (analysisResult && analysisResult.lexicalDiversity) || 0;
      const wordCount = (analysisResult && analysisResult.wordCount) || 0;
  
      storedGoals.forEach(goal => {
        const g = goal.toLowerCase();
        if (g.includes('emotion') || g.includes('self-aware')) {
          if (sentiment === 'Positive') score += 10;
          score += Math.min(10, (analysisResult?.positiveWordCount || 0));
        }
        if (g.includes('stress') || g.includes('burnout')) {
          if (stressLevel < 5 && sentiment !== 'Negative') score += 15;
          if (sentiment === 'Negative') score -= 10;
        }
        if (g.includes('writing') || g.includes('vocab') || g.includes('clarity')) {
          score += Math.round(ld * 30);
          if (wordCount > 200) score += 10;
        }
        if (g.includes('habit') || g.includes('daily')) {
          if (entries && entries.length > 0) {
            const today = new Date().toDateString();
            const wroteTodayBefore = entries.slice(1).some(e => new Date(e.created_at).toDateString() === today);
            score += wroteTodayBefore ? 5 : 15;
          }
        }
        if (g.includes('grow') || g.includes('measure')) {
          if (entries && entries.length >= 5) score += 10;
        }
        if (g.includes('thought') || g.includes('organis') || g.includes('organiz')) {
          const pragmatic = classifyPragmatic((analysisResult && analysisResult._rawText) || '');
          if (pragmatic.dominant === 'assertion') score += 12;
        }
      });
  
      const negEmotions = ['anxious', 'overwhelmed', 'burned out', 'disconnected'];
      const currentlyNegative = storedEmotions.some(e => negEmotions.includes(e.toLowerCase()));
      if (currentlyNegative && sentiment === 'Positive') score += 15;
  
      score = Math.max(0, Math.min(100, Math.round(score)));
  
      let label, detail;
      if (score >= 75) { label = 'Strongly aligned'; detail = 'This entry resonates well with your journaling goals.'; }
      else if (score >= 50) { label = 'Partially aligned'; detail = 'Some elements of this entry support your goals.'; }
      else if (score >= 25) { label = 'Loosely aligned'; detail = 'This entry diverges somewhat from your stated goals.'; }
      else { label = 'Misaligned'; detail = 'This entry may reflect unresolved tension with your goals.'; }
  
      return { score, label, detail, goals: storedGoals };
    }
  
    function computeBaselineDelta(currentAnalysis, entries) {
      if (!entries || entries.length < 3) return null;
  
      const recentEntries = entries.slice(1, 6); 
      const avgWords = recentEntries.reduce((a, e) => a + (e.word_count || 0), 0) / recentEntries.length;
      const avgLex = recentEntries.reduce((a, e) => a + (parseFloat(e.lexical_diversity) || 0), 0) / recentEntries.length;
      const avgRead = recentEntries.reduce((a, e) => a + (parseInt(e.readability) || 50), 0) / recentEntries.length;
  
      return {
        wordsDelta: (currentAnalysis.wordCount || 0) - Math.round(avgWords),
        lexDelta: +((currentAnalysis.lexicalDiversity || 0) - avgLex).toFixed(2),
        readDelta: (currentAnalysis.readability || 50) - Math.round(avgRead),
        baseline: { avgWords: Math.round(avgWords), avgLex: +avgLex.toFixed(2), avgRead: Math.round(avgRead) }
      };
    }
  
    function buildUtilityScore(l1, l2, l3, l4) {
      const Cfp = 0.4, Cfn = 0.6;
      const sentimentScore = l1.sentiment === 'Positive' ? 1 : l1.sentiment === 'Negative' ? -1 : 0;
      const trendScore = l3.direction === 'up' ? 1 : l3.direction === 'down' ? -1 : 0;
      const goalScore = l4.score != null ? (l4.score - 50) / 50 : 0;
      const pragScore = l2.dominant === 'help-seeking' ? 1 : l2.dominant === 'question' ? 0.5 : 0;
  
      const rawUtility = (sentimentScore * Cfn) + (trendScore * 0.3) + (goalScore * 0.2) + (pragScore * Cfp);
      const utility = Math.max(-1, Math.min(1, rawUtility));
  
      let action;
      if (utility >= 0.5) action = 'affirm';
      else if (utility >= 0.1) action = 'encourage';
      else if (utility >= -0.1) action = 'reflect';
      else if (utility >= -0.5) action = 'support';
      else action = 'intervene';
  
      return { utility: +utility.toFixed(3), action };
    }
  
    function buildDynamicSystemPrompt(l1, l2, l3, l4, l5, journalContext) {
      const toneMap = {
        affirm: 'Be warm and celebratory. Reinforce what the user is doing well.',
        encourage: 'Be gently encouraging. Acknowledge progress while staying grounded.',
        reflect: 'Be neutral and thoughtful. Help the user explore their own patterns.',
        support: 'Be empathetic and careful. Acknowledge difficulty without amplifying it.',
        intervene: 'Be compassionate and grounding. Gently help the user reframe toward possibility.',
      };
  
      return `You are Nook AI, an emotionally intelligent reflective companion.
  
  FRAMEWORK ANALYSIS OF USER'S CURRENT STATE:
  - L1 Sentiment: ${l1.sentiment || 'Neutral'} (positive words: ${l1.positiveWordCount || 0}, negative: ${l1.negativeWordCount || 0})
  - L2 Pragmatic Mode: ${l2.dominant} (${JSON.stringify(l2.distribution)})
  - L3 Temporal Trend: ${l3.label} (slope: ${l3.slope}, direction: ${l3.direction})
  - L4 Goal Alignment: ${l4.label} (score: ${l4.score}/100) — Goals: ${(l4.goals || []).join(', ')}
  - L5 Utility Action: ${l5.action} (utility: ${l5.utility})
  
  RESPONSE DIRECTIVE: ${toneMap[l5.action] || toneMap.reflect}
  
  USER JOURNAL CONTEXT:
  ${journalContext}
  
  Rules:
  - Respond specifically to the user's pragmatic mode (${l2.dominant}): ${l2.dominant === 'question' ? 'answer their question directly' : l2.dominant === 'help-seeking' ? 'offer concrete support' : l2.dominant === 'expression' ? 'validate and reflect' : 'engage thoughtfully with their assertion'}
  - Reference the temporal trend (${l3.label}) where relevant
  - Keep responses 2–4 paragraphs unless the question genuinely requires more
  - Never give medical or clinical advice
  - Sound like you have read every entry carefully`;
    }
  
    return {
      classifyPragmatic,
      classifyTemporalTrend,
      computeGoalAlignment,
      computeBaselineDelta,
      buildUtilityScore,
      buildDynamicSystemPrompt,
    };
  })();