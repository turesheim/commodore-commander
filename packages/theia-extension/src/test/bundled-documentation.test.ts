import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

test('bundled documentation registry includes the embedded keyboard mapping guide', async () => {
  const registrySource = await readFile(
    path.resolve(
      __dirname,
      '..',
      '..',
      'src',
      'browser',
      'commodore-commander-bundled-docs.ts'
    ),
    'utf8'
  );
  const docsRoot = path.resolve(__dirname, '..', '..', '..', '..', 'bundled-docs');

  assert.match(registrySource, /path:\s*'keyboard-mapping\.md'/u);
  assert.match(registrySource, /label:\s*'Embedded Emulator Keyboard Mapping'/u);
  await access(path.join(docsRoot, 'keyboard-mapping.md'));

  const guide = await readFile(path.join(docsRoot, 'keyboard-mapping.md'), 'utf8');
  assert.match(guide, /PETSCII/u);
  assert.match(guide, /Commodore Shift/u);
  assert.match(guide, /Nordic ISO Mac/u);
  assert.match(guide, /Option\+P/u);
  assert.match(guide, /2191/u);
  assert.match(guide, /Left Option\/Alt is mapped to the Commodore `C=` key/u);
  assert.match(guide, /Mac F1-F8 map to Commodore F1-F8/u);
  assert.match(guide, /captured before\s+Theia keybindings/u);
  assert.match(guide, /F9-F12 are not Commodore function keys/u);
  assert.match(guide, /F11 toggles a\s+compact virtual keyboard overlay/u);
  assert.match(guide, /virtual keyboard shortcut\s+applies whenever an embedded emulator is running/u);
  assert.match(guide, /Mouse clicks on virtual keys/u);
  assert.match(guide, /Commodore logo key/u);
  assert.match(guide, /Drag the\s+top edge of the virtual keyboard/u);
  assert.match(guide, /Commodore extended colors/u);
  assert.match(guide, /`CTRL\+E` selects white text/u);
  assert.match(guide, /`CTRL\+S` sends HOME/u);
  assert.match(guide, /commodoreCommander\.emulator\.virtualKeyboardShortcut/u);
  assert.match(guide, /commodoreCommander\.emulator\.viceMenuShortcut/u);
});

test('registered bundled Markdown documents exist in bundled-docs', async () => {
  const registrySource = await readFile(
    path.resolve(
      __dirname,
      '..',
      '..',
      'src',
      'browser',
      'commodore-commander-bundled-docs.ts'
    ),
    'utf8'
  );
  const docsRoot = path.resolve(__dirname, '..', '..', '..', '..', 'bundled-docs');
  const registeredMarkdownPaths = Array.from(
    registrySource.matchAll(/path:\s*'([^']+\.md)'/gu),
    match => match[1]
  );

  assert.ok(registeredMarkdownPaths.length > 0);
  for (const relativePath of registeredMarkdownPaths) {
    await access(path.join(docsRoot, relativePath));
  }
});
