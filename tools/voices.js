const brave = require('./brave');

const VOICES = [
  {
    id: 'ray_dalio',
    name: 'Ray Dalio',
    title: 'Founder, Bridgewater Associates',
    why: 'Built the world\'s largest hedge fund studying debt cycles and empire transitions',
    queries: ['Ray Dalio economy warning interview', 'Ray Dalio debt cycle US economy']
  },
  {
    id: 'howard_marks',
    name: 'Howard Marks',
    title: 'Co-founder, Oaktree Capital',
    why: 'Known for clear thinking on market cycles and risk — his memos are read by every serious investor',
    queries: ['Howard Marks memo market risk', 'Howard Marks Oaktree investing outlook']
  },
  {
    id: 'warren_buffett',
    name: 'Warren Buffett',
    title: 'Chairman, Berkshire Hathaway',
    why: 'Has seen every market cycle since the 1950s — when he speaks about the economy, people listen',
    queries: ['Warren Buffett economy stocks interview', 'Buffett Berkshire economy market outlook']
  },
  {
    id: 'stanley_druckenmiller',
    name: 'Stanley Druckenmiller',
    title: 'Former Quantum Fund, Duquesne Capital',
    why: 'Best macro trader alive — has predicted every major market turn in 40 years with unusual directness',
    queries: ['Stanley Druckenmiller economy interview warning', 'Druckenmiller market recession outlook']
  },
  {
    id: 'jeremy_grantham',
    name: 'Jeremy Grantham',
    title: 'Co-founder, GMO',
    why: 'Called the dot-com bubble, the 2008 crash, and the 2021 bubble — consistently early and right on overvaluation',
    queries: ['Jeremy Grantham market bubble warning', 'Grantham GMO economy overvalued']
  },
  {
    id: 'mohamed_el_erian',
    name: 'Mohamed El-Erian',
    title: 'Former CEO, PIMCO; Bloomberg Opinion',
    why: 'One of the clearest communicators on Fed policy and global economics — writes for a general audience',
    queries: ['Mohamed El-Erian Fed interest rates economy', 'El-Erian inflation bonds outlook']
  }
];

async function fetchAll() {
  const results = [];
  const gaps = [];

  for (const voice of VOICES) {
    try {
      // Try progressively wider searches until we get a usable snippet
      const attempts = [
        [voice.queries[0], 'pm'],
        [voice.queries[1], 'pm'],
        [voice.queries[0], 'py'],
        [voice.queries[1], 'py'],
        [voice.queries[0], null],
        [voice.queries[1], null],
      ];

      let best = null;
      for (const [q, freshness] of attempts) {
        const opts = freshness ? { freshness } : {};
        const hits = await brave.search(q, 3, opts);
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
