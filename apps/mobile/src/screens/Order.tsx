import { BellRing, CheckCircle2, ExternalLink, Navigation, Undo2, WalletCards } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { RAILS, VENDORS, ago, inr, short, UNITS, type OrderStatus } from '@zeeto/core';
import { findVendor } from '../vendors';
import { useApp } from '../store';
import { orderStep, useMyOrders } from '../server';
import { C, mono } from '../theme';
import { Bar, Btn, Face, Label, Sim, s as ui } from '../ui';

export const STATUS: Record<OrderStatus, { label: string; color: string }> = {
  paying: { label: 'Waiting for payment', color: C.warn },
  paid: { label: 'Paid · waiting for stall', color: C.good },
  accepted: { label: 'Accepted · packing', color: C.z },
  ready: { label: 'Ready for pickup', color: C.good },
  done: { label: 'Picked up', color: C.mute },
  refunded: { label: 'Refunded', color: C.mute },
  'part-refunded': { label: 'Part refunded', color: C.mute },
  expired: { label: 'Expired · not paid', color: C.dim },
};

export default function OrderScreen({ id }: { id: string }) {
  const o = useMyOrders().find((y) => y.id === id);
  const localArrived = useApp((x) => x.arrived);
  const localCancel = useApp((x) => x.askCancel);
  // Real orders move on the server (the stall sees it at once); sample-stall orders stay on this phone.
  const step = (a: 'arrived' | 'cancel') => (o?.server ? orderStep(o.id, a).catch((e) => Alert.alert('Couldn’t update', (e as Error).message)) : a === 'arrived' ? localArrived(id) : localCancel(id));
  const arrived = () => step('arrived');
  const askCancel = () => step('cancel');
  const [sure, setSure] = useState(false);
  if (!o) return <View style={{ flex: 1, backgroundColor: C.bg }}><Bar title="Order" /></View>;
  const v = findVendor(o.vendorId)!;
  const st = STATUS[o.status];
  const open = o.status === 'paid' || o.status === 'accepted' || o.status === 'ready';
  const pay = o.payment;

  const directions = () => {
    const { lat, lng } = v.location;
    Linking.openURL(Platform.OS === 'ios' ? `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=w` : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Bar title={`Order ${o.id.toUpperCase()}`} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        <View style={[ui.card, { alignItems: 'center', paddingVertical: 24, gap: 10, borderColor: open ? C.z : C.line }]}>
          {!open && <CheckCircle2 size={34} color={o.status === 'done' ? C.good : C.mute} />}
          <Text style={{ color: st.color, fontWeight: '700' }}>{o.status === 'ready' ? 'Ready · go pick it up' : st.label}</Text>
          {open && <Text style={{ color: C.mute, fontSize: 13 }}>At the stall, say your name and code</Text>}
          {open && <Text style={{ color: C.chalk, fontSize: 18, fontWeight: '700' }}>{o.customer}</Text>}
          <Text style={{ color: open ? C.z : C.mute, fontFamily: mono, fontSize: open ? 46 : 20, fontWeight: '700', letterSpacing: 4 }}>{o.code}</Text>
          {open && <Text style={{ color: C.dim, fontSize: 12, textAlign: 'center' }}>No QR needed. {v.owner.split(' ')[0]} sees the same code on their phone.</Text>}
          {open && !o.cancelAsked && (o.arrivedAt
            ? <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><BellRing size={15} color={C.good} /><Text style={{ color: C.good, fontWeight: '700' }}>{v.owner.split(' ')[0]} knows you’re here</Text></View>
            : <Btn title="I’m at the stall" onPress={() => arrived()} style={{ alignSelf: 'stretch' }} right={<BellRing size={16} color={C.ink} />} />)}
          {o.status === 'paid' && !o.cancelAsked && (sure ? (
            <View style={{ flexDirection: 'row', gap: 8, alignSelf: 'stretch' }}>
              <Btn title="Yes, cancel" kind="line" style={{ flex: 1, height: 44 }} onPress={() => { askCancel(); setSure(false); Alert.alert('Cancel requested', 'The stall refunds you in full.'); }} />
              <Btn title="Keep order" kind="line" style={{ flex: 1, height: 44 }} onPress={() => setSure(false)} />
            </View>
          ) : (
            <Pressable onPress={() => setSure(true)} hitSlop={8}><Text style={{ color: C.mute, textDecorationLine: 'underline' }}>Cancel order</Text></Pressable>
          ))}
          {o.cancelAsked && o.status === 'paid' && <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><Undo2 size={15} color={C.warn} /><Text style={{ color: C.warn }}>Cancel asked · refund on its way</Text></View>}
          {(o.status === 'accepted' || o.status === 'ready') && <Text style={{ color: C.dim, fontSize: 12 }}>Accepted orders can’t be cancelled in the app. Talk to the stall.</Text>}
          {o.points > 0 && <Text style={{ color: C.good, fontSize: 13 }}>+{o.points} points earned</Text>}
        </View>

        <View style={[ui.card, { gap: 12 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Face media={v.avatar} size={42} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.chalk, fontWeight: '700' }}>{v.name}</Text>
              <Text style={{ color: C.mute, fontSize: 13 }}>{v.landmark} · {ago(o.at)}</Text>
            </View>
          </View>
          {o.lines.map((l) => (
            <View key={l.productId} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: C.chalk }}>{l.qty} × {l.name} <Text style={{ color: C.dim }}>/{UNITS[l.unit]}</Text></Text>
              <Text style={{ color: C.chalk }}>{inr(l.qty * l.priceInr)}</Text>
            </View>
          ))}
          <View style={{ height: 1, backgroundColor: C.line }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: C.chalk, fontWeight: '800' }}>Total</Text>
            <Text style={{ color: C.chalk, fontWeight: '800' }}>{inr(o.inr)}</Text>
          </View>
        </View>

        {pay && (
          <View style={[ui.card, { gap: 8 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Label>Payment</Label>
              {pay.simulated && <Sim />}
            </View>
            <Text style={{ color: C.chalk, fontWeight: '700' }}>{pay.paidAmount.toFixed(pay.paidToken === 'ETH' ? 5 : 2)} {pay.paidToken} → {pay.settled.toFixed(2)} {pay.settledToken}</Text>
            <Text style={{ color: C.mute, fontSize: 13 }}>{RAILS[pay.rail].label} · {RAILS[pay.rail].network}</Text>
            {pay.simulated
              ? <Text style={{ color: C.dim, fontFamily: mono, fontSize: 12 }}>tx {short(pay.tx)} · simulated</Text>
              : <Pressable onPress={() => Linking.openURL(RAILS[pay.rail].txUrl(pay.tx))} style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><Text style={{ color: C.z, fontFamily: mono, fontSize: 12 }}>tx {short(pay.tx)}</Text><ExternalLink size={12} color={C.z} /></Pressable>}
            {o.refunds.map((r, i) => <Text key={i} style={{ color: C.warn, fontSize: 13 }}>Refunded {r.amount.toFixed(2)} {r.token}: {r.reason}</Text>)}
          </View>
        )}

        {pay && (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 26, backgroundColor: '#000', borderWidth: 1, borderColor: C.line2, height: 52, opacity: 0.9 }}>
            <WalletCards size={18} color={C.chalk} /><Text style={{ color: C.chalk, fontWeight: '700' }}>Add pass to Apple Wallet</Text>
            <Text style={{ color: C.z, fontFamily: mono, fontSize: 10, backgroundColor: C.zSoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' }}>SOON</Text>
          </View>
        )}
        {open && <Btn title="Walk to the stall" kind="line" onPress={directions} right={<Navigation size={15} color={C.chalk} />} />}
      </ScrollView>
    </View>
  );
}
