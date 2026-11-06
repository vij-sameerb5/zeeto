import { BarChart3, BellRing, Check, ExternalLink, MessageCircle, Minus, PackageCheck, Plus, QrCode, Undo2 } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { ago, customerVisits, inr, tierFor, UNITS, type Order, type OrderStatus, type Product } from '@zeeto/core';
import { loadServer, orderStep, saveProducts, useServer } from '../server';
import { loadRemote, useRemote } from '../vendors';
import { C, mono } from '../theme';
import { Bar, Btn, Face, Label, Pic, s as ui } from '../ui';
import { STATUS } from './Order';
import { WEB_URL, openWeb } from '../web';

type Seg = 'orders' | 'stock' | 'qr' | 'stats';
const GROUPS: [string, OrderStatus[]][] = [['New', ['paid']], ['Packing', ['accepted', 'ready']], ['Done', ['done', 'refunded', 'part-refunded']]];
const COUNTED: OrderStatus[] = ['paid', 'accepted', 'ready', 'done', 'part-refunded'];

/**
 * Your real stall, on the phone. Same server, same rules as the web dashboard: accept → packed → hand over,
 * stock and prices, your QR, today's numbers. Refunds move money, so they open the web where your wallet signs.
 */
export default function MyStall({ stallId }: { stallId: string }) {
  const orders = useServer((s) => s.stall);
  const v = useRemote((s) => s.vendors.find((x) => x.id === stallId));
  const [seg, setSeg] = useState<Seg>('orders');
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => { setRefreshing(true); await Promise.all([loadServer(), loadRemote()]); setRefreshing(false); };

  const today = orders.filter((o) => COUNTED.includes(o.status) && Date.now() - Date.parse(o.at) < 864e5);
  const open = orders.filter((o) => ['paid', 'accepted', 'ready'].includes(o.status)).length;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Bar title="My stall" right={<View style={st.live}><Text style={{ color: C.good, fontFamily: mono, fontSize: 10 }}>LIVE</Text></View>} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={C.z} />}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {v && <Face media={v.avatar} size={52} ring />}
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.chalk, fontWeight: '800', fontSize: 18 }} numberOfLines={1}>{v?.name ?? stallId}</Text>
            <Text style={{ color: C.mute, fontSize: 13 }} numberOfLines={1}>{v?.landmark ?? 'Your Zeeto stall'} · payouts to your wallet</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Metric label="Today" value={inr(today.reduce((a, o) => a + o.inr, 0))} />
          <Metric label="Orders today" value={String(today.length)} />
          <Metric label="Open" value={String(open)} hot={open > 0} />
        </View>

        <View style={st.seg}>
          {([['orders', 'Orders'], ['stock', 'Stock'], ['qr', 'QR'], ['stats', 'Stats']] as [Seg, string][]).map(([id, l]) => (
            <Pressable key={id} onPress={() => setSeg(id)} style={[st.segB, seg === id && { backgroundColor: C.chalk }]}>
              <Text style={{ color: seg === id ? C.ink : C.mute, fontWeight: '700', fontSize: 13 }}>{l}</Text>
            </Pressable>
          ))}
        </View>

        {seg === 'orders' && <Orders orders={orders} />}
        {seg === 'stock' && <Stock stallId={stallId} />}
        {seg === 'qr' && <Qr stallId={stallId} name={v?.name ?? ''} />}
        {seg === 'stats' && <Stats orders={orders} />}

        <Btn title="Full dashboard, AI and refunds (web)" kind="line" onPress={() => openWeb('/sell')} right={<ExternalLink size={15} color={C.chalk} />} />
        <Btn title="Run your stall from WhatsApp" kind="line" onPress={() => openWeb('/sell/whatsapp')} right={<MessageCircle size={15} color={C.chalk} />} />
      </ScrollView>
    </View>
  );
}

