import { cpSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDirectory, '..');
const distRoot = path.join(packageRoot, 'dist');

mkdirSync(distRoot, { recursive: true });
cpSync(path.join(packageRoot, 'reference'), path.join(distRoot, 'reference'), {
  recursive: true
});
cpSync(path.join(packageRoot, 'syntaxes'), path.join(distRoot, 'syntaxes'), {
  recursive: true
});
