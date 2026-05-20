const brave = require('./brave');

const VOICES = [
  {
    id: 'ray_dalio',
    name: 'Ray Dalio',
    title: 'Founder, Bridgewater Associates',
    why: 'Built the world\'s largest hedge fund studying debt cycles and empire transitions',
    queries: ['Ray Dalio economy debt 2026', 'Ray Dalio US economy warning interview 2026']
  },
  {
    id: 'howard_marks',
    name: 'Howard Marks',
    title: 'Co-founder, Oaktree Capital',
    why: 'Known for clear thinking on market cycles and risk — his memos are read by every serious investor',
    queries: ['Howard Marks memo market outlook 2026', 'Howard Marks economy risk 2026']
  },
  {
    id: 'warren_buffett',
    name: 'Warren Buffett',
    title: 'Chairman, Berkshire Hathaway',
    why: 'Has seen every market cycle since the 1950s — when he speaks about the economy, people listen',
    queries: ['Warren Buffett economy outlook 2026', 'Buffett Berkshire annual meeting 2026 economy']
  },
  {
    id: 'stanley_druckenmiller',
    name: 'Stanley Druckenmiller',
    title: 'Former Quantum Fund, Duquesne Capital',
    why: 'Best macro trader alive — has predicted every major market turn in 40 years with unusual directness',
    queries: ['Stanley Druckenmiller economy 2026 interview', 'Druckenmiller market outlook warning 2026']
  },
  {
    id: 'jeremy_grantham',
    name: 'Jeremy Grantham',
    title: 'Co-founder, GMO',
    why: 'Called the dot-com bubble, the 2008 crash, and the 2021 bubble — consistently early and right on overvaluation',
    queries: ['Jeremy Grantham market bubble 2026', 'Grantham GMO economy outlook 2026']
  },
  {
    id: 'mohamed_el_erian',
    name: 'Mohamed El-Erian',
    title: 'Former CEO, PIMCO; Bloomberg Opinion',
    why: 'One of the clearest communicators on Fed policy and global economics — writes for a general audience',
    queries: ['Mohamed El-Erian Fed economy 2026', 'El-Erian interest rates inflation 2026']
  }
];

async function fetchAll() {
  const results = [];
  const gaps = [];

  for (const voice of VOICES) {
    try {
      // Try primary query first, fall back to secondary
      let hits = await brave.search(voice.queries[0], 3);
      if (!hits.length || !hits[0].description) {
        hits = await brave.search(voice.queries[1], 3);
      }

      // Find the most relevant, recent snippet
      const best = hits.find(h => h.description && h.description.length > 60) || hits[0];
      if (best) {
        results.push({
          id: voice.id,
          name: voice.name,
          title: voice.title,
          why: voice.why,
          snippet: best.description,
          source_title: best.title,
          url: best.url,
          published: best.published
        });
      } else {
        gaps.push(`No recent results for ${voice.name}`);
      }
    } catch (err) {
      gaps.push(`${voice.name}: ${err.message}`);
    }
  }

  return { voices: results, gaps };
}

module.exports = { fetchAll, VOICES };
