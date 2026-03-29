#!/usr/bin/env node
'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHANGELOG_PATH = path.join(__dirname, '..', 'changelog.json');

function inferCategory(message) {
  const msg = message.toLowerCase();
  if (/\b(ui|style|design|button|layout|tooltip|background|image|logo)\b/.test(msg)) return 'UI';
  if (/\b(fix|fixed)\b/.test(msg)) return 'Fix';
  if (/\b(add|added)\b/.test(msg)) return 'Feature';
  if (/\b(update|edit|change)\b/.test(msg)) return 'Content';
  return 'Content';
}

// Get latest commit info
let latestCommit;
try {
  const output = execSync('git log -1 --format="%ad|%s" --date=short', { encoding: 'utf8' }).trim();
  const [date, ...subjectParts] = output.replace(/^"|"$/g, '').split('|');
  const subject = subjectParts.join('|');
  latestCommit = { date: date.trim(), subject: subject.trim() };
} catch (e) {
  console.error('Failed to get latest commit:', e.message);
  process.exit(1);
}

// Read existing changelog
let changelog = [];
if (fs.existsSync(CHANGELOG_PATH)) {
  try {
    changelog = JSON.parse(fs.readFileSync(CHANGELOG_PATH, 'utf8'));
  } catch (e) {
    console.error('Failed to parse changelog.json:', e.message);
    process.exit(1);
  }
}

const { date, subject } = latestCommit;
const category = inferCategory(subject);
const newEntry = { category, description: subject };

// Find or create date entry
let dateEntry = changelog.find(d => d.date === date);
if (!dateEntry) {
  dateEntry = { date, entries: [] };
  changelog.unshift(dateEntry);
} else {
  // Move to front if not already there (to maintain newest-first order)
  changelog = changelog.filter(d => d.date !== date);
  changelog.unshift(dateEntry);
}

// Check for duplicate
const isDuplicate = dateEntry.entries.some(e => e.description === subject);
if (isDuplicate) {
  console.log('Entry already exists for this commit, skipping.');
  process.exit(0);
}

// Append new entry
dateEntry.entries.push(newEntry);

// Sort newest-first by date
changelog.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

// Write back
fs.writeFileSync(CHANGELOG_PATH, JSON.stringify(changelog, null, 2) + '\n', 'utf8');
console.log(`Changelog updated: [${category}] ${subject} (${date})`);
