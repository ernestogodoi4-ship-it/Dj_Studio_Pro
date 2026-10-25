const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'app/index.html'), 'utf8');
const analyzer = fs.readFileSync(path.join(root, 'app/melody-factory-dj.js'), 'utf8');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const notes = fs.readFileSync(path.join(root, 'RELEASE_NOTES.md'), 'utf8');

test('release metadata is synchronized and included in the packaged app', () => {
  assert.equal(pkg.version, '2.4.17');
  assert.match(pkg.build.files.join(' '), /RELEASE_NOTES\.md/);
  assert.match(main, /currentVersion: app\.getVersion\(\), packaged: app\.isPackaged, releaseNotes/);
  assert.match(notes, /^# DJ Studio PRO 2\.4\.17/m);
  assert.doesNotMatch(html, /DJ Studio PRO 2\.3 — gravação corrigida|2\.4\.10/);
});

test('workspace tabs provide a dedicated deck view and hide performance controls in work tabs', () => {
  assert.match(html, /\['decks','Decks'\]/);
  assert.match(html, /data-t="decks"/);
  assert.match(html, /classList\.toggle\('deck-view',key==='decks'\)/);
  assert.match(html, /classList\.toggle\('workspace-view',key!=='decks'&&key!=='mel'\)/);
  assert.match(html, /body\.workspace-view \.decks,body\.workspace-view \.cards/);
  assert.match(html, /body\.workspace-view #lib>#tp-files\.tp\.on/);
  assert.match(html, /function openDecks\(\)\{hideHome\(\);document\.querySelector\('\.tabs \[data-t="decks"\]'\)/);
});

test('home news and update modal consume release notes from the version API', () => {
  assert.match(html, /function setHomeNews\(raw\)/);
  assert.match(html, /if\(v\?\.releaseNotes\)setHomeNews\(v\.releaseNotes\)/);
  assert.match(html, /if\(v\.releaseNotes\)\{localReleaseNotes=plainReleaseNotes\(v\.releaseNotes\)/);
});

test('Playlist Analyzer summary is readable and honors reduced motion', () => {
  assert.match(analyzer, /mf-summary-ticker[^`]*height:38px/);
  assert.match(analyzer, /font-size:12px/);
  assert.match(analyzer, /animation:mfSummaryTicker 120s linear infinite/);
  assert.match(analyzer, /prefers-reduced-motion:reduce/);
});

test('embedded renderer scripts parse as JavaScript', () => {
  const blocks = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]).filter(code => code.trim());
  assert.ok(blocks.length > 0);
  for (const [index, code] of blocks.entries()) assert.doesNotThrow(() => new vm.Script(code, { filename: `inline-script-${index + 1}` }));
  assert.doesNotThrow(() => new vm.Script(analyzer, { filename: 'melody-factory-dj.js' }));
  assert.doesNotThrow(() => new vm.Script(main, { filename: 'main.js' }));
});
