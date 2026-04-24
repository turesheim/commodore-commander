import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  expandKickAssemblerDiagnosticRange,
  parseKickAssemblerCompilerDiagnostics
} from '../src/build/kick-assembler-compiler-diagnostics.ts';

test('parseKickAssemblerCompilerDiagnostics extracts summary diagnostics', () => {
  const diagnostics = parseKickAssemblerCompilerDiagnostics([
    '//------------------------------------------------------',
    'Got 2 errors and 1 warnings while executing:',
    '  (/tmp/project with spaces/main.asm 40:9) Error: Can\'t open file: library/libDefines.asm',
    '  (/tmp/project with spaces/shared.asm 12:3) Warning: Symbol already defined',
    '  (/tmp/project with spaces/main.asm 48:1) Error: Unexpected token',
    '  ...',
    '',
    '#import "library/libDefines.asm"',
    '        ^',
    '',
    'Error: Can\'t open file: library/libDefines.asm',
    'at line 40, column 9 in main.asm'
  ].join('\n'));

  assert.deepEqual(diagnostics, [
    {
      sourcePath: '/tmp/project with spaces/main.asm',
      severity: 'error',
      message: 'Can\'t open file: library/libDefines.asm',
      range: {
        start: { line: 39, character: 8 },
        end: { line: 39, character: 9 }
      }
    },
    {
      sourcePath: '/tmp/project with spaces/shared.asm',
      severity: 'warning',
      message: 'Symbol already defined',
      range: {
        start: { line: 11, character: 2 },
        end: { line: 11, character: 3 }
      }
    },
    {
      sourcePath: '/tmp/project with spaces/main.asm',
      severity: 'error',
      message: 'Unexpected token',
      range: {
        start: { line: 47, character: 0 },
        end: { line: 47, character: 1 }
      }
    }
  ]);
});

test('parseKickAssemblerCompilerDiagnostics returns no diagnostics for clean output', () => {
  const diagnostics = parseKickAssemblerCompilerDiagnostics([
    '//------------------------------------------------------',
    'parsing',
    'pass 1',
    'Writing output file',
    'Finished successfully.'
  ].join('\n'));

  assert.deepEqual(diagnostics, []);
});

test('parseKickAssemblerCompilerDiagnostics extracts single stack-trace diagnostic', () => {
  const diagnostics = parseKickAssemblerCompilerDiagnostics([
    '//------------------------------------------------------',
    'Output dir: /tmp/project/out',
    'parsing',
    '',
    '*=$0801',
    '#import "missing.asm"',
    '        ^',
    '',
    'Error: Can\'t open file: missing.asm',
    'at line 2, column 9 in main.asm'
  ].join('\n'));

  assert.deepEqual(diagnostics, [
    {
      sourcePath: 'main.asm',
      severity: 'error',
      message: 'Can\'t open file: missing.asm',
      range: {
        start: { line: 1, character: 8 },
        end: { line: 1, character: 9 }
      }
    }
  ]);
});

test('expandKickAssemblerDiagnosticRange expands to source token', () => {
  assert.deepEqual(
    expandKickAssemblerDiagnosticRange('#import "missing.asm"', {
      start: { line: 1, character: 8 },
      end: { line: 1, character: 9 }
    }),
    {
      start: { line: 1, character: 8 },
      end: { line: 1, character: 21 }
    }
  );

  assert.deepEqual(
    expandKickAssemblerDiagnosticRange('    .invalid', {
      start: { line: 3, character: 4 },
      end: { line: 3, character: 5 }
    }),
    {
      start: { line: 3, character: 4 },
      end: { line: 3, character: 12 }
    }
  );

  assert.deepEqual(
    expandKickAssemblerDiagnosticRange('    lda #$00', {
      start: { line: 5, character: 8 },
      end: { line: 5, character: 9 }
    }),
    {
      start: { line: 5, character: 8 },
      end: { line: 5, character: 12 }
    }
  );
});
