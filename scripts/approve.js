#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const db = require('../db');

const [,, action, id] = process.argv;

if (!action || !['list', 'approve', 'reject'].includes(action)) {
  console.log('Usage:');
  console.log('  node scripts/approve.js list');
  console.log('  node scripts/approve.js approve <id>');
  console.log('  node scripts/approve.js reject <id>');
  process.exit(0);
}

if (action === 'list') {
  const pending = db.getPendingApprovals();
  if (!pending.length) {
    console.log('No pending approvals.');
  } else {
    console.log(`\n${pending.length} pending approval(s):\n`);
    for (const item of pending) {
      console.log(`ID:      ${item.id}`);
      console.log(`Agent:   ${item.agent}`);
      console.log(`Action:  ${item.action}`);
      console.log(`Risk:    ${item.risk_level || 'unspecified'}`);
      console.log(`Detail:  ${item.description || '—'}`);
      console.log(`Created: ${item.created_at}`);
      console.log('---');
    }
  }
} else {
  if (!id) {
    console.error('Provide an approval ID.');
    process.exit(1);
  }
  db.resolveApproval(id, action);
  console.log(`Approval ${id}: ${action}d.`);
}
