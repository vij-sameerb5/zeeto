import { ArrowRightLeft, Copy, Droplets, ExternalLink, LogIn, LogOut, QrCode, Store } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Modal, Pressable, ScrollView, Share, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CHAINS, RAILS, VENDORS, ago, mockPayments, short, type Balance, type Quote } from '@zeeto/core';
import { findVendor } from '../vendors';
import { useNav } from '../nav';
import { readBalances, useSession } from '../session';
import { WEB_URL, openWeb } from '../web';
import { useApp } from '../store';
import { C, mono } from '../theme';
import { Btn, Label, Sim, s as ui } from '../ui';

export default function Wallet() {
  const nav = useNav();
  const top = useSafeAreaInsets().top;
  const orders = useApp((x) => x.orders).filter((o) => o.payment);
  const me = useSession();
  const [bal, setBal] = useState<Balance[] | null>(null);
  const [err, setErr] = useState('');
  const [swap, setSwap] = useState(false);
  const [linking, setLinking] = useState(false);

  const load = () => {
    setBal(null); setErr('');
    if (me.address) {
      readBalances(me.address).then(
        (b) => setBal([{ token: 'USDT', amount: b.usdt, network: CHAINS.whitechain.name }, { token: 'WBT', amount: b.wbt, network: `${CHAINS.whitechain.name} · gas` }]),
        () => { setErr('Couldn’t reach Whitechain. Pull to retry.'); setBal([]); },
      );
    } else mockPayments.balances().then(setBal);
  };
  useEffect(load, [me.address]);

  const signIn = async () => {
    setLinking(true);
    const r = await me.link().catch(() => 'cancel' as const);
    setLinking(false);
    if (r === 'no-web') Alert.alert('Web link not set', 'Add EXPO_PUBLIC_WEB_URL to apps/mobile/.env and restart Expo.');
  };

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ paddingTop: top + 12, paddingHorizontal: 16, paddingBottom: 32, gap: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <Label>Testnet only · no real money</Label>
          <Text style={{ color: C.chalk, fontSize: 28, fontWeight: '800', letterSpacing: -0.8, marginTop: 4 }}>Wallet</Text>
        </View>
        {me.address
          ? <View style={{ borderRadius: 12, backgroundColor: C.goodSoft, paddingHorizontal: 8, paddingVertical: 3 }}><Text style={{ color: C.good, fontFamily: mono, fontSize: 10 }}>LIVE · {CHAINS.whitechain.id}</Text></View>
          : <Sim />}
      </View>

      <View style={[ui.card, { gap: 12 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: C.mute }}>{me.label ?? 'Your wallet'}</Text>
          {me.address && <Pressable onPress={() => { me.unlink(); me.setStartAs(null); nav.reset({ name: 'welcome' }); }} hitSlop={8} style={{ flexDirection: 'row', gap: 4, alignItems: 'center' }}><LogOut size={13} color={C.mute} /><Text style={{ color: C.mute, fontSize: 12 }}>Sign out</Text></Pressable>}
        </View>
        {me.address ? (
          <Pressable onPress={() => Share.share({ message: me.address! })} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ color: C.chalk, fontFamily: mono, fontSize: 16 }}>{short(me.address)}</Text>
            <Copy size={15} color={C.mute} />
          </Pressable>
        ) : (
          <Btn title={linking ? 'Opening…' : 'Sign in with phone or email'} onPress={signIn} disabled={linking} right={<LogIn size={16} color={C.ink} />} />
        )}
        {!!err && <Text style={{ color: C.hot }}>{err}</Text>}
        <View style={{ height: 1, backgroundColor: C.line }} />
        {!bal ? <ActivityIndicator color={C.z} /> : bal.map((b) => (
          <View key={b.token + b.network} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: C.chalk, fontWeight: '700' }}>{b.token}</Text>
              <Text style={{ color: C.dim, fontSize: 12 }}>{b.network}</Text>
            </View>
            <Text style={{ color: C.chalk, fontWeight: '700', fontFamily: mono }}>{b.amount.toFixed(b.token === 'ETH' || b.token === 'WBT' ? 4 : 2)}</Text>
          </View>
        ))}
        {!!me.address && <Text style={{ color: C.dim, fontSize: 12, lineHeight: 17 }}>Have test USDT in MetaMask? On Whitechain Testnet (1874), send it to the address above (tap to share/copy). Paying stalls is gas-free, so no WBT needed.</Text>}
        {!me.address && <Text style={{ color: C.dim, fontSize: 12, lineHeight: 17 }}>Demo balances. Sign in to see your real Whitechain wallet. Made for you at sign-in, no seed phrase.</Text>}
      </View>

      <Btn title="Scan a stall’s QR to pay" onPress={() => nav.push({ name: 'scan' })} right={<QrCode size={17} color={C.ink} />} />
      <Btn title="Swap ETH → USDC with Uniswap" kind="line" onPress={() => setSwap(true)} right={<ArrowRightLeft size={16} color={C.chalk} />} />
      <Btn title="Get test WBT from the faucet" kind="line" onPress={() => Linking.openURL(CHAINS.whitechain.faucet)} right={<Droplets size={16} color={C.chalk} />} />
      {!!WEB_URL && <Btn title="Open my own stall" kind="line" onPress={() => openWeb('/sell/join')} right={<Store size={16} color={C.chalk} />} />}

      <Label>Payments</Label>
      {!orders.length && <Text style={{ color: C.mute }}>No payments yet.</Text>}
      {orders.map((o) => {
        const v = findVendor(o.vendorId);
        const p = o.payment!;
        return (
          <Pressable key={o.id} onPress={() => nav.push({ name: 'order', id: o.id })} style={[ui.card, { gap: 4 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ color: C.chalk, fontWeight: '700', flex: 1 }} numberOfLines={1}>{v?.name ?? o.vendorId}</Text>
              <Text style={{ color: C.chalk, fontWeight: '700' }}>−{p.paidAmount.toFixed(p.paidToken === 'ETH' ? 5 : 2)} {p.paidToken}</Text>
            </View>
            <Text style={{ color: C.mute, fontSize: 12 }}>{RAILS[p.rail].network} · {ago(p.at)}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: C.dim, fontFamily: mono, fontSize: 12 }}>tx {short(p.tx)}{p.simulated ? ' · simulated' : ''}</Text>
              {!p.simulated && <ExternalLink size={12} color={C.dim} />}
            </View>
          </Pressable>
        );
      })}
      <SwapSheet open={swap} onClose={() => setSwap(false)} />
    </ScrollView>
  );
}

