import { BadgeCheck, ChevronLeft, Clock, MapPin, Navigation, Star } from 'lucide-react-native';
import { Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ALERTS, CATEGORIES, ME, RAILS, VENDORS, distance, inr, km, UNITS } from '@zeeto/core';
import { useNav } from '../nav';
import { useApp, useBagCount } from '../store';
import { C } from '../theme';
import { Btn, Face, Label, Pic, Qty, s as ui } from '../ui';
import { BagBar } from './Explore';

export default function Stall({ id }: { id: string }) {
  const nav = useNav();
  const top = useSafeAreaInsets().top;
  const v = VENDORS.find((x) => x.id === id) ?? VENDORS[0];
  const all = useApp((x) => x.products);
  const items = all.filter((p) => p.vendorId === v.id);
  const alert = ALERTS.find((a) => a.vendorId === v.id);
  const following = useApp((x) => x.follows.includes(v.id));
  const follow = useApp((x) => x.follow);
  const bag = useApp((x) => x.bag);
  const setQty = useApp((x) => x.setQty);
  const count = useBagCount();
  const otherStall = bag.vendorId && bag.vendorId !== v.id ? VENDORS.find((x) => x.id === bag.vendorId) : null;

  const change = (productId: string, n: number) => {
    if (otherStall && n > 0) {
      Alert.alert('Start a new bag?', `Your bag has items from ${otherStall.name}. Orders are one stall at a time.`, [
        { text: 'Keep it', style: 'cancel' },
        { text: 'New bag', style: 'destructive', onPress: () => setQty(v.id, productId, n) },
      ]);
      return;
    }
    setQty(v.id, productId, n);
  };

  const directions = () => {
    const { lat, lng } = v.location;
    const url = Platform.OS === 'ios' ? `http://maps.apple.com/?daddr=${lat},${lng}&dirflg=w` : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
    Linking.openURL(url);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: count ? 100 : 40 }}>
        <View>
          <Pic media={v.cover} style={{ width: '100%', height: 230 }} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.25)' }]} />
          <Pressable onPress={nav.back} style={[ui.round, { position: 'absolute', left: 14, top: top + 6, backgroundColor: 'rgba(10,10,10,0.7)' }]} accessibilityLabel="Back">
            <ChevronLeft size={22} color={C.chalk} />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: 16, marginTop: -44 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <View style={{ borderRadius: 50, borderWidth: 4, borderColor: C.bg }}><Face media={v.avatar} size={88} ring={v.fresh} /></View>
            <View style={st.stats}>
              <Stat n={v.followers.toLocaleString('en-IN')} l="followers" />
              <Stat n={String(items.length)} l="items" />
              <Stat n={v.rating.toFixed(1)} l="rating" />
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
            <Text style={st.name}>{v.name}</Text>
            {v.verified && <BadgeCheck size={18} color={C.z} />}
          </View>
          <Text style={st.meta}>{CATEGORIES[v.category].label} · by {v.owner}</Text>
          <Text style={st.bio}>{v.tagline}</Text>

          <View style={{ gap: 6, marginTop: 10 }}>
            <Line icon={<MapPin size={14} color={C.mute} />} text={`${v.landmark} · ${distance(km(ME.home, v.location))} away`} />
            <Line icon={<Clock size={14} color={C.mute} />} text={v.hours.replace('-', '–')} />
          </View>

          {(v.fresh || v.offer) && (
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 12 }}>
              {v.fresh && <Text style={[st.tag, { color: C.good, backgroundColor: C.goodSoft }]}>Fresh today</Text>}
              {v.offer && <Text style={[st.tag, { color: C.z, backgroundColor: C.zSoft }]}>{v.offer}</Text>}
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Btn title={following ? 'Following' : 'Follow'} kind={following ? 'line' : 'z'} onPress={() => follow(v.id)} style={{ flex: 1, height: 44 }} />
            <Btn title="Directions" kind="line" onPress={directions} style={{ flex: 1, height: 44 }} right={<Navigation size={15} color={C.chalk} />} />
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
            {v.rails.map((r) => <Text key={r} style={st.rail}>{RAILS[r].token} · {RAILS[r].network}</Text>)}
          </View>

          {alert && (
            <View style={st.alert}>
              <Label style={{ color: C.z }}>New from {v.name.split(' ')[0]}</Label>
              <Text style={{ color: C.chalk, fontSize: 16, fontWeight: '700', marginTop: 6 }}>{alert.title}</Text>
              <Text style={{ color: C.mute, marginTop: 4, lineHeight: 20 }}>{alert.body}</Text>
            </View>
          )}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginTop: 18, marginHorizontal: -16, paddingLeft: 16 }}>
            {v.photos.map((p, i) => <Pic key={i} media={p} style={{ width: 120, height: 150, borderRadius: 14 }} />)}
          </ScrollView>

          <Label style={{ marginTop: 24, marginBottom: 12 }}>On sale today</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {items.map((p) => {
              const n = bag.vendorId === v.id ? bag.lines[p.id] ?? 0 : 0;
              const out = p.stock <= 0;
              return (
                <View key={p.id} style={st.item}>
                  <Pic media={p.image} style={{ width: '100%', aspectRatio: 1, borderRadius: 16, opacity: out ? 0.4 : 1 }} />
                  <Text style={st.pName} numberOfLines={1}>{p.name}</Text>
                  {p.local ? <Text style={st.local} numberOfLines={1}>{p.local}</Text> : null}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                    <Text style={st.price}>{inr(p.priceInr)}<Text style={st.unit}> /{UNITS[p.unit]}</Text></Text>
                    {out ? <Text style={st.unit}>Sold out</Text> : <Qty n={n} onChange={(k) => change(p.id, Math.min(k, p.stock))} />}
                  </View>
                </View>
              );
            })}
          </View>

          <Label style={{ marginTop: 28, marginBottom: 8 }}>About</Label>
          <Text style={st.bio}>{v.bio}</Text>
          <Text style={[st.meta, { marginTop: 8 }]}>Speaks {v.languages.join(', ')}</Text>
        </View>
      </ScrollView>
      {count > 0 && <BagBar />}
    </View>
  );
}

