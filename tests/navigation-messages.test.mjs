import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = await readFile(new URL('../src/components/Navigation/Navigation.tsx', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/components/Navigation/Navigation.module.css', import.meta.url), 'utf8');
const styles = Object.fromEntries([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((match) => [match[1], match[1]]));
let unreadCount = 0;
let selectedChatId = 'previous-chat';
function TestLink({ href, children, ...props }) {
  return React.createElement('a', { ...props, href: `http://localhost:3000${href}` }, children);
}
const compiledModule = { exports: {} };
const compiled = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
} }).outputText;
const dependencies = (name) => {
  if (name === 'next/link') return TestLink;
  if (name === 'next/navigation') return { usePathname: () => '/' };
  if (name.endsWith('Navigation.module.css')) return styles;
  if (name.endsWith('PlayerContext')) return { usePlayer: () => ({ mobileChatOpen: false }) };
  if (name.endsWith('MessageNotificationsContext')) return {
    useMessageNotifications: () => ({ unreadCount, setSelectedChatId: (id) => { selectedChatId = id; } }),
  };
  return require(name);
};
new Function('require', 'module', 'exports', compiled)(dependencies, compiledModule, compiledModule.exports);
const { Navigation } = compiledModule.exports;
const render = (count) => {
  unreadCount = count;
  return renderToStaticMarkup(React.createElement(Navigation));
};

test('unread badge belongs to the existing white message icon in the bottom menu', () => {
  const html = render(3);
  assert.match(html, /class="mobileIcon">💬<span class="mobileMessageBadge"[^>]*>3<\/span>/);
  assert.match(html, /aria-label="Сообщения: 3 непрочитанных"/);
  assert.doesNotMatch(html, /<button/);
});

test('zero unread messages hides the badge; large counts use 99+', () => {
  assert.doesNotMatch(render(0), /class="mobileMessageBadge"/);
  assert.match(render(105), /class="mobileMessageBadge"[^>]*>99\+<\/span>/);
});

test('both existing message links open the list instead of retaining the previous dialog', () => {
  const links = [];
  const walk = (node) => {
    if (!React.isValidElement(node)) return;
    if (node.type === TestLink && node.props.href === '/messages') links.push(node);
    React.Children.forEach(node.props.children, walk);
  };
  walk(Navigation());
  assert.equal(links.length, 2);
  for (const link of links) {
    selectedChatId = 'previous-chat';
    link.props.onClick();
    assert.equal(selectedChatId, null);
  }
});

if (process.argv.includes('--preview')) {
  const globalCss = await readFile(new URL('../src/app/globals.css', import.meta.url), 'utf8');
  await writeFile(new URL('../.next/white-message-preview.html', import.meta.url),
    `<!doctype html><html lang="ru"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Melo — нижнее меню</title><style>${globalCss}\n${css}</style><body>${render(3)}<main style="padding:24px"><h1>Melo</h1><p style="margin-top:12px;color:var(--text-muted)">Пример: 3 непрочитанных сообщения</p></main></body></html>`);
}
