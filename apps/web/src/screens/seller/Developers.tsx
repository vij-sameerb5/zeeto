import { Check, Code2, Copy, KeyRound, Send, Webhook } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../components/kit';
import { api, serverOn } from '../../lib/api';
import { useApp } from '../../store';

interface Dev { stallId: string; keyPrefix: string | null; webhookUrl: string | null; hasWebhookSecret: boolean; deliveries: { event: string; status: number; at: string }[]; gasCovered: { wbt: number; txs: number }; apiKey?: string; webhookSecret?: string }

/** Plug Zeeto Checkout into any website: secret key, webhook, and a copy-paste snippet. */
export default function Developers() {
  const say = useApp((s) => s.say);
  const [d, setD] = useState<Dev | null>(null);
  const [err, setErr] = useState('');
  const [hook, setHook] = useState('');
  const [secret, setSecret] = useState<{ key?: string; whsec?: string }>({});
  const on = serverOn();

  const call = async (action: string, url?: string) => {
    setErr('');
    try {
      const r = await api<Dev>('/api/stalls', { body: { action, url } });
      setD(r);
      setHook(r.webhookUrl ?? '');
      if (r.apiKey || r.webhookSecret) setSecret((s) => ({ key: r.apiKey ?? s.key, whsec: r.webhookSecret ?? s.whsec }));
      return r;
    } catch (e) { setErr((e as Error).message); }
  };
  useEffect(() => { if (on) void call('developer'); }, [on]);

  const copy = (t: string) => navigator.clipboard?.writeText(t).then(() => say('Copied'), () => undefined);
  const origin = location.origin;
  const snippet = `// your backend (keep the key secret)
const s = await fetch('${origin}/api/checkout', {
  method: 'POST',
  headers: { Authorization: 'Bearer ${d?.keyPrefix ?? 'zk_test_'}…', 'Content-Type': 'application/json' },
  body: JSON.stringify({ amountInr: 120, reference: 'order-42', successUrl: 'https://yourshop.com/thanks' }),
}).then((r) => r.json()); // → { id, url }

<!-- your page -->
<script src="${origin}/checkout.js"></script>
<script>Zeeto.open(sessionUrl, { onPaid: () => location.reload() })</script>`;

  if (!on) return (
    <div><Header title="Developers" back="/sell/payments" />
      <div className="gutter mx-auto max-w-2xl py-10 text-center text-mute">Developer tools need the Zeeto server (database + sign-in). See apps/web/.env.example.</div>
    </div>
  );

  return (
    <div>
      <Header title="Developers" sub="Take Zeeto payments on your own website" back="/sell/payments" />
      <div className="gutter mx-auto flex max-w-3xl flex-col gap-5 py-6">
        {err && <p className="rounded-2xl bg-bad-soft p-4 text-sm text-bad">{err}</p>}

        <section className="panel flex flex-col gap-3 p-5">
          <div className="flex items-center gap-2 font-bold"><KeyRound size={18} className="text-z" /> Secret API key</div>
          {secret.key ? (
            <div className="rounded-2xl border border-z/40 bg-z-soft p-3">
              <div className="text-xs text-z">Copy it now. We only store a hash, so you won’t see it again.</div>
              <button onClick={() => copy(secret.key!)} className="mt-1 flex w-full items-center gap-2 break-all text-left font-mono text-sm">{secret.key} <Copy size={14} className="shrink-0" /></button>
            </div>
          ) : <div className="font-mono text-sm text-mute">{d?.keyPrefix ? `${d.keyPrefix}••••••••••••` : 'No key yet'}</div>}
          <button onClick={() => call('rotate-key')} className="btn-line self-start px-4 py-2 text-sm">{d?.keyPrefix ? 'Replace key (old one stops working)' : 'Create API key'}</button>
        </section>

        <section className="panel flex flex-col gap-3 p-5">
          <div className="flex items-center gap-2 font-bold"><Webhook size={18} className="text-z" /> Webhook</div>
          <p className="text-sm text-mute">We POST <code>payment.succeeded</code> and <code>payment.refunded</code>, signed with <code>Zeeto-Signature: t=…,v1=HMAC-SHA256</code>.</p>
          <div className="flex gap-2">
            <input value={hook} onChange={(e) => setHook(e.target.value)} placeholder="https://yourshop.com/webhooks/zeeto" className="input flex-1 text-sm" />
            <button onClick={() => call('set-webhook', hook.trim())} className="btn-z px-4 text-sm"><Check size={16} /> Save</button>
          </div>
          {secret.whsec && (
            <div className="rounded-2xl border border-z/40 bg-z-soft p-3">
              <div className="text-xs text-z">Signing secret, shown once:</div>
              <button onClick={() => copy(secret.whsec!)} className="mt-1 flex w-full items-center gap-2 break-all text-left font-mono text-sm">{secret.whsec} <Copy size={14} className="shrink-0" /></button>
            </div>
          )}
          {d?.webhookUrl && <button onClick={() => call('test-webhook').then((r) => r && say('Test event sent'))} className="btn-line self-start px-4 py-2 text-sm"><Send size={15} /> Send a test event</button>}
          {!!d?.deliveries.length && (
            <ul className="divide-y divide-line rounded-2xl border border-line text-sm">
              {d.deliveries.map((x, i) => <li key={i} className="flex justify-between p-3"><span className="font-mono">{x.event}</span><span className={x.status >= 200 && x.status < 300 ? 'text-good' : 'text-bad'}>{x.status || 'failed'} · {new Date(x.at).toLocaleTimeString('en-IN')}</span></li>)}
            </ul>
          )}
        </section>

        <section className="panel flex flex-col gap-3 p-5">
          <div className="flex items-center gap-2 font-bold"><Code2 size={18} className="text-z" /> Add it to your site</div>
          <pre className="overflow-x-auto rounded-2xl bg-bg p-4 text-xs leading-relaxed text-mute"><code>{snippet}</code></pre>
          <button onClick={() => copy(snippet)} className="btn-line self-start px-4 py-2 text-sm"><Copy size={15} /> Copy</button>
          <p className="text-xs text-dim">A full example store is in <code>examples/store</code> of the Zeeto repo.</p>
        </section>

        <section className="panel flex items-center justify-between gap-3 p-5 text-sm">
          <div><div className="font-bold">Network fees Zeeto covered for you</div><div className="text-mute">Your customers never pay gas. This is what your payments and refunds cost on the network.</div></div>
          <div className="text-right font-mono nums">{(d?.gasCovered.wbt ?? 0).toFixed(6)} WBT<div className="text-xs text-dim">{d?.gasCovered.txs ?? 0} txs</div></div>
        </section>
        <Link to="/sell/payments" className="text-center text-sm text-z">Back to payments</Link>
      </div>
    </div>
  );
}
