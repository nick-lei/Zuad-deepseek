import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

async function loginTail() {
  let definition: any;
  const registrations: { options: any; component: (props: any) => any }[] = [];
  const source = await readFile(new URL('../client/index.js', import.meta.url), 'utf8');
  runInNewContext(source, { window: { __ModuleLoader__: { load: (value: any) => { definition = value; } } } });
  const module = definition.factory((name: string) => name === 'react'
    ? { createElement: (type: unknown, props: unknown) => ({ type, props }) } : {});
  const ctx: any = {
    effect: (callback: () => unknown) => callback(),
    locale: { register: () => () => {} },
    remote: { $mount: async () => {}, zuadMedia: {} },
    configForms: { get: () => ({}) },
    pluginNavigation: { openBundle: () => {} },
    slots: {
      inject: (_name: string, callback: () => unknown) => callback(),
      register: (options: any, component: (props: any) => any) => { registrations.push({ options, component }); },
    },
    inject: (_keys: string[], callback: (context: unknown) => unknown) => callback(ctx),
  };
  await module.apply(ctx);
  const entry = registrations.find(entry => entry.options.name === 'conversation.chat.turnTail')!;
  return (blocks: any[], turn = 1, status = 'closed') => entry.component({
    turn: { turn, status },
    useChat: (select: (snapshot: unknown) => unknown) => select({
      locations: { getTurn: (requested: number) => requested === 1 ? blocks.map((_block, index) => String(index)) : [] },
      nodes: new Map(blocks.map((block, index) => [String(index), { kind: 'tool-call', data: { root: block } }])),
    }),
  });
}

const result = (name: string, value: unknown, seq = 1, subCalls: any[] = []) => ({
  kind: 'tool-result', call: { name }, seq, content: [{ type: 'text', text: JSON.stringify(value) }], subCalls,
});

test('chat login entry recognizes new and previously recorded signed-out tool results', async () => {
  const render = await loginTail();
  assert.equal(render([result('zuad_query', { ok: false, code: 'AUTH_REQUIRED', reason: 'expired' })]).props.reason, 'expired');
  assert.equal(render([result('zuad_session', { ok: false, error: 'Please sign in to the signage system in the plugin details.' })]).props.reason, 'not_signed_in');
  assert.equal(render([result('zuad_query', { ok: false, error: 'Please enter your account and password in the plugin details.' })]).props.reason, 'not_signed_in');
});

test('chat login entry is scoped to signage failures in the current completed turn', async () => {
  const render = await loginTail();
  assert.equal(render([result('another_tool', { ok: false, code: 'AUTH_REQUIRED' })]), null);
  assert.equal(render([result('zuad_query', { ok: false, error: 'API GET /records returned HTTP 403' })]), null);
  assert.equal(render([result('zuad_query', { ok: false, code: 'AUTH_REQUIRED' })], 2), null);
  assert.equal(render([result('zuad_query', { ok: false, code: 'AUTH_REQUIRED' })], 1, 'open'), null);
  assert.equal(render([result('zuad_query', { ok: false, code: 'AUTH_REQUIRED' }, 1), result('zuad_session', { ok: true, data: {} }, 2)]), null);
});

test('chat login entry recognizes nested PTC calls and ignores malformed tool text', async () => {
  const render = await loginTail();
  const nested = result('ptc', { ok: true }, 3, [result('zuad_query', { ok: false, code: 'AUTH_REQUIRED', reason: 'credentials_rejected' }, 2)]);
  assert.equal(render([nested]).props.reason, 'credentials_rejected');
  assert.equal(render([{ ...result('zuad_query', {}), content: [{ type: 'text', text: 'not JSON' }] }]), null);
});
