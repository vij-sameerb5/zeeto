import * as ImagePicker from 'expo-image-picker';
import { BellRing, Camera, Check, ExternalLink, ImageIcon, PackageCheck, Sparkles, Undo2, X } from 'lucide-react-native';
import QRCode from 'react-native-qrcode-svg';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { RAILS, VENDORS, WEEK_INR, ago, customerVisits, inr, short, tierFor, UNITS, mockAi, mockPayments, type AiDraft, type Order, type OrderStatus } from '@zeeto/core';
import { useNav } from '../nav';
import { MY_STALL, useApp } from '../store';
import { C, mono } from '../theme';
import { Bar, Btn, Face, Label, Pic, Sim, s as ui } from '../ui';
import { STATUS } from './Order';
import { WEB_URL, openWeb } from '../web';

type Seg = 'orders' | 'post' | 'collect' | 'snap' | 'stock' | 'money';

const REASONS = ['Sold out', 'Closing early', 'Can’t fill the quantity'];
const GROUPS: [string, OrderStatus[]][] = [['New', ['paid']], ['Packing', ['accepted', 'ready']], ['Done', ['done', 'refunded', 'part-refunded']]];

/**
 * Seller mode for the demo stall. Same rules as the web dashboard:
 * New → Accept or Reject (reject refunds in full). If the customer asked to cancel, only Refund is offered.
 * Accepted → Packed. Ready → Hand over after the customer says their name and code.
 */
export default function Sell() {
  const [seg, setSeg] = useState<Seg>('orders');
  const v = VENDORS.find((x) => x.id === MY_STALL)!;
  const orders = useApp((x) => x.stallOrders);
  const today = orders.filter((o) => Date.now() - new Date(o.at).getTime() < 864e5 && o.status !== 'paying');
  const open = orders.filter((o) => o.status === 'paid' || o.status === 'accepted' || o.status === 'ready').length;
  const stallOpen = useApp((x) => x.stallOpen);
  const setOpen = useApp((x) => x.setOpen);
  const max = Math.max(...WEEK_INR);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Bar title="Seller mode" right={<Sim />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Face media={v.avatar} size={52} ring />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.chalk, fontWeight: '800', fontSize: 18 }}>{v.name}</Text>
            <Text style={{ color: C.mute, fontSize: 13 }}>{v.followers.toLocaleString('en-IN')} followers · {v.landmark}</Text>
          </View>
        </View>

        <View style={[ui.card, { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }]}>
          <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: stallOpen ? C.good : C.dim }} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.chalk, fontWeight: '700' }}>{stallOpen ? 'Open for orders' : 'Closed'}</Text>
            <Text style={{ color: C.mute, fontSize: 12 }}>{stallOpen ? 'Customers can order and pay' : 'Your stall is hidden from new orders'}</Text>
          </View>
          <Switch value={stallOpen} onValueChange={setOpen} trackColor={{ true: C.z, false: C.raised }} thumbColor={C.chalk} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Metric label="Today" value={inr(today.reduce((a, o) => a + o.inr, 0))} />
          <Metric label="Open orders" value={String(open)} hot={open > 0} />
        </View>
        <View style={[ui.card, { gap: 10 }]}>
          <Label>This week</Label>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 70 }}>
            {WEEK_INR.map((n, i) => (
              <View key={i} style={{ flex: 1, height: `${(n / max) * 100}%`, borderRadius: 6, backgroundColor: i === WEEK_INR.length - 1 ? C.z : C.raised }} />
            ))}
          </View>
        </View>

        <View style={st.seg}>
          {([['orders', 'Orders'], ['post', 'Post'], ['collect', 'QR'], ['snap', 'Snap'], ['stock', 'Stock'], ['money', 'Money']] as [Seg, string][]).map(([id, l]) => (
            <Pressable key={id} onPress={() => setSeg(id)} style={[st.segB, seg === id && { backgroundColor: C.chalk }]}>
              <Text style={{ color: seg === id ? C.ink : C.mute, fontWeight: '700', fontSize: 13 }}>{l}</Text>
            </Pressable>
          ))}
        </View>

        {seg === 'orders' && <Orders orders={orders} />}
        {seg === 'post' && <Post />}
        {seg === 'collect' && <Collect />}
        {seg === 'snap' && <Snap onDone={() => setSeg('stock')} />}
        {seg === 'money' && <Money orders={orders} />}
        {seg === 'stock' && <Stock />}
      </ScrollView>
    </View>
  );
}

