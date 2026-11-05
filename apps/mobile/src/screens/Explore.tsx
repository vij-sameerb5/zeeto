import { BadgeCheck, List, Map as MapIcon, Search, Star } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, CENTER, GROUPS, ME, VENDORS, distance, inr, km, type CategoryGroup, type Vendor } from '@zeeto/core';
import { img } from '../media';
import { useNav } from '../nav';
import { useApp, useBagCount, useBagTotal } from '../store';
import { C } from '../theme';
import { Btn, Face, Label, Pic, Pill, s as ui } from '../ui';

export default function Explore() {
  const nav = useNav();
  const top = useSafeAreaInsets().top;
  const [view, setView] = useState<'map' | 'list'>('map');
  const [group, setGroup] = useState<CategoryGroup | 'all'>('all');
  const { search: q, setSearch: setQ } = nav;
  const [sel, setSel] = useState<string | null>(null);
  const [pinsReady, setPinsReady] = useState(false);
  const follows = useApp((x) => x.follows);
  const products = useApp((x) => x.products);
  const bag = useBagCount();

  // Custom marker views must re-render until their photo is drawn, then stop for performance.
  useEffect(() => { const t = setTimeout(() => setPinsReady(true), 1200); return () => clearTimeout(t); }, []);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return VENDORS.filter((v) =>
      (group === 'all' || CATEGORIES[v.category].group === group) &&
      (!t || v.name.toLowerCase().includes(t) || CATEGORIES[v.category].label.toLowerCase().includes(t) || products.some((p) => p.vendorId === v.id && p.name.toLowerCase().includes(t))),
    ).sort((a, b) => km(ME.home, a.location) - km(ME.home, b.location));
  }, [group, q, products]);
  const peek = shown.find((v) => v.id === sel);

  const header = (
    <View style={{ gap: 12 }}>
      <View style={st.row}>
        <View>
          <Label>Kalbadevi · Mumbai</Label>
          <Text style={st.h1}>{shown.length} stalls near you</Text>
        </View>
        <Pressable onPress={() => setView(view === 'map' ? 'list' : 'map')} style={ui.round} accessibilityLabel={view === 'map' ? 'Show list' : 'Show map'}>
          {view === 'map' ? <List size={18} color={C.chalk} /> : <MapIcon size={18} color={C.chalk} />}
        </Pressable>
      </View>
      <View style={st.search}>
        <Search size={18} color={C.mute} />
        <TextInput value={q} onChangeText={setQ} placeholder="Tomatoes, medicine, LED bulb…" placeholderTextColor={C.dim} style={st.input} returnKeyType="search" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <Pill title="All" on={group === 'all'} onPress={() => setGroup('all')} />
        {GROUPS.map((g) => <Pill key={g.id} title={g.label} on={group === g.id} onPress={() => setGroup(g.id)} />)}
      </ScrollView>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {view === 'map' ? (
        <>
          <MapView
            style={StyleSheet.absoluteFill}
            userInterfaceStyle="dark"
            initialRegion={{ latitude: CENTER.lat - 0.001, longitude: CENTER.lng, latitudeDelta: 0.012, longitudeDelta: 0.012 }}
            onPress={(e) => { if (e.nativeEvent.action !== 'marker-press') setSel(null); }}
            showsPointsOfInterests={false}
            toolbarEnabled={false}
          >
            <Marker coordinate={{ latitude: ME.home.lat, longitude: ME.home.lng }} title="You" tracksViewChanges={false}>
              <View style={st.me} />
            </Marker>
            {shown.map((v) => {
              const on = v.id === sel;
              return (
                <Marker key={v.id} coordinate={{ latitude: v.location.lat, longitude: v.location.lng }} onPress={() => setSel(v.id)} tracksViewChanges={!pinsReady || on} anchor={{ x: 0.5, y: 1 }}>
                  <View style={{ alignItems: 'center' }}>
                    <View style={[st.pin, on && { backgroundColor: C.z, transform: [{ scale: 1.15 }] }]}>
                      <Image source={img(v.avatar)} style={st.pinImg} resizeMode="cover" />
                      {v.fresh && <View style={st.dot} />}
                    </View>
                    <View style={[st.tip, on && { backgroundColor: C.z }]} />
                  </View>
                </Marker>
              );
            })}
          </MapView>
          <View style={[st.overlay, { paddingTop: top + 8 }]}>{header}</View>
          <View style={[st.bottom, { bottom: bag ? 76 : 12 }]}>
            {peek ? <Peek v={peek} following={follows.includes(peek.id)} /> : <View style={st.hint}><Text style={{ color: C.chalk, opacity: 0.8 }}>Tap a stall to see what's on sale</Text></View>}
          </View>
        </>
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(v) => v.id}
          contentContainerStyle={{ paddingTop: top + 8, paddingHorizontal: 16, paddingBottom: bag ? 96 : 24, gap: 14 }}
          ListHeaderComponent={
            <View style={{ gap: 18, marginBottom: 4 }}>
              {header}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
                {[...VENDORS].filter((v) => v.fresh || v.offer).sort((a, b) => Number(follows.includes(b.id)) - Number(follows.includes(a.id))).map((v) => (
                  <Pressable key={v.id} onPress={() => nav.push({ name: 'stall', id: v.id })} style={{ alignItems: 'center', width: 70, gap: 6 }}>
                    <Face media={v.avatar} size={64} ring />
                    <Text numberOfLines={1} style={{ color: C.mute, fontSize: 11 }}>{v.name.split(' ')[0]}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Label>Nearest first</Label>
            </View>
          }
          renderItem={({ item }) => <Row v={item} />}
          ListEmptyComponent={<Text style={{ color: C.mute, textAlign: 'center', paddingVertical: 40 }}>No stalls match. Try another filter.</Text>}
        />
      )}
      {bag > 0 && <BagBar />}
    </View>
  );
}

function Meta({ v }: { v: Vendor }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <Text style={st.meta}>{CATEGORIES[v.category].label} · {distance(km(ME.home, v.location))}</Text>
      <Star size={12} color={C.z} fill={C.z} />
      <Text style={st.meta}>{v.rating.toFixed(1)}</Text>
    </View>
  );
}

function Row({ v }: { v: Vendor }) {
  const nav = useNav();
  return (
    <Pressable onPress={() => nav.push({ name: 'stall', id: v.id })} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <View style={{ flexDirection: 'row', gap: 6, borderRadius: 18, overflow: 'hidden' }}>
        <Pic media={v.cover} style={{ flex: 1.6, height: 140, minWidth: 0 }} />
        <Pic media={v.photos[2] ?? v.avatar} style={{ flex: 1, height: 140, minWidth: 0 }} />
      </View>
      <View style={{ paddingTop: 10, paddingHorizontal: 2, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={st.name} numberOfLines={1}>{v.name}</Text>
          {v.verified && <BadgeCheck size={15} color={C.z} />}
        </View>
        <Meta v={v} />
        {(v.fresh || v.offer) && (
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
            {v.fresh && <Text style={[st.tag, { color: C.good, backgroundColor: C.goodSoft }]}>Fresh today</Text>}
            {v.offer && <Text style={[st.tag, { color: C.z, backgroundColor: C.zSoft }]}>{v.offer}</Text>}
          </View>
        )}
      </View>
    </Pressable>
  );
}

function Peek({ v, following }: { v: Vendor; following: boolean }) {
  const nav = useNav();
  const follow = useApp((x) => x.follow);
  const items = useApp((x) => x.products).filter((p) => p.vendorId === v.id).slice(0, 5);
  return (
    <View style={st.peek}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 }}>
        <Face media={v.avatar} size={50} ring={v.fresh} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[st.name, { flexShrink: 1 }]} numberOfLines={1}>{v.name}</Text>
            {v.verified && <BadgeCheck size={15} color={C.z} />}
          </View>
          <Meta v={v} />
        </View>
        <Pill title={following ? 'Following' : 'Follow'} on={!following} onPress={() => follow(v.id)} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
        {items.map((p) => (
          <Pressable key={p.id} onPress={() => nav.push({ name: 'stall', id: v.id })} style={{ width: 104, height: 104, borderRadius: 16, overflow: 'hidden' }}>
            <Pic media={p.image} style={StyleSheet.absoluteFill} />
            <View style={st.shade}>
              <Text numberOfLines={1} style={{ color: C.chalk, fontSize: 12, fontWeight: '600' }}>{p.name}</Text>
              <Text style={{ color: C.z, fontSize: 12, fontWeight: '800' }}>{inr(p.priceInr)}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ padding: 12 }}>
        <Btn title="Open stall" onPress={() => nav.push({ name: 'stall', id: v.id })} style={{ height: 46 }} />
      </View>
    </View>
  );
}

export function BagBar() {
  const nav = useNav();
  const n = useBagCount();
  const total = useBagTotal();
  const vendorId = useApp((x) => x.bag.vendorId);
  const v = VENDORS.find((x) => x.id === vendorId);
  return (
    <Pressable onPress={() => nav.push({ name: 'bag' })} style={st.bagBar}>
      <Text style={st.bagT} numberOfLines={1}>{n} item{n > 1 ? 's' : ''} · {v?.name}</Text>
      <Text style={st.bagT}>{inr(total)} →</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  h1: { color: C.chalk, fontSize: 26, fontWeight: '800', letterSpacing: -0.8, marginTop: 4 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, borderRadius: 24, borderWidth: 1, borderColor: C.line2, backgroundColor: C.panel, paddingHorizontal: 16 },
  input: { flex: 1, color: C.chalk, fontSize: 15 },
  overlay: { position: 'absolute', left: 0, right: 0, top: 0, paddingHorizontal: 16, paddingBottom: 16, backgroundColor: 'rgba(10,10,10,0.82)' },
  bottom: { position: 'absolute', left: 12, right: 12 },
  hint: { alignSelf: 'center', backgroundColor: 'rgba(20,20,20,0.92)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1, borderColor: C.line },
  me: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#4F8CFF', borderWidth: 3, borderColor: '#fff' },
  pin: { width: 46, height: 46, borderRadius: 23, padding: 2, backgroundColor: '#3A3D3A', overflow: 'visible' },
  pinImg: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: C.bg },
  dot: { position: 'absolute', right: 0, top: 0, width: 13, height: 13, borderRadius: 7, backgroundColor: C.good, borderWidth: 2, borderColor: C.bg },
  tip: { width: 10, height: 10, backgroundColor: '#3A3D3A', transform: [{ rotate: '45deg' }], marginTop: -6 },
  peek: { backgroundColor: 'rgba(20,20,20,0.97)', borderRadius: 24, borderWidth: 1, borderColor: C.line },
  shade: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 8, backgroundColor: 'rgba(0,0,0,0.55)' },
  name: { color: C.chalk, fontSize: 17, fontWeight: '700' },
  meta: { color: C.mute, fontSize: 13 },
  tag: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  bagBar: { position: 'absolute', left: 12, right: 12, bottom: 12, height: 54, borderRadius: 27, backgroundColor: C.z, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, gap: 12 },
  bagT: { color: C.ink, fontWeight: '800', fontSize: 15, flexShrink: 1 },
});
