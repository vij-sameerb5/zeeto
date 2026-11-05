import { CheckCircle2, Navigation } from 'lucide-react-native';
import { Linking, Platform, ScrollView, Text, View } from 'react-native';
import { RAILS, VENDORS, ago, inr, short, UNITS, type OrderStatus } from '@zeeto/core';
import { useApp } from '../store';
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
};

export default function OrderScreen({ id }: { id: string }) {
  const o = useApp((x) => x.orders.find((y) => y.id === id));
  if (!o) return <View style={{ flex: 1, backgroundColor: C.bg }}><Bar title="Order" /></View>;
  const v = VENDORS.find((x) => x.id === o.vendorId)!;
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
        <View style={[ui.card, { alignItems: 'center', paddingVertical: 26, gap: 10, borderColor: open ? C.z : C.line }]}>
          {o.status === 'paid' && <CheckCircle2 size={34} color={C.z} />}
          <Text style={{ color: st.color, fontWeight: '700' }}>{st.label}</Text>
          {open && <Label>Show this code at the stall</Label>}
          <Text style={{ color: C.chalk, fontFamily: mono, fontSize: 46, fontWeight: '700', letterSpacing: 4 }}>{o.code}</Text>
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
            <Text style={{ color: C.dim, fontFamily: mono, fontSize: 12 }}>tx {short(pay.tx)}</Text>
          </View>
        )}

        {open && <Btn title="Walk to the stall" kind="line" onPress={directions} right={<Navigation size={15} color={C.chalk} />} />}
      </ScrollView>
    </View>
  );
}
