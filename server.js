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

app.listen(PORT, () => {
  console.log(`Finance Dashboard running on port ${PORT}`);
});