const Metric = ({ label, value, hot }: { label: string; value: string; hot?: boolean }) => (
  <View style={[ui.card, { flex: 1, gap: 4, padding: 12 }, hot && { borderColor: C.z }]}>
    <Label>{label}</Label>
    <Text style={{ color: hot ? C.z : C.chalk, fontSize: 20, fontWeight: '800' }} numberOfLines={1}>{value}</Text>
  </View>
);

function Orders({ orders }: { orders: Order[] }) {
  const [g, setG] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const shown = orders.filter((o) => GROUPS[g][1].includes(o.status));
  const act = async (o: Order, a: 'accept' | 'packed' | 'handover') => {
    setBusy(o.id);
    try { await orderStep(o.id, a); } catch (e) { Alert.alert('Couldn’t update', (e as Error).message); } finally { setBusy(null); }
  };
  const handover = (o: Order) => Alert.alert(`Hand over to ${o.customer}?`, `Check they say code ${o.code}.`, [{ text: 'Not yet', style: 'cancel' }, { text: 'Handed over', onPress: () => act(o, 'handover') }]);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {GROUPS.map(([l, sts], i) => {
          const n = orders.filter((o) => sts.includes(o.status)).length;
          return <Pressable key={l} onPress={() => setG(i)} style={[st.chip, g === i && { backgroundColor: C.chalk, borderColor: C.chalk }]}><Text style={{ color: g === i ? C.ink : C.mute, fontWeight: '700', fontSize: 13 }}>{l}{n ? ` (${n})` : ''}</Text></Pressable>;
        })}
      </View>
      {!shown.length && <Text style={{ color: C.mute, textAlign: 'center', paddingVertical: 20 }}>{g === 0 ? 'New paid orders land here. Pull down to refresh.' : 'Nothing here yet.'}</Text>}
      {shown.map((o) => {
        const s = STATUS[o.status];
        const n = o.visits ?? customerVisits(orders, o);
        return (
          <View key={o.id} style={[ui.card, { gap: 10 }, o.status === 'paid' && { borderColor: C.z }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ color: C.chalk, fontWeight: '700', flex: 1 }} numberOfLines={1}>{o.customer}</Text>
              <Text style={{ color: C.chalk, fontWeight: '800' }}>{inr(o.inr)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={{ color: s.color, fontSize: 13 }}>{s.label} · {ago(o.at)}</Text>
              <Text style={{ color: C.z, fontFamily: mono, fontSize: 13, fontWeight: '700' }}>{o.code}</Text>
              {n > 0 && <Text style={{ color: C.mute, fontSize: 12 }}>· {tierFor(n).name}, visit {n}</Text>}
            </View>
            <View style={{ backgroundColor: C.raised, borderRadius: 14, padding: 10, gap: 2 }}>
              {o.lines.map((l) => <Text key={l.productId} style={{ color: C.chalk }}><Text style={{ fontWeight: '700' }}>{l.qty} {UNITS[l.unit as keyof typeof UNITS] ?? ''}</Text> {l.name}</Text>)}
            </View>
            {o.payment && <Text style={{ color: C.dim, fontFamily: mono, fontSize: 11 }}>{o.payment.settled.toFixed(2)} USDT received{o.payment.gasless ? ' · gas paid by Zeeto' : ''}</Text>}
            {o.cancelAsked && o.status === 'paid' && <Row color={C.warn} icon={<Undo2 size={15} color={C.warn} />} text={`${o.customer} asked to cancel. Refund it on the web.`} />}
            {o.arrivedAt && ['paid', 'accepted', 'ready'].includes(o.status) && <Row color={C.z} icon={<BellRing size={15} color={C.z} />} text={`${o.customer} is at the stall · ${ago(o.arrivedAt)}`} />}
            {busy === o.id ? <ActivityIndicator color={C.z} /> : (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {o.status === 'paid' && !o.cancelAsked && <Btn title="Accept" style={{ flex: 1, height: 44 }} onPress={() => act(o, 'accept')} right={<Check size={16} color={C.ink} />} />}
                {o.status === 'accepted' && <Btn title="Packed · tell them" style={{ flex: 1, height: 44 }} onPress={() => act(o, 'packed')} right={<PackageCheck size={16} color={C.ink} />} />}
                {(o.status === 'ready' || o.status === 'accepted') && <Btn title="Hand over" kind={o.status === 'ready' ? 'z' : 'line'} style={{ flex: 1, height: 44 }} onPress={() => handover(o)} />}
                {['paid', 'accepted', 'ready', 'done', 'part-refunded'].includes(o.status) && <Btn title="Refund" kind="line" style={{ height: 44, paddingHorizontal: 14 }} onPress={() => openWeb('/sell/orders')} />}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const Row = ({ color, icon, text }: { color: string; icon: React.ReactNode; text: string }) => (
  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: C.raised, borderRadius: 12, padding: 10 }}>{icon}<Text style={{ color, flex: 1, fontSize: 13 }}>{text}</Text></View>
);

/** Price and stock for your real products. Saves the whole list to the server (the same list the website edits). */
function Stock({ stallId }: { stallId: string }) {
  const all = useRemote((s) => s.products);
  const products = useMemo(() => all.filter((p) => p.vendorId === stallId), [all, stallId]);
  const [saving, setSaving] = useState(false);
  const save = async (next: Product[]) => {
    setSaving(true);
    try {
      const fresh = await saveProducts(stallId, next);
      useRemote.setState((s) => ({ products: [...fresh, ...s.products.filter((p) => p.vendorId !== stallId)] }));
    } catch (e) { Alert.alert('Couldn’t save', (e as Error).message); } finally { setSaving(false); }
  };
  const patch = (id: string, f: Partial<Product>) => save(products.map((p) => (p.id === id ? { ...p, ...f } : p)));

  if (!products.length) return (
    <View style={[ui.card, { gap: 10, alignItems: 'center' }]}>
      <Text style={{ color: C.chalk, fontWeight: '700' }}>No products yet</Text>
      <Text style={{ color: C.mute, textAlign: 'center' }}>Add them on the web with Snap & Sell, or send a photo to Zeeto on WhatsApp.</Text>
      <Btn title="Add products" onPress={() => openWeb('/sell/products?snap=1')} />
    </View>
  );
  return (
    <View style={{ gap: 10 }}>
      {saving && <Text style={{ color: C.mute, fontSize: 12 }}>Saving…</Text>}
      {products.map((p) => (
        <View key={p.id} style={[ui.card, { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 }, p.stock <= 0 && { opacity: 0.7 }]}>
          <Pic media={p.image} style={{ width: 48, height: 48, borderRadius: 12 }} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: C.chalk, fontWeight: '700' }} numberOfLines={1}>{p.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: C.mute }}>₹</Text>
              <TextInput defaultValue={String(p.priceInr)} keyboardType="number-pad" onEndEditing={(e) => { const n = Math.round(Number(e.nativeEvent.text)); if (n >= 1 && n <= 100000 && n !== p.priceInr) void patch(p.id, { priceInr: n }); }} style={st.price} />
              <Text style={{ color: C.dim, fontSize: 12 }}>/{UNITS[p.unit]}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: C.line2, borderRadius: 18 }}>
            <Pressable onPress={() => patch(p.id, { stock: Math.max(0, p.stock - 1) })} hitSlop={6} style={st.step}><Minus size={14} color={C.chalk} /></Pressable>
            <Text style={{ color: C.chalk, fontWeight: '800', minWidth: 26, textAlign: 'center' }}>{p.stock}</Text>
            <Pressable onPress={() => patch(p.id, { stock: Math.min(10000, p.stock + 1) })} hitSlop={6} style={st.step}><Plus size={14} color={C.chalk} /></Pressable>
          </View>
        </View>
      ))}
      <Btn title="Edit names, photos, add more (web)" kind="line" onPress={() => openWeb('/sell/products')} />
    </View>
  );
}

function Qr({ stallId, name }: { stallId: string; name: string }) {
  const url = `${WEB_URL}/p/${stallId}`;
  return (
    <View style={[ui.card, { alignItems: 'center', gap: 12 }]}>
      <View style={{ backgroundColor: C.chalk, padding: 12, borderRadius: 20 }}><QRCode value={url} size={200} backgroundColor={C.chalk} color="#0A0A0A" /></View>
      <Text style={{ color: C.chalk, fontWeight: '700' }}>{name}</Text>
      <Text style={{ color: C.mute, textAlign: 'center' }}>Customers scan, type the amount and pay in USDT. No gas fee. It lands in your wallet.</Text>
      <View style={{ flexDirection: 'row', gap: 8, alignSelf: 'stretch' }}>
        <Btn title="Share link" kind="line" style={{ flex: 1 }} onPress={() => Share.share({ message: `Pay ${name} on Zeeto: ${url}` })} />
        <Btn title="Bill an amount" style={{ flex: 1 }} onPress={() => openWeb('/sell/collect')} right={<QrCode size={16} color={C.ink} />} />
      </View>
    </View>
  );
}

function Stats({ orders }: { orders: Order[] }) {
  const paid = orders.filter((o) => COUNTED.includes(o.status));
  const days = Array.from({ length: 7 }, (_, i) => {
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - (6 - i));
    const end = start.getTime() + 864e5;
    return { label: start.toLocaleDateString('en-IN', { weekday: 'short' }), inr: paid.filter((o) => { const t = Date.parse(o.at); return t >= start.getTime() && t < end; }).reduce((a, o) => a + o.inr, 0) };
  });
  const max = Math.max(1, ...days.map((d) => d.inr));
  const people = new Map<string, number>(); paid.forEach((o) => people.set(o.customer, (people.get(o.customer) ?? 0) + 1));
  const items = new Map<string, number>(); paid.forEach((o) => o.lines.forEach((l) => items.set(l.name, (items.get(l.name) ?? 0) + l.qty * l.priceInr)));
  const top = [...items.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const usdt = paid.reduce((a, o) => a + (o.payment?.settled ?? 0), 0);
  return (
    <View style={{ gap: 12 }}>
      <View style={[ui.card, { gap: 10 }]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Label>Last 7 days</Label><BarChart3 size={15} color={C.z} /></View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 90 }}>
          {days.map((d, i) => <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}><View style={{ width: '100%', height: Math.max(4, (d.inr / max) * 70), borderRadius: 6, backgroundColor: i === 6 ? C.z : C.raised }} /><Text style={{ color: C.dim, fontSize: 10 }}>{i === 6 ? 'Today' : d.label}</Text></View>)}
        </View>
        <Text style={{ color: C.mute, fontSize: 13 }}>{inr(days.reduce((a, d) => a + d.inr, 0))} this week · {usdt.toFixed(2)} USDT received in total</Text>
      </View>
      <View style={[ui.card, { gap: 8 }]}>
        <Label>Best sellers</Label>
        {top.length ? top.map(([n, v]) => <View key={n} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: C.chalk }}>{n}</Text><Text style={{ color: C.mute }}>{inr(v)}</Text></View>) : <Text style={{ color: C.mute }}>Shows after your first orders.</Text>}
      </View>
      <View style={[ui.card, { gap: 8 }]}>
        <Label>Customers</Label>
        <Text style={{ color: C.chalk }}>{people.size} customers · {[...people.values()].filter((n) => n > 1).length} came back</Text>
      </View>
      <Btn title="Ask Zeeto AI about your sales (web)" kind="line" onPress={() => openWeb('/sell')} />
    </View>
  );
}

const st = StyleSheet.create({
  live: { borderRadius: 12, backgroundColor: C.goodSoft, paddingHorizontal: 8, paddingVertical: 3 },
  seg: { flexDirection: 'row', backgroundColor: C.raised, borderRadius: 16, padding: 4 },
  segB: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 12 },
  chip: { paddingHorizontal: 14, height: 34, borderRadius: 17, borderWidth: 1, borderColor: C.line2, justifyContent: 'center' },
  price: { color: C.chalk, fontWeight: '800', minWidth: 50, paddingVertical: 2, borderBottomWidth: 1, borderBottomColor: C.line2 },
  step: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
