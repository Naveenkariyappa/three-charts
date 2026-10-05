// Prettier in a worker thread: scripts/registry.mjs formats generated JS in parallel.
import { parentPort } from 'node:worker_threads';
import * as prettier from 'prettier';

parentPort.on('message', async ({ id, code, options }) => {
  try {
    parentPort.postMessage({ id, code: await prettier.format(code, options) });
  } catch (e) {
    parentPort.postMessage({ id, error: String(e) });
  }
});
