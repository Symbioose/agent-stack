// node-pty ships prebuilt `spawn-helper` binaries that are sometimes extracted
// without the execute bit, which makes pty.spawn fail with "posix_spawnp failed".
// This runs on postinstall to guarantee the helper is executable.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const prebuilds = path.join(root, '..', 'node_modules', 'node-pty', 'prebuilds');

try {
  for (const dir of fs.readdirSync(prebuilds)) {
    const helper = path.join(prebuilds, dir, 'spawn-helper');
    if (fs.existsSync(helper)) {
      fs.chmodSync(helper, 0o755);
      console.log(`[fix-node-pty] chmod +x ${path.relative(process.cwd(), helper)}`);
    }
  }
} catch {
  // node-pty not installed yet or no prebuilds on this platform — nothing to do.
}