const Metric = ({ label, value, hot }: { label: string; value: string; hot?: boolean }) => (
  <View style={[ui.card, { flex: 1, gap: 4 }, hot && { borderColor: C.z }]}>
    <Label>{label}</Label>
    <Text style={{ color: hot ? C.z : C.chalk, fontSize: 24, fontWeight: '800' }}>{value}</Text>
  </View>
);

function Orders({ orders }: { orders: Order[] }) {
  const packed = useApp((x) => x.packed);
  const accept = useApp((x) => x.accept);
  const refunded = useApp((x) => x.refunded);
  const handedOver = useApp((x) => x.handedOver);
  const [g, setG] = useState(0);
  const [handing, setHanding] = useState<Order | null>(null);
  const shown = orders.filter((o) => GROUPS[g][1].includes(o.status));

  // Demo stall: the refund is simulated. Real stalls refund from their own wallet on the web dashboard.
  const refund = async (o: Order, why: string) => {
    const r = await mockPayments.refund(o, o.usd, why);
    refunded(o.id, r, true);
    Alert.alert('Refunded', `${r.amount.toFixed(2)} ${r.token} sent back to ${o.customer}.`);
  };
  const askReject = (o: Order) => Alert.alert('Reject and refund?', `${o.customer} gets ${o.usd.toFixed(2)} USDT back. Pick a reason they’ll see:`, [
    ...REASONS.map((r) => ({ text: r, onPress: () => refund(o, r) })),
    { text: 'Keep order', style: 'cancel' as const },
  ]);

  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {GROUPS.map(([l, sts], i) => {
          const n = orders.filter((o) => sts.includes(o.status)).length;
          return <Pressable key={l} onPress={() => setG(i)} style={[st.chip, g === i && { backgroundColor: C.chalk, borderColor: C.chalk }]}><Text style={{ color: g === i ? C.ink : C.mute, fontWeight: '700', fontSize: 13 }}>{l}{n ? ` (${n})` : ''}</Text></Pressable>;
        })}
      </View>
      {!shown.length && <Text style={{ color: C.mute, textAlign: 'center', paddingVertical: 20 }}>{g === 0 ? 'New paid orders land here.' : 'All clear.'}</Text>}
      {shown.map((o) => {
        const s = STATUS[o.status];
        return (
          <View key={o.id} style={[ui.card, { gap: 10 }, o.status === 'paid' && { borderColor: C.z }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Text style={{ color: C.chalk, fontWeight: '700', flex: 1 }} numberOfLines={1}>{o.customer} · {o.id.toUpperCase()}</Text>
              <Text style={{ color: C.chalk, fontWeight: '800' }}>{inr(o.inr)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={{ color: s.color, fontSize: 13 }}>{s.label} · {ago(o.at)}</Text>
              <Visit n={customerVisits(orders, o)} />
            </View>
            <View style={{ backgroundColor: C.raised, borderRadius: 14, padding: 10, gap: 2 }}>
              {o.lines.map((l) => <Text key={l.productId} style={{ color: C.chalk }}><Text style={{ fontWeight: '700' }}>{l.qty} {UNITS[l.unit]}</Text> {l.name}</Text>)}
            </View>
            {o.payment && <Text style={{ color: C.dim, fontFamily: mono, fontSize: 11 }}>{o.payment.settled.toFixed(2)} {o.payment.settledToken} received · {RAILS[o.payment.rail].network}{o.payment.simulated ? ' · simulated' : ''}</Text>}
            {o.refunds.map((r, i) => <Text key={i} style={{ color: C.warn, fontSize: 13 }}>Refunded {r.amount.toFixed(2)} {r.token} · {r.reason}</Text>)}
            {o.cancelAsked && o.status === 'paid' && <Banner color={C.warn} icon={<Undo2 size={15} color={C.warn} />} text={`${o.customer} asked to cancel. Please refund.`} />}
            {o.arrivedAt && ['paid', 'accepted', 'ready'].includes(o.status) && <Banner color={C.z} icon={<BellRing size={15} color={C.z} />} text={`${o.customer} is at the stall · ${ago(o.arrivedAt)}`} />}

            {o.status === 'paid' && o.cancelAsked && <Btn title={`Refund ${o.usd.toFixed(2)} USDT`} onPress={() => refund(o, 'Cancelled by customer')} style={{ height: 44 }} right={<Undo2 size={16} color={C.ink} />} />}
            {o.status === 'paid' && !o.cancelAsked && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Btn title="Accept" onPress={() => accept(o.id)} style={{ flex: 1, height: 44 }} right={<Check size={16} color={C.ink} />} />
                <Btn title="Reject" kind="line" style={{ height: 44 }} onPress={() => askReject(o)} right={<X size={16} color={C.chalk} />} />
              </View>
            )}
            {o.status === 'accepted' && <Btn title="Packed · ready for pickup" onPress={() => packed(o.id)} style={{ height: 44 }} right={<PackageCheck size={16} color={C.ink} />} />}
            {o.status === 'ready' && <Btn title="Hand over" kind="chalk" onPress={() => setHanding(o)} style={{ height: 44 }} right={<Check size={16} color={C.ink} />} />}
          </View>
        );
      })}

      <Modal visible={!!handing} transparent animationType="slide" onRequestClose={() => setHanding(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <View style={st.sheet}>
            <Text style={{ color: C.chalk, fontSize: 20, fontWeight: '800' }}>Hand over this order?</Text>
            <Text style={{ color: C.mute }}>Ask the customer for their name and code. If both match, hand over the bag.</Text>
            <View style={{ backgroundColor: C.raised, borderRadius: 18, padding: 16, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.line2 }}>
              <Text style={{ color: C.chalk, fontSize: 18, fontWeight: '700' }}>{handing?.customer}</Text>
              <Text style={{ color: C.z, fontFamily: mono, fontSize: 38, fontWeight: '700', letterSpacing: 4 }}>{handing?.code}</Text>
              <Text style={{ color: C.dim, fontSize: 12 }}>Order {handing?.id.toUpperCase()} · {handing?.lines.length} {handing?.lines.length === 1 ? 'item' : 'items'}</Text>
            </View>
            <Btn title="It matches · handed over" onPress={() => { if (handing) handedOver(handing.id); setHanding(null); }} right={<Check size={16} color={C.ink} />} />
            <Btn title="Not yet" kind="line" onPress={() => setHanding(null)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** How well the stall knows this customer: first visit, or their nth visit and tier here. */
const Visit = ({ n }: { n: number }) => (
  <Text style={{ fontSize: 11, fontWeight: '700', color: n <= 1 ? C.z : C.good, backgroundColor: n <= 1 ? C.zSoft : C.goodSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, overflow: 'hidden' }}>
    {n <= 1 ? 'First visit' : `Visit ${n} · ${tierFor(n).name}`}
  </Text>
);

const Banner = ({ color, icon, text }: { color: string; icon: React.ReactNode; text: string }) => (
  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', borderWidth: 1, borderColor: color, borderRadius: 14, padding: 10 }}>
    {icon}<Text style={{ color, fontWeight: '600', flex: 1 }}>{text}</Text>
  </View>
);

/** Post a story (photo + one line, 24 h) and send offers to followers. Shows on the stall page and in followers' inbox. */
function Post() {
  const postStory = useApp((x) => x.postStory);
  const notify = useApp((x) => x.notifyFollowers);
  const [photo, setPhoto] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [title, setTitle] = useState('');
  const [msg, setMsg] = useState('');
  const pick = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow access to add a photo.'); return; }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, allowsEditing: true, aspect: [9, 16] };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!r.canceled && r.assets[0]) setPhoto(r.assets[0].uri);
  };
  return (
    <View style={{ gap: 14 }}>
      <View style={[ui.card, { gap: 12 }]}>
        <Label>Story · 24 hours</Label>
        <Text style={{ color: C.mute, lineHeight: 20 }}>Show today’s stock. Followers see it at the top of their home screen.</Text>
        {photo ? <Pic media={photo} style={{ width: '100%', aspectRatio: 9 / 12, borderRadius: 18 }} /> : (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Btn title="Camera" onPress={() => pick(true)} style={{ flex: 1 }} right={<Camera size={17} color={C.ink} />} />
            <Btn title="Gallery" kind="line" onPress={() => pick(false)} style={{ flex: 1 }} right={<ImageIcon size={17} color={C.chalk} />} />
          </View>
        )}
        {!photo && <Pressable onPress={() => setPhoto('veg-3')}><Text style={{ color: C.z, textAlign: 'center' }}>No camera? Use a sample photo</Text></Pressable>}
        <TextInput value={caption} onChangeText={setCaption} maxLength={120} placeholder="Fresh mangoes just in, ₹80/kg" placeholderTextColor={C.dim} style={st.input} />
        <Btn title="Post story" disabled={!photo || caption.trim().length < 3} onPress={() => { postStory(photo!, caption); setPhoto(null); setCaption(''); Alert.alert('Posted', 'Your story is live for 24 hours.'); }} />
      </View>

      <View style={[ui.card, { gap: 12 }]}>
        <Label>Send an offer to followers</Label>
        <TextInput value={title} onChangeText={setTitle} maxLength={60} placeholder="Today only: 10% off tomatoes" placeholderTextColor={C.dim} style={st.input} />
        <TextInput value={msg} onChangeText={setMsg} maxLength={200} multiline placeholder="Before 1 PM. Show this message at the stall." placeholderTextColor={C.dim} style={[st.input, { height: 80, textAlignVertical: 'top', paddingTop: 12 }]} />
        <Btn title="Send to followers" disabled={title.trim().length < 3} onPress={() => {
          const n = notify(title, msg);
          setTitle(''); setMsg('');
          Alert.alert('Sent', `${n.toLocaleString('en-IN')} followers will see it in their notifications${WEB_URL ? ' and on WhatsApp if they opted in' : ''}.`);
        }} />
        <Text style={{ color: C.dim, fontSize: 12 }}>Offers show on your stall page and in each follower’s inbox. Keep it honest: no fake discounts.</Text>
      </View>
    </View>
  );
}

/** The stall's own QR: customers scan it, type the amount and pay from their wallet. */
function Collect() {
  const v = VENDORS.find((x) => x.id === MY_STALL)!;
  const link = WEB_URL ? `${WEB_URL}/p/${MY_STALL}` : '';
  return (
    <View style={{ gap: 12 }}>
      <View style={[ui.card, { alignItems: 'center', gap: 12, paddingVertical: 22 }]}>
        <Label>Scan to pay {v.name}</Label>
        {link ? (
          <View style={{ backgroundColor: C.chalk, padding: 14, borderRadius: 20 }}>
            <QRCode value={link} size={210} color="#0A0A0A" backgroundColor={C.chalk} />
          </View>
        ) : <Text style={{ color: C.mute, textAlign: 'center' }}>Set EXPO_PUBLIC_WEB_URL to show your shop QR.</Text>}
        <Text style={{ color: C.mute, textAlign: 'center', lineHeight: 20 }}>Customer scans, types the amount and pays. Money goes straight to {short(v.wallet)}. You’ll see it under Money.</Text>
      </View>
      {!!link && <Btn title="Share pay link" kind="line" onPress={() => Share.share({ message: `Pay ${v.name} on Zeeto: ${link}` })} />}
      {!!WEB_URL && <Btn title="Make a bill for an exact amount" kind="line" onPress={() => openWeb('/sell/collect')} right={<ExternalLink size={15} color={C.chalk} />} />}
    </View>
  );
}

/** Every payment and refund, newest first. */
function Money({ orders }: { orders: Order[] }) {
  const paid = orders.filter((o) => o.payment);
  const gross = paid.reduce((a, o) => a + (o.payment?.settled ?? 0), 0);
  const back = paid.reduce((a, o) => a + o.refunds.reduce((x, r) => x + r.amount, 0), 0);
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Metric label="Received" value={gross.toFixed(2)} hot />
        <Metric label="Refunded" value={back.toFixed(2)} />
        <Metric label="Net" value={(gross - back).toFixed(2)} />
      </View>
      {paid.map((o) => {
        const p = o.payment!;
        const r = o.refunds.reduce((x, y) => x + y.amount, 0);
        return (
          <View key={o.id} style={[ui.card, { gap: 4, padding: 14 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: C.chalk, fontWeight: '700', flex: 1 }} numberOfLines={1}>{o.customer}</Text>
              <Text style={{ color: C.good, fontWeight: '800', fontFamily: mono }}>+{p.settled.toFixed(2)} {p.settledToken}</Text>
            </View>
            <Text style={{ color: C.mute, fontSize: 12 }}>{o.id.toUpperCase()} · {RAILS[p.rail].network} · {ago(p.at)}</Text>
            {r > 0 && <Text style={{ color: C.warn, fontSize: 12 }}>−{r.toFixed(2)} refunded</Text>}
            {p.simulated
              ? <Text style={{ color: C.dim, fontFamily: mono, fontSize: 11 }}>tx {short(p.tx)} · simulated</Text>
              : <Pressable onPress={() => Linking.openURL(RAILS[p.rail].txUrl(p.tx))}><Text style={{ color: C.z, fontFamily: mono, fontSize: 11 }}>tx {short(p.tx)} ↗</Text></Pressable>}
          </View>
        );
      })}
    </View>
  );
}

function Snap({ onDone }: { onDone: () => void }) {
  const publish = useApp((x) => x.publish);
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<AiDraft | null>(null);

  const read = async (uri: string) => {
    setPhoto(uri);
    setDraft(null);
    setBusy(true);
    // Mock today; becomes a 0G vision call through the API (see docs/ARCHITECTURE.md §7).
    const d = await mockAi.snap(null);
    setDraft(d);
    setBusy(false);
  };

  const pick = async (camera: boolean) => {
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', camera ? 'Allow camera access to snap your stock.' : 'Allow photo access to pick a picture.'); return; }
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, allowsEditing: true, aspect: [1, 1] };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (!r.canceled && r.assets[0]) read(r.assets[0].uri);
  };

  const edit = (i: number, key: 'priceInr' | 'qty', text: string) => {
    if (!draft) return;
    const n = Number(text.replace(/[^0-9]/g, '')) || 0;
    setDraft({ ...draft, items: draft.items.map((it, j) => (j === i ? { ...it, [key]: n } : it)) });
  };

  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: C.mute, lineHeight: 20 }}>Snap your stock. AI writes the listing and a note for your followers. You check the price before anything goes live.</Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn title="Camera" onPress={() => pick(true)} style={{ flex: 1 }} right={<Camera size={17} color={C.ink} />} />
        <Btn title="Gallery" kind="line" onPress={() => pick(false)} style={{ flex: 1 }} right={<ImageIcon size={17} color={C.chalk} />} />
      </View>
      <Pressable onPress={() => read('fruit-2')}><Text style={{ color: C.z, textAlign: 'center', paddingVertical: 4 }}>No camera? Try a sample photo</Text></Pressable>

      {photo && <Pic media={photo} style={{ width: '100%', aspectRatio: 1, borderRadius: 20 }} />}
      {busy && (
        <View style={[ui.card, { flexDirection: 'row', gap: 10, alignItems: 'center' }]}>
          <ActivityIndicator color={C.z} /><Text style={{ color: C.chalk }}>Reading your photo…</Text>
        </View>
      )}

      {draft && (
        <View style={[ui.card, { gap: 12, borderColor: C.z }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}><Sparkles size={15} color={C.z} /><Label style={{ color: C.z }}>AI draft</Label></View>
            {draft.run.simulated && <Sim />}
          </View>
          {draft.items.map((it, i) => (
            <View key={i} style={{ gap: 6 }}>
              <Text style={{ color: C.chalk, fontWeight: '700', fontSize: 16 }}>{it.name} {it.local ? <Text style={{ color: C.dim, fontWeight: '400' }}>{it.local}</Text> : null}</Text>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Field label={`₹ /${UNITS[it.unit]}`} value={String(it.priceInr)} onChange={(t) => edit(i, 'priceInr', t)} />
                <Field label="Qty" value={String(it.qty)} onChange={(t) => edit(i, 'qty', t)} />
                <Text style={{ color: C.dim, fontSize: 12 }}>{Math.round(it.confidence * 100)}% sure</Text>
              </View>
            </View>
          ))}
          <View style={{ height: 1, backgroundColor: C.line }} />
          <Label>Note to followers</Label>
          <Text style={{ color: C.chalk, fontWeight: '700' }}>{draft.alert.title}</Text>
          <Text style={{ color: C.mute }}>{draft.alert.body}</Text>
          {Object.entries(draft.alert.translations).map(([lang, t]) => <Text key={lang} style={{ color: C.mute, fontSize: 13 }}><Text style={{ color: C.dim }}>{lang}: </Text>{t}</Text>)}
          <Text style={{ color: C.dim, fontFamily: mono, fontSize: 10 }}>{draft.run.model} · {draft.run.requestId} · {draft.run.ms} ms</Text>
          <Btn title="Publish to followers" onPress={() => { publish(draft, photo); Alert.alert('Published', 'Listing is live on your stall.'); setDraft(null); setPhoto(null); onDone(); }} />
        </View>
      )}
    </View>
  );
}

const Field = ({ label, value, onChange }: { label: string; value: string; onChange: (t: string) => void }) => (
  <View style={st.field}>
    <Text style={{ color: C.dim, fontSize: 11 }}>{label}</Text>
    <TextInput value={value} onChangeText={onChange} keyboardType="number-pad" style={{ color: C.chalk, fontWeight: '700', fontSize: 16, minWidth: 50, padding: 0 }} />
  </View>
);

function Stock() {
  const products = useApp((x) => x.products).filter((p) => p.vendorId === MY_STALL);
  const toggleStock = useApp((x) => x.toggleStock);
  const setPrice = useApp((x) => x.setPrice);
  return (
    <View style={{ gap: 10 }}>
      {products.map((p) => (
        <View key={p.id} style={[ui.card, { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }]}>
          <Pic media={p.image} style={{ width: 52, height: 52, borderRadius: 12, opacity: p.stock > 0 ? 1 : 0.4 }} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: C.chalk, fontWeight: '700' }} numberOfLines={1}>{p.name}{p.byAi ? <Text style={{ color: C.z }}>  · AI</Text> : null}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: C.mute }}>₹</Text>
              <TextInput defaultValue={String(p.priceInr)} keyboardType="number-pad" onEndEditing={(e) => { const n = Number(e.nativeEvent.text); if (n > 0) setPrice(p.id, n); }} style={{ color: C.chalk, fontWeight: '700', padding: 0, minWidth: 40 }} />
              <Text style={{ color: C.dim, fontSize: 12 }}>/{UNITS[p.unit]} · {p.stock > 0 ? `${p.stock} left` : 'sold out'}</Text>
            </View>
          </View>
          <Switch value={p.stock > 0} onValueChange={() => toggleStock(p.id)} trackColor={{ true: C.z, false: C.raised }} thumbColor={C.chalk} />
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  input: { borderWidth: 1, borderColor: C.line2, borderRadius: 14, minHeight: 48, paddingHorizontal: 14, color: C.chalk, backgroundColor: C.raised, fontSize: 15 },
  chip: { flex: 1, height: 36, borderRadius: 18, borderWidth: 1, borderColor: C.line2, alignItems: 'center', justifyContent: 'center', backgroundColor: C.panel },
  seg: { flexDirection: 'row', backgroundColor: C.panel, borderRadius: 22, padding: 4, borderWidth: 1, borderColor: C.line },
  segB: { flex: 1, height: 38, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sheet: { backgroundColor: C.panel, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36, gap: 12, borderWidth: 1, borderColor: C.line },
  code: { borderWidth: 1, borderColor: C.line2, borderRadius: 16, height: 60, color: C.chalk, fontSize: 28, fontFamily: mono, textAlign: 'center', letterSpacing: 4 },
  field: { borderWidth: 1, borderColor: C.line2, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.raised },
});
