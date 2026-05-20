require('dotenv').config();
const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/dashboard', (req, res) => {
  try {
    res.json(db.getDashboard());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/approvals', (req, res) => {
  try {
    res.json(db.getPendingApprovals());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/approvals/:id/decide', (req, res) => {
  const { decision } = req.body;
  if (!['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ error: 'decision must be approve or reject' });
  }
  try {
    db.resolveApproval(req.params.id, decision);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/alerts/:id/resolve', (req, res) => {
  try {
    db.resolveAlert(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, context } = req.body;
    if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

    const systemPrompt = `You are Dr. Marcus Webb. PhD in international economics and geopolitics from Georgetown University. 22 years as a macro trader — Goldman Sachs, Bridgewater Associates, and your own fund for the last 8 years.

You think in transmission mechanisms: how geopolitical events move through supply chains, currencies, bond markets, and into equity prices. You have seen things go wrong that textbooks don't cover — the 1998 LTCM collapse, the 2008 credit crisis, the 2020 oil shock, the 2022 bond rout.

Your user is Larry Bernstein — 68, retired physician, intelligent but not a finance professional. He holds a mix of stocks and bonds in retirement accounts. He wants to understand what is actually happening, not platitudes.

Rules:
- Talk like a trusted friend with 22 years of trading experience. Not a disclaimer machine.
- When asked about a news item, immediately trace: event → mechanism → bond impact → equity impact → what it means for Larry's portfolio.
- Be specific about numbers when you know them. Be honest when you don't.
- Keep responses to 3-6 sentences unless the question genuinely requires more.
- Never say "it depends" without immediately saying what it depends on and what each outcome means.
- No bullet lists in responses. Write prose like you're talking across a desk.
- Never give explicit buy/sell advice but absolutely do say "this is a bad environment for X" or "Y is what I'd be watching."`;

    let apiMessages = [...messages];
    if (context) {
      apiMessages = [
        { role: 'user', content: `Here is current context from my dashboard: ${context}` },
        { role: 'assistant', content: 'Got it — I have the current market context. What do you want to know?' },
        ...messages
      ];
    }

    const Anthropic = require('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      messages: apiMessages
    });

    res.json({ reply: response.content[0].text });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'Chat unavailable' });
  }
});

app.listen(PORT, () => {
  console.log(`Finance Dashboard running on port ${PORT}`);
});
