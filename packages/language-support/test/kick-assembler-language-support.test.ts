import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { KickAssemblerLanguageSupport } from '../src/project/kick-assembler-language-support.ts';

const projectRootPath = fileURLToPath(
  new URL('./fixtures/project/main.asm', import.meta.url)
);
const includeRootPath = fileURLToPath(
  new URL('./fixtures/include-root', import.meta.url)
);

test('KickAssemblerLanguageSupport resolves imports and builds an initial symbol index', async () => {
  const service = new KickAssemblerLanguageSupport({
    searchRoots: [includeRootPath]
  });

  const project = await service.loadProjectFromPath(projectRootPath);
  const mainSprite = project.symbolIndex.find('MainSprite')[0];
  const librarySprite = project.symbolIndex.find('LibrarySprite')[0];
  const vendorSymbol = project.symbolIndex.find('MACRO_ENTRY')[0];
  const vendorInclude = project.root.resolvedIncludes.find(
    (include) => include.specifier === 'vendor/macros.asm'
  );

  assert.equal(project.documents.size, 4);
  assert.equal(project.root.resolvedIncludes.length, 3);
  assert.equal(project.root.unresolvedIncludes.length, 1);
  assert.equal(vendorInclude?.resolutionStrategy, 'search-root');
  assert.equal(mainSprite?.kind, 'label');
  assert.equal(mainSprite?.data?.byteLength, 8);
  assert.deepEqual(mainSprite?.data?.valueCountsPerLine, [4, 4]);
  assert.equal(mainSprite?.data?.presentation, 'hexadecimal');
  assert.equal(librarySprite?.data?.presentation, 'binary');
  assert.equal(project.symbolIndex.find('SCREEN')[0]?.kind, 'constant');
  assert.equal(project.symbolIndex.find('currentRow')[0]?.kind, 'variable');
  assert.equal(project.symbolIndex.find('spriteWidth')[0]?.kind, 'label');
  assert.equal(vendorSymbol?.kind, 'constant');
  assert.equal(
    project.diagnostics.some((diagnostic) => diagnostic.code === 'include-not-found'),
    true
  );
});
