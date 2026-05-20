const brave = require('./brave');

const VOICES = [
  {
    id: 'ray_dalio',
    name: 'Ray Dalio',
    title: 'Founder, Bridgewater Associates',
    why: 'Built the world\'s largest hedge fund studying debt cycles and empire transitions',
    baseQueries: ['Ray Dalio', 'Ray Dalio debt']
  },
  {
    id: 'howard_marks',
    name: 'Howard Marks',
    title: 'Co-founder, Oaktree Capital',
    why: 'Known for clear thinking on market cycles and risk — his memos are read by every serious investor',
    baseQueries: ['Howard Marks market', 'Howard Marks memo']
  },
  {
    id: 'warren_buffett',
    name: 'Warren Buffett',
    title: 'Chairman, Berkshire Hathaway',
    why: 'Has seen every market cycle since the 1950s — when he speaks about the economy, people listen',
    baseQueries: ['Warren Buffett economy', 'Warren Buffett Berkshire']
  },
  {
    id: 'stanley_druckenmiller',
    name: 'Stanley Druckenmiller',
    title: 'Former Quantum Fund, Duquesne Capital',
    why: 'Best macro trader alive — has predicted every major market turn in 40 years with unusual directness',
    baseQueries: ['Stanley Druckenmiller economy', 'Stanley Druckenmiller market']
  },
  {
    id: 'jeremy_grantham',
    name: 'Jeremy Grantham',
    title: 'Co-founder, GMO',
    why: 'Called the dot-com bubble, the 2008 crash, and the 2021 bubble — consistently early and right on overvaluation',
    baseQueries: ['Jeremy Grantham market', 'Jeremy Grantham stocks']
  },
  {
    id: 'mohamed_el_erian',
    name: 'Mohamed El-Erian',
    title: 'Former CEO, PIMCO; Bloomberg Opinion',
    why: 'One of the clearest communicators on Fed policy and global economics — writes for a general audience',
    baseQueries: ['Mohamed El-Erian economy', 'Mohamed El-Erian inflation']
  }
];

async function fetchAll() {
  const results = [];
  const gaps = [];
  const year = new Date().getFullYear();
  const prevYear = year - 1;

  for (const voice of VOICES) {
    try {
      // Build attempts: current year first, then previous year, then no year
      const attempts = [];
      for (const base of voice.baseQueries) {
        attempts.push(`${base} ${year}`);
        attempts.push(`${base} ${prevYear}`);
      }
      for (const base of voice.baseQueries) {
        attempts.push(base);
      }

      let best = null;
      for (const q of attempts) {
        const hits = await brave.search(q, 5);
        best = hits.find(h => h.description && h.description.length > 60);
        if (best) break;
      }

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
