import { Copy, ExternalLink } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ME, RAILS, VENDORS, ago, mockPayments, short, type Balance } from '@zeeto/core';
import { useNav } from '../nav';
import { WEB_URL, openWeb } from '../web';
import { useApp } from '../store';
import { C, mono } from '../theme';
import { Btn, Label, Sim, s as ui } from '../ui';

export default function Wallet() {
  const nav = useNav();
  const top = useSafeAreaInsets().top;
  const orders = useApp((x) => x.orders).filter((o) => o.payment);
  const [bal, setBal] = useState<Balance[] | null>(null);
  useEffect(() => { mockPayments.balances().then(setBal); }, []);

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ paddingTop: top + 12, paddingHorizontal: 16, paddingBottom: 32, gap: 16 }}>
      <View>
        <Label>Testnet wallet</Label>
        <Text style={{ color: C.chalk, fontSize: 28, fontWeight: '800', letterSpacing: -0.8, marginTop: 4 }}>Wallet</Text>
      </View>

      <View style={[ui.card, { gap: 10 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: C.mute }}>{ME.name}'s embedded wallet</Text>
          <Sim />
        </View>
        <Pressable onPress={() => Share.share({ message: ME.wallet })} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: C.chalk, fontFamily: mono, fontSize: 15 }}>{short(ME.wallet)}</Text>
          <Copy size={15} color={C.mute} />
        </Pressable>
        <Text style={{ color: C.dim, fontSize: 12, lineHeight: 17 }}>Created at sign-in, no seed phrase. Real wallets arrive with Privy login.</Text>
      </View>

      <Label>Balances</Label>
      <View style={[ui.card, { gap: 14 }]}>
        {!bal ? <ActivityIndicator color={C.z} /> : bal.map((b) => (
          <View key={b.token + b.network} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: C.chalk, fontWeight: '700' }}>{b.token}</Text>
              <Text style={{ color: C.dim, fontSize: 12 }}>{b.network}</Text>
            </View>
            <Text style={{ color: C.chalk, fontWeight: '700', fontFamily: mono }}>{b.amount.toFixed(b.token === 'ETH' ? 4 : 2)}</Text>
          </View>
        ))}
      </View>

      <Btn title="Scan a stall’s QR to pay" onPress={() => nav.push({ name: 'scan' })} />
      {!!WEB_URL && <Btn title="Sign in · real wallet" kind="line" onPress={() => openWeb('/wallet')} />}
      <Btn title="Get test USDT" kind="line" onPress={() => Alert.alert('Faucet', 'Testnet USDT comes from the Whitechain faucet. This button gets wired when the checkout contract is deployed.')} />

      <Label>Payments</Label>
      {orders.map((o) => {
        const v = VENDORS.find((x) => x.id === o.vendorId)!;
        const p = o.payment!;
        return (
          <Pressable key={o.id} onPress={() => nav.push({ name: 'order', id: o.id })} style={[ui.card, { gap: 4 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: C.chalk, fontWeight: '700' }}>{v.name}</Text>
              <Text style={{ color: C.chalk, fontWeight: '700' }}>−{p.paidAmount.toFixed(p.paidToken === 'ETH' ? 5 : 2)} {p.paidToken}</Text>
            </View>
            <Text style={{ color: C.mute, fontSize: 12 }}>{RAILS[p.rail].network} · {ago(p.at)}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: C.dim, fontFamily: mono, fontSize: 12 }}>tx {short(p.tx)}</Text>
              <ExternalLink size={12} color={C.dim} />
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
