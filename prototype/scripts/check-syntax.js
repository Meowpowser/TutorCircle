/**
 * Checks every JavaScript file for syntax errors and verifies that every
 * relative import points to a file that exists and exports the imported names.
 * Usage: npm run check
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const roots = ['src', 'tests', 'scripts', 'server.js'];
const files = [];
const walk = (p) => {
  if (!existsSync(p)) return;
  if (statSync(p).isDirectory()) readdirSync(p).forEach((f) => walk(join(p, f)));
  else if (p.endsWith('.js')) files.push(p);
};
roots.forEach(walk);

let problems = 0;
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    problems++;
    console.error(`✗ Syntax error in ${file}\n${err.stderr}`);
  }
  const source = readFileSync(file, 'utf8');
  for (const m of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*'(\.[^']+)'/g)) {
    const target = resolve(dirname(file), m[2]);
    if (!existsSync(target)) { problems++; console.error(`✗ ${file}: missing module ${m[2]}`); continue; }
    const targetSource = readFileSync(target, 'utf8');
    for (const raw of m[1].split(',')) {
      const name = raw.trim().split(/\s+as\s+/)[0];
      if (!name) continue;
      const exported = new RegExp(`export\\s+(async\\s+)?(function|class|const|let)\\s+${name}\\b|export\\s*\\{[^}]*\\b${name}\\b`).test(targetSource);
      if (!exported) { problems++; console.error(`✗ ${file}: '${name}' is not exported by ${m[2]}`); }
    }
  }
}
console.log(problems ? `\n${problems} problem(s) found in ${files.length} files.` : `✓ ${files.length} files OK (syntax + imports).`);
process.exit(problems ? 1 : 0);
