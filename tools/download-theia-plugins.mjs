#!/usr/bin/env node
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const downloadPlugins = require('@theia/cli/lib/download-plugins').default;
const { DEFAULT_SUPPORTED_API_VERSION } = require('@theia/application-package/lib/api');
const { NodeRequestService } = require('@theia/request/lib/node-request-service');
const { OVSXHttpClient, OVSX_RATE_LIMIT } = require('@theia/ovsx-client');
const { RateLimiter } = require('limiter');

const apiUrl = 'https://open-vsx.org/api';

try {
  await assertTheiaPluginsConfigured();
  const requestService = new NodeRequestService();
  await requestService.configure({
    strictSSL: false
  });
  const rateLimiter = new RateLimiter({
    tokensPerInterval: OVSX_RATE_LIMIT,
    interval: 'second'
  });
  const client = new OVSXHttpClient(apiUrl, requestService, rateLimiter);
  await downloadPlugins(client, rateLimiter, requestService, {
    apiVersion: DEFAULT_SUPPORTED_API_VERSION,
    ignoreErrors: false,
    packed: false,
    parallel: true
  });
  process.exit(0);
} catch (error) {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
}

async function assertTheiaPluginsConfigured() {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
  if (!packageJson.theiaPlugins || !packageJson.theiaPluginsDir) {
    throw new Error(
      'Expected package.json to define theiaPlugins and theiaPluginsDir.'
    );
  }
}
