import { copyFile, mkdir } from 'node:fs/promises';
import { platform } from 'node:process';

const extension = platform === 'win32' ? '.exe' : '';
await mkdir('dist/bin', { recursive: true });
await copyFile(`cli/target/release/asp${extension}`, `dist/bin/asp${extension}`);
console.log(`Copied release binary to dist/bin/asp${extension}`);
