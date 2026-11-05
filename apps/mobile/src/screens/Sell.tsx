import * as ImagePicker from 'expo-image-picker';
import { Camera, Check, ImageIcon, PackageCheck, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { VENDORS, WEEK_INR, ago, inr, UNITS, mockAi, mockPayments, type AiDraft, type Order } from '@zeeto/core';
import { useNav } from '../nav';
import { MY_STALL, useApp } from '../store';
import { C, mono } from '../theme';
import { Bar, Btn, Face, Label, Pic, Sim, s as ui } from '../ui';
import { STATUS } from './Order';

type Seg = 'orders' | 'snap' | 'stock';

/** Seller mode for the demo stall: orders, Snap & Sell, stock. */
export default function Sell() {
  const [seg, setSeg] = useState<Seg>('orders');
  const v = VENDORS.find((x) => x.id === MY_STALL)!;
  const orders = useApp((x) => x.stallOrders);
  const today = orders.filter((o) => Date.now() - new Date(o.at).getTime() < 864e5 && o.status !== 'paying');
  const open = orders.filter((o) => o.status === 'paid' || o.status === 'accepted' || o.status === 'ready').length;
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
          {([['orders', 'Orders'], ['snap', 'Snap & Sell'], ['stock', 'Stock']] as [Seg, string][]).map(([id, l]) => (
            <Pressable key={id} onPress={() => setSeg(id)} style={[st.segB, seg === id && { backgroundColor: C.chalk }]}>
              <Text style={{ color: seg === id ? C.ink : C.mute, fontWeight: '700', fontSize: 13 }}>{l}</Text>
            </Pressable>
          ))}
        </View>

        {seg === 'orders' && <Orders orders={orders} />}
        {seg === 'snap' && <Snap onDone={() => setSeg('stock')} />}
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
  const reject = useApp((x) => x.reject);
  const handedOver = useApp((x) => x.handedOver);
  const [handing, setHanding] = useState<Order | null>(null);
  const [code, setCode] = useState('');
  const [wrong, setWrong] = useState(false);

  const confirm = () => {
    if (!handing) return;
    if (handedOver(handing.id, code)) { setHanding(null); setCode(''); setWrong(false); Alert.alert('Handed over', `Order ${handing.code} is complete.`); }
    else setWrong(true);
  };

  return (
    <View style={{ gap: 12 }}>
      {orders.map((o) => {
        const s = STATUS[o.status];
        return (
          <View key={o.id} style={[ui.card, { gap: 10 }, o.status === 'paid' && { borderColor: C.z }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: C.chalk, fontWeight: '700' }}>{o.customer} · {o.id.toUpperCase()}</Text>
              <Text style={{ color: C.chalk, fontWeight: '800' }}>{inr(o.inr)}</Text>
            </View>
            <Text style={{ color: s.color, fontSize: 13 }}>{s.label} · {ago(o.at)}</Text>
            {o.lines.map((l) => <Text key={l.productId} style={{ color: C.mute }}>{l.qty} {UNITS[l.unit]} {l.name}</Text>)}
            {o.payment && <Text style={{ color: C.dim, fontFamily: mono, fontSize: 11 }}>{o.payment.settled.toFixed(2)} {o.payment.settledToken} received{o.payment.simulated ? ' · simulated' : ''}</Text>}
            {o.status === 'paid' && (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Btn title="Accept" onPress={() => accept(o.id)} style={{ flex: 1, height: 44 }} right={<Check size={16} color={C.ink} />} />
                <Btn title="Reject" kind="line" style={{ height: 44 }} onPress={() => Alert.alert('Reject and refund?', `${o.customer} gets ${o.usd.toFixed(2)} USDT back.`, [
                  { text: 'Keep order', style: 'cancel' },
                  { text: 'Sold out', style: 'destructive', onPress: async () => reject(o.id, await mockPayments.refund(o, o.usd, 'Sold out')) },
                ])} />
              </View>
            )}
            {o.status === 'accepted' && <Btn title="Packed · mark ready" onPress={() => packed(o.id)} style={{ height: 44 }} right={<PackageCheck size={16} color={C.ink} />} />}
            {o.status === 'ready' && <Btn title="Hand over" kind="chalk" onPress={() => { setHanding(o); setWrong(false); setCode(''); }} style={{ height: 44 }} right={<Check size={16} color={C.ink} />} />}
          </View>
        );
      })}

      <Modal visible={!!handing} transparent animationType="slide" onRequestClose={() => setHanding(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <View style={st.sheet}>
            <Text style={{ color: C.chalk, fontSize: 20, fontWeight: '800' }}>Ask for the pickup code</Text>
            <Text style={{ color: C.mute }}>{handing?.customer} shows it on their phone.</Text>
            <TextInput value={code} onChangeText={(t) => { setCode(t); setWrong(false); }} autoCapitalize="characters" autoFocus placeholder="AB-123" placeholderTextColor={C.dim} style={[st.code, wrong && { borderColor: C.hot }]} />
            {wrong && <Text style={{ color: C.hot }}>That code doesn't match this order.</Text>}
            <Text style={{ color: C.dim, fontSize: 12 }}>Demo hint: {handing?.code}</Text>
            <Btn title="Confirm hand over" onPress={confirm} disabled={code.trim().length < 4} />
            <Btn title="Cancel" kind="line" onPress={() => setHanding(null)} />
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  seg: { flexDirection: 'row', backgroundColor: C.panel, borderRadius: 22, padding: 4, borderWidth: 1, borderColor: C.line },
  segB: { flex: 1, height: 38, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sheet: { backgroundColor: C.panel, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingBottom: 36, gap: 12, borderWidth: 1, borderColor: C.line },
  code: { borderWidth: 1, borderColor: C.line2, borderRadius: 16, height: 60, color: C.chalk, fontSize: 28, fontFamily: mono, textAlign: 'center', letterSpacing: 4 },
  field: { borderWidth: 1, borderColor: C.line2, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: C.raised },
});
