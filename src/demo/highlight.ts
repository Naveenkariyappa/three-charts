import Prism from 'prismjs';
// Order matters: each grammar extends the ones before it.
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-jsx';
import 'prismjs/components/prism-tsx';
import 'prismjs/components/prism-bash';

/** The Prism grammar for a file name shown on a code block ("terminal" and "options" are labels, not files). */
function languageFor(file = ''): string {
  if (file === 'terminal') return 'bash';
  const ext = file.split('.').pop() ?? '';
  return { tsx: 'tsx', jsx: 'jsx', ts: 'typescript', js: 'javascript', mjs: 'javascript', html: 'markup', json: 'javascript' }[ext] ?? 'typescript';
}

/** Highlighted HTML for `code`. Prism escapes the source, so the result is safe to inject. */
export function highlight(code: string, file?: string): string {
  const lang = languageFor(file);
  const grammar = Prism.languages[lang];
  return grammar ? Prism.highlight(code, grammar, lang) : Prism.util.encode(code).toString();
}
