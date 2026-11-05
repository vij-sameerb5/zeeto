import { ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FX, RAILS, VENDORS, inr, mockPayments, pointsFor, toUsd, UNITS } from '@zeeto/core';
import { useNav } from '../nav';
import { useApp, useBagTotal } from '../store';
import { C, mono } from '../theme';
import { Bar, Btn, Face, Label, Pic, Qty, Sim, s as ui } from '../ui';

export default function Bag() {
  const nav = useNav();
  const bottom = useSafeAreaInsets().bottom;
  const bag = useApp((x) => x.bag);
  const setQty = useApp((x) => x.setQty);
  const checkout = useApp((x) => x.checkout);
  const paid = useApp((x) => x.paid);
  const total = useBagTotal();
  const [step, setStep] = useState<'idle' | 'paying'>('idle');
  const v = VENDORS.find((x) => x.id === bag.vendorId);
  const rail = RAILS['streetpay-usdt'];
  const products = useApp((x) => x.products);
  const lines = Object.entries(bag.lines).map(([id, n]) => ({ p: products.find((x) => x.id === id)!, n })).filter((l) => l.p);

  const pay = async () => {
    const order = checkout();
    if (!order) return;
    setStep('paying');
    try {
      // Mock today. Next: Privy embedded wallet signs approve + pay on StreetPayCheckout, API verifies the Paid event.
      const payment = await mockPayments.payStreetPay(order);
      paid(order.id, payment);
      nav.reset({ name: 'tabs' }, { name: 'order', id: order.id });
    } catch {
      setStep('idle');
    }
  };

  if (!v) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <Bar title="Your bag" />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
          <Text style={{ color: C.chalk, fontSize: 20, fontWeight: '700' }}>Your bag is empty</Text>
          <Text style={{ color: C.mute, textAlign: 'center' }}>Open a stall and tap Add on anything you like.</Text>
          <Btn title="Back to the market" onPress={() => nav.reset({ name: 'tabs' })} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Bar title="Your bag" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 140 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Face media={v.avatar} size={44} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.chalk, fontWeight: '700', fontSize: 16 }}>{v.name}</Text>
            <Text style={{ color: C.mute, fontSize: 13 }}>Pickup at {v.landmark}</Text>
          </View>
        </View>

        <View style={[ui.card, { gap: 14 }]}>
          {lines.map(({ p, n }) => (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pic media={p.image} style={{ width: 52, height: 52, borderRadius: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.chalk, fontWeight: '600' }} numberOfLines={1}>{p.name}</Text>
                <Text style={{ color: C.mute, fontSize: 12 }}>{inr(p.priceInr)} /{UNITS[p.unit]}</Text>
              </View>
              <Qty n={n} onChange={(k) => setQty(v.id, p.id, Math.min(k, p.stock))} />
            </View>
          ))}
        </View>

        <View style={[ui.card, { gap: 10 }]}>
          <Row l="Items" r={inr(total)} />
          <Row l="Pickup" r="Free" />
          <View style={{ height: 1, backgroundColor: C.line }} />
          <Row l="Total" r={inr(total)} big />
          <Row l={`You pay (₹${FX.inrPerUsd} = $1, demo rate)`} r={`${toUsd(total).toFixed(2)} USDT`} />
          <Text style={{ color: C.good, fontSize: 13, marginTop: 2 }}>+{pointsFor(total)} points when you pay</Text>
        </View>

        <View style={[ui.card, { borderColor: C.z, gap: 8 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Label style={{ color: C.z }}>Pay with</Label>
            <Sim />
          </View>
          <Text style={{ color: C.chalk, fontWeight: '700', fontSize: 16 }}>{rail.label}</Text>
          <Text style={{ color: C.mute, fontSize: 13, lineHeight: 19 }}>{rail.blurb}</Text>
          <Text style={{ color: C.dim, fontFamily: mono, fontSize: 11 }}>{rail.network} · chain {rail.chainId}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <ShieldCheck size={16} color={C.mute} />
          <Text style={{ color: C.mute, fontSize: 12, flex: 1 }}>The stall only sees your order after the payment is confirmed on-chain.</Text>
        </View>
      </ScrollView>

      <View style={[st.foot, { paddingBottom: Math.max(bottom, 14) }]}>
        <Btn
          title={step === 'paying' ? 'Confirming payment…' : `Pay ${toUsd(total).toFixed(2)} USDT`}
          disabled={step === 'paying' || !lines.length}
          onPress={pay}
          right={step === 'paying' ? <ActivityIndicator color={C.ink} /> : undefined}
        />
      </View>
    </View>
  );
}

const Row = ({ l, r, big }: { l: string; r: string; big?: boolean }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
    <Text style={{ color: big ? C.chalk : C.mute, fontSize: big ? 17 : 14, fontWeight: big ? '800' : '400', flexShrink: 1 }}>{l}</Text>
    <Text style={{ color: C.chalk, fontSize: big ? 17 : 14, fontWeight: big ? '800' : '600' }}>{r}</Text>
  </View>
);

const st = StyleSheet.create({
  foot: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 12, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.line },
});
