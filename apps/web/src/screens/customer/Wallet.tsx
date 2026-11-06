import { ArrowRightLeft, Copy, Droplets, KeyRound, LogIn, LogOut, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CHAINS, RAILS, ago, mockPayments, short, type Balance, type Hex, type Quote } from '@zeeto/core';
import { createWalletClient, custom } from 'viem';
import { api, feature } from '../../lib/api';
import { readBalances, unichainSepolia } from '../../lib/chain';
import { useSession } from '../../lib/auth';
import { Header, Modal, Sim } from '../../components/kit';
import { TapToPaySoon } from '../../components/Pass';
import { findVendor, useApp } from '../../store';

export default function Wallet() {
  const orders = useApp((s) => s.myOrders.filter((o) => o.payment));
  const say = useApp((s) => s.say);
  const s = useSession();
  const [bal, setBal] = useState<Balance[] | null>(null);
  const [err, setErr] = useState('');
  const live = s.mode === 'privy' && !!s.address;
  const [swap, setSwap] = useState(false);
  useEffect(() => {
    let on = true;
    setBal(null); setErr('');
    if (live) {
      // Real balances from the Whitechain Testnet RPC
      readBalances(s.address!).then((b) => on && setBal([
        { token: 'USDT', amount: b.usdt, network: CHAINS.whitechain.name },
        { token: 'WBT', amount: b.wbt, network: `${CHAINS.whitechain.name} · gas` },
      ]), () => on && setErr('Couldn’t reach Whitechain. Check your connection and refresh.'));
    } else if (s.mode === 'demo') mockPayments.balances().then((b) => on && setBal(b));
    else setBal([]); // signed out with Privy: nothing to show until sign-in
    return () => { on = false; };
  }, [live, s.address, s.mode]);

  return (
    <div>
      <Header title="Wallet" sub="Testnet only · no real money" right={live ? <span className="rounded-full bg-good-soft px-2.5 py-1 font-mono text-[10px] uppercase text-good">Live · chain {CHAINS.whitechain.id}</span> : <Sim />} />
      <div className="gutter mx-auto grid max-w-5xl gap-6 py-6 md:grid-cols-[380px_1fr]">
        <section className="flex flex-col gap-4">
          <div className="relative overflow-hidden rounded-[28px] border border-line bg-gradient-to-br from-raised to-panel p-6">
            <div className="noise pointer-events-none absolute inset-0" />
            <div className="flex items-center justify-between"><div className="label">{s.label ?? 'Your wallet'}</div>{s.authed && <button onClick={s.logout} className="inline-flex items-center gap-1 text-xs text-mute hover:text-chalk"><LogOut size={13} /> Sign out</button>}</div>
            {s.authed && s.address ? (
              <button onClick={() => navigator.clipboard?.writeText(s.address!).then(() => say('Address copied'), () => undefined)} className="mt-3 inline-flex items-center gap-2 font-mono text-lg hover:text-z">{short(s.address)} <Copy size={15} /></button>
            ) : s.authed ? (
              <div className="mt-3 text-sm text-mute">Creating your wallet…</div>
            ) : (
              <button onClick={s.login} className="btn-z mt-4 w-full"><LogIn size={16} /> Sign in with phone or email</button>
            )}
            {err && <p className="mt-3 text-sm text-bad">{err}</p>}
            <div className="mt-6 flex flex-col gap-3">
              {!bal && <div className="h-24 animate-pulse rounded-2xl bg-white/5" />}
              {bal?.map((b) => (
                <div key={b.token + b.network} className="flex items-baseline justify-between">
                  <div><div className="font-bold">{b.token}</div><div className="text-xs text-dim">{b.network}</div></div>
                  <div className="font-mono text-lg nums">{b.amount.toFixed(b.token === 'ETH' || b.token === 'WBT' ? 4 : 2)}</div>
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => setSwap(true)} className="btn-line"><ArrowRightLeft size={16} /> Swap ETH → USDC with Uniswap</button>
          <TapToPaySoon />
          <a href="https://testnet.yetitrade.fi/" target="_blank" rel="noreferrer" className="btn-line"><ArrowRightLeft size={16} /> Get test USDT (swap WBT on YetiTrade)</a>
          <a href={CHAINS.whitechain.faucet} target="_blank" rel="noreferrer" className="btn-line"><Droplets size={16} /> Get test WBT (gas) from the faucet</a>
          <ul className="panel flex flex-col gap-3 p-5 text-sm text-mute">
            <li className="flex gap-2"><KeyRound size={16} className="mt-0.5 shrink-0 text-z" /> Made for you at sign-in (Privy embedded wallet). No seed phrase to lose, no MetaMask.</li>
            <li className="flex gap-2"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-z" /> Zeeto never holds your keys or your money. Payments go straight from you to the stall.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <div className="label">Payments</div>
          {orders.map((o) => {
            const v = findVendor(o.vendorId)!;
            const p = o.payment!;
            return (
              <Link key={o.id} to={`/orders/${o.id}`} className="panel flex items-center justify-between gap-3 p-4 hover:border-line-2">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{v.name}</div>
                  <div className="text-xs text-mute">{RAILS[p.rail].network} · {ago(p.at)}</div>
                  <div className="mt-1 font-mono text-[11px] text-dim">tx {short(p.tx)}{p.simulated ? ' · simulated' : ''}</div>
                </div>
                <div className="text-right font-mono nums">−{p.paidAmount.toFixed(p.paidToken === 'ETH' ? 5 : 2)} {p.paidToken}</div>
              </Link>
            );
          })}
        </section>
      </div>
      <SwapSheet open={swap} onClose={() => setSwap(false)} />
    </div>
  );
}

/**
 * Top up USDC by swapping ETH on Uniswap. With the server's Uniswap key and a signed-in wallet: a real quote from the
 * Uniswap Trading API and a real swap you sign on Unichain Sepolia. Otherwise a sample quote, marked simulated.
 */
function SwapSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const say = useApp((x) => x.say);
  const s = useSession();
  const live = feature('uniswap') && !!s.address;
  const [usdc, setUsdc] = useState('10');
  const [q, setQ] = useState<Quote | null>(null);
  const [raw, setRaw] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const n = Number(usdc);
  const valid = n >= 1 && n <= 500;
  useEffect(() => {
    if (!open || !valid) { setQ(null); return; }
    let on = true;
    setErr('');
    const t = setTimeout(async () => {
      try {
        if (live) {
          const r = await api<{ quote: Quote; raw: unknown }>('/api/uniswap', { body: { action: 'quote', usdcOut: n, swapper: s.address } });
          if (on) { setQ(r.quote); setRaw(r.raw); }
        } else {
          const r = await mockPayments.quote(n);
          if (on) setQ(r);
        }
      } catch (e) { if (on) { setQ(null); setErr((e as Error).message); } }
    }, 350);
    return () => { on = false; clearTimeout(t); };
  }, [open, n, valid, live, s.address]);

  const go = async () => {
    setBusy(true); setErr('');
    try {
      if (live) {
        const { tx } = await api<{ tx: { to: Hex; data: Hex; value: string; chainId: number } }>('/api/uniswap', { body: { action: 'swap', quote: raw } });
        const provider = await s.provider();
        if (!provider) throw new Error('Your wallet isn’t ready yet.');
        const wallet = createWalletClient({ account: s.address!, chain: unichainSepolia, transport: custom(provider) });
        await wallet.switchChain({ id: unichainSepolia.id }).catch(() => undefined);
        const hash = await wallet.sendTransaction({ account: s.address!, chain: unichainSepolia, to: tx.to, data: tx.data, value: BigInt(tx.value) });
        onClose();
        say(`Swap sent on Unichain Sepolia · ${short(hash)}`);
      } else {
        await new Promise((r) => setTimeout(r, 900));
        onClose();
        say(`Swapped ${q!.ethIn.toFixed(5)} ETH → ${n.toFixed(2)} USDC (simulated)`);
      }
    } catch (e) {
      const m = (e as Error).message ?? '';
      setErr(/reject|denied|cancel/i.test(m) ? 'You cancelled the swap.' : m.slice(0, 160));
    } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="Swap with Uniswap">
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="label">You get (USDC)</span>
          <input inputMode="decimal" value={usdc} onChange={(e) => setUsdc(e.target.value.replace(/[^0-9.]/g, '').slice(0, 6))} className="input text-2xl font-bold nums" />
        </label>
        {!valid && <p className="text-sm text-bad">Swap between 1 and 500 USDC.</p>}
        {valid && (
          <div className="rounded-2xl border border-line bg-raised p-4 text-sm">
            {q ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between"><span className="text-mute">You pay</span><b className="nums">{q.ethIn.toFixed(5)} ETH</b></div>
                <div className="flex justify-between"><span className="text-mute">Route</span><span>{q.route}</span></div>
                <div className="flex justify-between"><span className="text-mute">Price impact · gas</span><span className="nums">{q.impactPct}% · ${q.gasUsd.toFixed(2)}</span></div>
              </div>
            ) : err ? <p className="text-bad">{err}</p> : <div className="h-16 animate-pulse rounded-xl bg-white/5" />}
          </div>
        )}
        {q && err && <p className="text-sm text-bad">{err}</p>}
        <button disabled={!q || !valid || busy} onClick={go} className="btn-z"><ArrowRightLeft size={16} /> {busy ? 'Confirm in your wallet…' : 'Swap'}</button>
        <p className="text-center text-xs text-dim">{live ? 'Live quote from the Uniswap Trading API · Unichain Sepolia. Needs a little Sepolia ETH on Unichain.' : 'Sample quote (simulated). Sign in and add the Uniswap API key on the server for live swaps.'} You can also pay any demo stall in ETH: pick Uniswap at checkout.</p>
        {!live && <div className="flex justify-center"><Sim /></div>}
      </div>
    </Modal>
  );
}