const Stat = ({ n, l }: { n: string; l: string }) => (
  <View style={{ alignItems: 'center' }}>
    <Text style={{ color: C.chalk, fontWeight: '800', fontSize: 17 }}>{n}</Text>
    <Text style={{ color: C.mute, fontSize: 11 }}>{l}</Text>
  </View>
);

const Line = ({ icon, text }: { icon: React.ReactNode; text: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{icon}<Text style={{ color: C.mute, fontSize: 13, flex: 1 }}>{text}</Text></View>
);

const st = StyleSheet.create({
  stats: { flexDirection: 'row', gap: 22, paddingBottom: 8 },
  name: { color: C.chalk, fontSize: 24, fontWeight: '800', letterSpacing: -0.6, flexShrink: 1 },
  meta: { color: C.mute, fontSize: 13, marginTop: 2 },
  bio: { color: C.chalk, opacity: 0.85, fontSize: 15, lineHeight: 21, marginTop: 8 },
  tag: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  rail: { color: C.chalk, opacity: 0.8, fontSize: 10, borderWidth: 1, borderColor: C.line2, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, overflow: 'hidden', backgroundColor: C.raised },
  alert: { marginTop: 18, padding: 14, borderRadius: 18, backgroundColor: C.zSoft, borderWidth: 1, borderColor: 'rgba(255,122,26,0.3)' },
  item: { width: '47.8%' },
  pName: { color: C.chalk, fontWeight: '700', fontSize: 14, marginTop: 8 },
  local: { color: C.dim, fontSize: 12 },
  price: { color: C.z, fontWeight: '800', fontSize: 15 },
  unit: { color: C.mute, fontWeight: '400', fontSize: 12 },
});