/** Uniswap ETH → USDC top-up. Quote is simulated until the Uniswap API key is added. */
function SwapSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [usdc, setUsdc] = useState('10');
  const [q, setQ] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const n = Number(usdc);
  const valid = n >= 1 && n <= 500;
  useEffect(() => {
    if (!open || !valid) { setQ(null); return; }
    let on = true;
    const t = setTimeout(() => mockPayments.quote(n).then((r) => on && setQ(r)), 250);
    return () => { on = false; clearTimeout(t); };
  }, [open, n, valid]);
  const go = async () => {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 900));
    setBusy(false);
    onClose();
    Alert.alert('Swapped (simulated)', `${q!.ethIn.toFixed(5)} ETH → ${n.toFixed(2)} USDC`);
  };
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <View style={{ backgroundColor: C.panel, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36, gap: 14, borderWidth: 1, borderColor: C.line }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: C.chalk, fontSize: 20, fontWeight: '800' }}>Swap with Uniswap</Text>
            <Sim />
          </View>
          <Label>You get (USDC)</Label>
          <TextInput value={usdc} onChangeText={(t) => setUsdc(t.replace(/[^0-9.]/g, '').slice(0, 6))} keyboardType="decimal-pad" style={{ color: C.chalk, fontSize: 26, fontWeight: '800', borderWidth: 1, borderColor: C.line2, borderRadius: 16, paddingHorizontal: 14, height: 56, backgroundColor: C.raised }} />
          {!valid && <Text style={{ color: C.hot }}>Swap between 1 and 500 USDC.</Text>}
          {valid && (
            <View style={{ backgroundColor: C.raised, borderRadius: 16, padding: 14, gap: 6 }}>
              {q ? (
                <>
                  <Row l="You pay" r={`${q.ethIn.toFixed(5)} ETH`} />
                  <Row l="Route" r={q.route} />
                  <Row l="Price impact · gas" r={`${q.impactPct}% · $${q.gasUsd.toFixed(2)}`} />
                </>
              ) : <ActivityIndicator color={C.z} />}
            </View>
          )}
          <Btn title={busy ? 'Swapping…' : 'Swap'} disabled={!q || !valid || busy} onPress={go} right={<ArrowRightLeft size={16} color={C.ink} />} />
          <Btn title="Close" kind="line" onPress={onClose} disabled={busy} />
          <Text style={{ color: C.dim, fontSize: 12, textAlign: 'center' }}>Unichain Sepolia. You can also pay any stall in ETH: pick Uniswap in your bag.</Text>
        </View>
      </View>
    </Modal>
  );
}

const Row = ({ l, r }: { l: string; r: string }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
    <Text style={{ color: C.mute, fontSize: 13 }}>{l}</Text>
    <Text style={{ color: C.chalk, fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>{r}</Text>
  </View>
);
