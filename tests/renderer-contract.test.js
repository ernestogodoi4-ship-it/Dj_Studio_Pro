const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'app/index.html'), 'utf8');
const analyzer = fs.readFileSync(path.join(root, 'app/melody-factory-dj.js'), 'utf8');
const melodyStudio = fs.readFileSync(path.join(root, 'app/melody-factory.html'), 'utf8');
const main = fs.readFileSync(path.join(root, 'main.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const notes = fs.readFileSync(path.join(root, 'RELEASE_NOTES.md'), 'utf8');

test('release metadata is synchronized and included in the packaged app', () => {
  assert.equal(pkg.version, '2.4.20');
  assert.match(pkg.build.files.join(' '), /RELEASE_NOTES\.md/);
  assert.match(main, /currentVersion: app\.getVersion\(\), packaged: app\.isPackaged, releaseNotes/);
  assert.match(notes, /^# DJ Studio PRO 2\.4\.20/m);
  assert.doesNotMatch(html, /DJ Studio PRO 2\.3 — gravação corrigida|2\.4\.10/);
});

test('workspace tabs provide a dedicated deck view and hide performance controls in work tabs', () => {
  assert.match(html, /\['decks','Decks'\]/);
  assert.match(html, /const TABS=\[\['decks','Decks'\],\['files','Arquivos'\]/);
  assert.match(html, /data-t="decks"/);
  assert.match(html, /classList\.toggle\('deck-view',key==='decks'\)/);
  assert.match(html, /classList\.toggle\('workspace-view',key!=='decks'&&key!=='mel'\)/);
  assert.match(html, /body\.workspace-view \.decks,body\.workspace-view \.cards/);
  assert.match(html, /body\.v16\.workspace-view \.decks,body\.v16\.workspace-view \.cards[^\{]*\{display:none!important\}/);
  assert.match(html, /body\.hd\.deck-view:not\(\.free\):not\(\.mel-mode\) \.spl\{display:block\}/);
  assert.match(html, /body\.workspace-view \.spl\{display:none!important\}/);
  assert.match(html, /body\.workspace-view #lib>\.hdl,body\.workspace-view #lib>\.grp\{display:none!important;pointer-events:none!important\}/);
  assert.match(html, /if\(key!=='decks'\)suspendDeckLayoutEditForStudio\(\)/);
  assert.match(html, /body\.workspace-view #lib>#tp-files\.tp\.on/);
  assert.match(html, /function openDecks\(\)\{hideHome\(\);document\.querySelector\('\.tabs \[data-t="decks"\]'\)/);
});

test('workspaces fill the viewport and preserve the deck-only layout', () => {
  assert.match(html, /body\.v16\.workspace-view \.app\{[^}]*transform:none!important/);
  assert.match(html, /body\.v16\.workspace-view #lib\{[^}]*flex:1 1 0!important/);
  assert.match(html, /body\.v16\.deck-view:not\(\.free\) \.app\{[^}]*grid-template-rows:52px minmax\(0,1fr\) var\(--cardsH,112px\)!important/);
  assert.match(html, /body\.deck-view:not\(\.free\) #lib\{display:none!important\}/);
});

test('deck screen has independent resize dividers for the four control cards and their row height', () => {
  assert.match(html, /--cardsH,112px/);
  assert.match(html, /className='spl spl-card'/);
  assert.match(html, /className='spl spl-row'/);
  assert.match(html, /djstudio-panel-splits-v1/);
  assert.match(html, /dblclick'.*weights=defaults\.slice\(\)/);
});

test('MIDI controls live in their own workspace tab and file library divider can reset', () => {
  assert.match(html, /\['midi','Controladores MIDI'\]/);
  assert.equal((html.match(/data-t="midi"/g) || []).length, 1);
  assert.doesNotMatch(html, /createElement\('button'\);btn\.type='button';btn\.id='midiDevicesBtn'/);
  assert.match(html, /document\.querySelector\('#tp-midi'\)\.append\(box\)/);
  assert.match(html, /setFileSplitSize\(mobileFileSplit\(\)\?180:232\)/);
  assert.match(html, /fileSplit\.addEventListener\('dblclick'/);
});

test('main tabs all have icons and update action is icon-only', () => {
  assert.match(html, /const TI=\{decks:svg\(/);
  assert.match(html, /appsNav\.innerHTML=svg\(/);
  assert.match(html, /\$\('#checkUpdates'\)\.innerHTML='<span aria-hidden="true">⟳<\/span>'/);
  assert.match(html, /top-actions #checkUpdates\{width:36px!important/);
});

test('Melody Studio places the icon-only back control after its logo and adds toolbar icons', () => {
  const header = melodyStudio.indexOf('<header class="transport">');
  const back = melodyStudio.indexOf('id="btnBackStudio"');
  const brand = melodyStudio.indexOf('<div class="brand">', header);
  const project = melodyStudio.indexOf('id="btnProj"', header);
  assert.ok(header >= 0 && brand > header && back > brand && back < project);
  assert.match(melodyStudio.slice(back, project), /aria-label="Voltar aos decks"[\s\S]*?<svg/);
  assert.match(melodyStudio, /id="btnPiano"[^>]*><svg/);
  assert.doesNotMatch(melodyStudio, /← Voltar aos decks/);
});

test('home news and update modal consume release notes from the version API', () => {
  assert.match(html, /function setHomeNews\(raw\)/);
  assert.match(html, /if\(v\?\.releaseNotes\)setHomeNews\(v\.releaseNotes\)/);
  assert.match(html, /if\(v\.releaseNotes\)\{localReleaseNotes=plainReleaseNotes\(v\.releaseNotes\)/);
});

test('DJ Studio settings include a persisted fullscreen option and a shortcuts section', () => {
  assert.match(html, /id="openFullscreen"/);
  assert.match(html, /data-settings-tab="shortcuts"/);
  assert.match(html, /id="settingsShortcutPanel"/);
  assert.match(main, /djstudio:fullscreen:get/);
  assert.match(main, /djstudio:fullscreen:set/);
  assert.match(main, /fullscreen: readFullscreenPreference\(\)/);
});

test('analysis and audio workspaces provide session tools without changing the separate Melody Studio', () => {
  assert.match(html, /data-analysis-export/);
  assert.match(html, /compatibilidade entre decks/);
  assert.match(html, /Monitor de frequência/);
  assert.match(html, /leitura relativa em tempo real/i);
  assert.match(html, /background-image:none!important/);
  assert.match(html, /home-bg-video\{position:fixed!important/);
  assert.match(html, /top-actions #openMelody::before/);
  assert.match(html, /\.tabs:not\(\.nav\) \.tb \.tab-label/);
  assert.match(html, /\.tabs\.nav \.tb::after/);
  assert.match(notes, /Análise e Áudio/);
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
  for (const [index, match] of [...melodyStudio.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].entries()) {
    if (match[1].trim()) assert.doesNotThrow(() => new vm.Script(match[1], { filename: `melody-inline-script-${index + 1}` }));
  }
  assert.doesNotThrow(() => new vm.Script(main, { filename: 'main.js' }));
});
