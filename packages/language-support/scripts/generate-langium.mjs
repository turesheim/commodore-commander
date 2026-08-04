import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

import { generate } from 'langium-cli';

const langiumCliRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.resolve('langium-cli'))),
  '..'
);

const nodeUtilUrl = pathToFileURL(
  path.join(langiumCliRoot, 'lib/generator/node-util.js')
).href;
const { schema } = await import(nodeUtilUrl);
const langiumConfigSchema = await schema;

langiumConfigSchema.$id ??= pathToFileURL(
  path.join(langiumCliRoot, 'langium-config-schema.json')
).href;

const success = await generate(parseOptions(process.argv.slice(2)));
process.exit(success ? 0 : 2);

function parseOptions(args) {
  const options = {
    watch: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case '-f':
      case '--file':
        options.file = requireValue(args, index, arg);
        index += 1;
        break;
      case '-w':
      case '--watch':
        options.watch = true;
        break;
      case '-m':
      case '--mode':
        options.mode = requireValue(args, index, arg);
        if (options.mode !== 'development' && options.mode !== 'production') {
          throw new Error(
            `Invalid Langium mode "${options.mode}". ` +
              'Expected "development" or "production".'
          );
        }
        break;
      default:
        throw new Error(`Unknown Langium generate option "${arg}".`);
    }
  }

  return options;
}

function requireValue(args, index, optionName) {
  const value = args[index + 1];
  if (!value || value.startsWith('-')) {
    throw new Error(`Missing value for ${optionName}.`);
  }
  return value;
}
