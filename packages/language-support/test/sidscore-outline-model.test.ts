import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createTextDocumentModel } from '../src/document/text-document-model.ts';
import { buildSidScoreOutline } from '../src/outline/sidscore-outline-model.ts';

test('buildSidScoreOutline lists subtunes and nested effects', () => {
  const document = createTextDocumentModel({
    uri: 'file:///song.sidscore',
    languageId: 'sidscore',
    text: [
      'TITLE "Example"',
      '',
      'EFFECT IntroNoise {',
      '  VOICE ANY',
      '}',
      '',
      'TUNE 2 {',
      '  EFFECT Jump {',
      '    VOICE 1',
      '  }',
      '',
      '  EFFECT Land {',
      '    VOICE 2',
      '  }',
      '}',
      ''
    ].join('\n')
  });

  const outline = buildSidScoreOutline(document);

  assert.deepEqual(
    outline.map((symbol) => symbol.name),
    ['Subtune 1', 'Subtune 2']
  );
  assert.equal(outline[0]?.kind, 'subtune');
  assert.equal(outline[0]?.detail, 'implicit TUNE 1');
  assert.deepEqual(
    outline[0]?.children.map((symbol) => symbol.name),
    ['IntroNoise']
  );
  assert.deepEqual(
    outline[1]?.children.map((symbol) => symbol.name),
    ['Jump', 'Land']
  );
  assert.equal(outline[1]?.children[0]?.kind, 'effect');
  assert.deepEqual(outline[1]?.selectionRange, {
    start: { line: 6, character: 5 },
    end: { line: 6, character: 6 }
  });
  assert.deepEqual(outline[1]?.children[0]?.selectionRange, {
    start: { line: 7, character: 9 },
    end: { line: 7, character: 13 }
  });
});

test('buildSidScoreOutline lists top-level effects when there are no explicit subtunes', () => {
  const document = createTextDocumentModel({
    uri: 'file:///effect.sidscore',
    languageId: 'sidscore',
    text: [
      'EFFECT Blip {',
      '  GATE=ON',
      '}',
      '',
      'EFFECT Zap {',
      '  GATE=OFF',
      '}',
      ''
    ].join('\n')
  });

  const outline = buildSidScoreOutline(document);

  assert.deepEqual(
    outline.map((symbol) => symbol.name),
    ['Blip', 'Zap']
  );
  assert.deepEqual(
    outline.map((symbol) => symbol.kind),
    ['effect', 'effect']
  );
});

test('buildSidScoreOutline ignores comments and strings', () => {
  const document = createTextDocumentModel({
    uri: 'file:///comments.sidscore',
    languageId: 'sidscore',
    text: [
      '; EFFECT CommentedOut {',
      'TITLE "TUNE 7 { EFFECT Quoted {"',
      'TUNE 3 {',
      '  ; EFFECT AlsoCommentedOut {',
      '  EFFECT RealEffect {',
      '    NOTE="EFFECT NotReal"',
      '  }',
      '}',
      ''
    ].join('\n')
  });

  const outline = buildSidScoreOutline(document);

  assert.deepEqual(
    outline.map((symbol) => symbol.name),
    ['Subtune 1', 'Subtune 3']
  );
  assert.deepEqual(outline[0]?.children, []);
  assert.deepEqual(
    outline[1]?.children.map((symbol) => symbol.name),
    ['RealEffect']
  );
});
