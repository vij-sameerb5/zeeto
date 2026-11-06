import { BadgeCheck, Bell, Bookmark, Heart, MapPin, MessageCircle, ScanLine, Send, ShoppingBag, Store, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { Dimensions, FlatList, Image, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, POSTS, VENDORS, ago, inr, type Category, type Post, type Story } from '@zeeto/core';
import { img } from '../media';
import { useNav } from '../nav';
import { useApp, useBagCount } from '../store';
import { C } from '../theme';
import { Btn, Face, Icon, Label, Pic } from '../ui';

const W = Dimensions.get('window').width;
const vendor = (id: string) => VENDORS.find((v) => v.id === id)!;

/** Home: stories and categories on top of an Instagram-style feed from local stalls. */
export default function Feed() {
  const nav = useNav();
  const top = useSafeAreaInsets().top;
  const bag = useBagCount();
  const follows = useApp((x) => x.follows);
  const [story, setStory] = useState<number | null>(null);
  const posts = [...POSTS].sort((a, b) => Number(follows.includes(b.vendorId)) - Number(follows.includes(a.vendorId)));
  const allStories = useApp((x) => x.stories);
  const unread = useApp((x) => x.inbox.filter((i) => !i.read).length);
  const [inbox, setInbox] = useState(false);
  const stories = [...allStories].sort((a, b) => Number(follows.includes(b.vendorId)) - Number(follows.includes(a.vendorId)));

  const header = (
    <View>
      <View style={[st.row, { paddingTop: top + 8, paddingHorizontal: 16, paddingBottom: 12 }]}>
        <View style={{ flex: 1 }}>
          <Label>Pickup near</Label>
          <View style={[st.row, { gap: 4, marginTop: 4 }]}><MapPin size={16} color={C.z} /><Text style={st.place} numberOfLines={1}>Kalbadevi</Text></View>
        </View>
        <Pressable onPress={() => nav.push({ name: 'scan' })} style={[st.iconBtn, { backgroundColor: C.z, borderColor: C.z }]} accessibilityLabel="Scan to pay"><ScanLine size={19} color={C.ink} /></Pressable>
        <Pressable onPress={() => setInbox(true)} style={st.iconBtn} accessibilityLabel="Notifications">
          <Bell size={19} color={C.chalk} />
          {unread > 0 && <View style={st.badge}><Text style={st.badgeT}>{unread}</Text></View>}
        </Pressable>
        <Pressable onPress={() => nav.push({ name: 'sell' })} style={st.iconBtn} accessibilityLabel="Seller mode"><Store size={19} color={C.chalk} /></Pressable>
        <Pressable onPress={() => nav.push({ name: 'bag' })} style={st.iconBtn} accessibilityLabel="Bag">
          <ShoppingBag size={19} color={C.chalk} />
          {bag > 0 && <View style={st.badge}><Text style={st.badgeT}>{bag}</Text></View>}
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingHorizontal: 16, paddingBottom: 14 }}>
        {stories.map((s, i) => (i === stories.findIndex((x) => x.vendorId === s.vendorId) &&
          <Pressable key={s.id} onPress={() => setStory(i)} style={{ alignItems: 'center', width: 70, gap: 6 }}>
            <Face media={vendor(s.vendorId).avatar} size={66} ring />
            <Text numberOfLines={1} style={{ color: C.mute, fontSize: 11 }}>{vendor(s.vendorId).name.split(' ')[0]}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
        <Label>Not just sabzi</Label>
        <View style={st.grid}>
          {(Object.keys(CATEGORIES) as Category[]).slice(0, 8).map((c) => (
            <Pressable key={c} onPress={() => { nav.setSearch(CATEGORIES[c].label); nav.setTab('explore'); }} style={st.cat}>
              <View style={st.catIcon}><Icon name={CATEGORIES[c].icon} size={22} color={C.z} /></View>
              <Text numberOfLines={1} style={{ color: C.mute, fontSize: 11 }}>{CATEGORIES[c].label}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={{ height: 1, backgroundColor: C.line, marginTop: 8 }} />
    </View>
  );

  return (
    <>
      <FlatList
        style={{ backgroundColor: C.bg }}
        data={posts}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => <PostCard p={item} />}
        initialNumToRender={3}
        windowSize={5}
        removeClippedSubviews
      />
      {story !== null && <StoryViewer list={stories} start={story} onClose={() => setStory(null)} />}
      <Inbox open={inbox} onClose={() => setInbox(false)} />
    </>
  );
}

function PostCard({ p }: { p: Post }) {
  const nav = useNav();
  const v = vendor(p.vendorId);
  const liked = useApp((x) => x.liked.includes(p.id));
  const saved = useApp((x) => x.saved.includes(p.id));
  const like = useApp((x) => x.like);
  const save = useApp((x) => x.save);
  const products = useApp((x) => x.products).filter((x) => p.productIds.includes(x.id));
  const [page, setPage] = useState(0);
  const lastTap = useRef(0);

  // Double tap on the photo likes it, like Instagram.
  const tap = () => {
    const now = Date.now();
    if (now - lastTap.current < 280 && !liked) like(p.id);
    lastTap.current = now;
  };

  return (
    <View style={{ paddingVertical: 14 }}>
      <Pressable onPress={() => nav.push({ name: 'stall', id: v.id })} style={[st.row, { paddingHorizontal: 14, gap: 10, marginBottom: 10 }]}>
        <Face media={v.avatar} size={36} ring={v.fresh} />
        <View style={{ flex: 1 }}>
          <View style={[st.row, { gap: 4 }]}><Text style={{ color: C.chalk, fontWeight: '700' }}>{v.name}</Text>{v.verified && <BadgeCheck size={14} color={C.z} />}</View>
          <Text style={{ color: C.dim, fontSize: 12 }}>{v.landmark}</Text>
        </View>
        {p.tag && <Text style={[st.tag, p.tag === 'fresh' ? { color: C.good, backgroundColor: C.goodSoft } : { color: C.z, backgroundColor: C.zSoft }]}>{p.tag === 'fresh' ? 'Fresh' : 'Offer'}</Text>}
      </Pressable>

      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / W))}>
        {p.media.map((m, i) => (
          <Pressable key={i} onPress={tap}><Pic media={m} style={{ width: W, height: W }} /></Pressable>
        ))}
      </ScrollView>
      {p.media.length > 1 && (
        <View style={[st.row, { justifyContent: 'center', gap: 5, marginTop: 8 }]}>
          {p.media.map((_, i) => <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i === page ? C.z : C.dim }} />)}
        </View>
      )}

      <View style={[st.row, { paddingHorizontal: 14, paddingTop: 10, gap: 16 }]}>
        <Pressable onPress={() => like(p.id)} hitSlop={8}><Heart size={24} color={liked ? C.hot : C.chalk} fill={liked ? C.hot : 'transparent'} /></Pressable>
        <MessageCircle size={23} color={C.chalk} />
        <Pressable onPress={() => Share.share({ message: `${v.name} on Zeeto: ${p.caption}` })} hitSlop={8}><Send size={22} color={C.chalk} /></Pressable>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => save(p.id)} hitSlop={8}><Bookmark size={23} color={C.chalk} fill={saved ? C.chalk : 'transparent'} /></Pressable>
      </View>
      <View style={{ paddingHorizontal: 14, paddingTop: 8, gap: 4 }}>
        <Text style={{ color: C.chalk, fontWeight: '700' }}>{(p.likes + (liked ? 1 : 0)).toLocaleString('en-IN')} likes</Text>
        <Text style={{ color: C.chalk, lineHeight: 20 }}><Text style={{ fontWeight: '700' }}>{v.name.split(' ')[0]} </Text>{p.caption}</Text>
        <Text style={{ color: C.dim, fontSize: 12 }}>{p.comments} comments · {ago(p.at)}</Text>
      </View>

      {products.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 14, paddingTop: 12 }}>
          {products.map((x) => (
            <Pressable key={x.id} onPress={() => nav.push({ name: 'stall', id: v.id })} style={st.shop}>
              <Pic media={x.image} style={{ width: 36, height: 36, borderRadius: 10 }} />
              <View>
                <Text style={{ color: C.chalk, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{x.name}</Text>
                <Text style={{ color: C.z, fontSize: 12, fontWeight: '800' }}>{inr(x.priceInr)} · Shop</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function StoryViewer({ list, start, onClose }: { list: Story[]; start: number; onClose: () => void }) {
  const nav = useNav();
  const { top, bottom } = useSafeAreaInsets();
  const [i, setI] = useState(start);
  const s = list[i];
  const v = vendor(s.vendorId);
  const next = () => (i < list.length - 1 ? setI(i + 1) : onClose());
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <Image source={img(s.media)} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />
        <View style={{ position: 'absolute', top: top + 8, left: 10, right: 10, flexDirection: 'row', gap: 4 }}>
          {list.map((x, j) => <View key={x.id} style={{ flex: 1, height: 3, borderRadius: 2, backgroundColor: j <= i ? '#fff' : 'rgba(255,255,255,0.3)' }} />)}
        </View>
        <View style={[st.row, { position: 'absolute', top: top + 22, left: 14, right: 14, gap: 10 }]}>
          <Face media={v.avatar} size={34} />
          <Text style={{ color: '#fff', fontWeight: '700', flex: 1 }}>{v.name} <Text style={{ fontWeight: '400', opacity: 0.7 }}>{ago(s.at)}</Text></Text>
          <Pressable onPress={onClose} hitSlop={10}><Text style={{ color: '#fff', fontSize: 26 }}>×</Text></Pressable>
        </View>
        <Pressable style={{ position: 'absolute', top: 80, bottom: 160, left: 0, width: '33%' }} onPress={() => setI(Math.max(0, i - 1))} />
        <Pressable style={{ position: 'absolute', top: 80, bottom: 160, right: 0, width: '67%' }} onPress={next} />
        <View style={{ position: 'absolute', left: 16, right: 16, bottom: bottom + 20, gap: 16 }}>
          <Text style={{ color: '#fff', fontSize: 30, fontWeight: '800', lineHeight: 36 }}>{s.text}</Text>
          <Btn title={`Shop ${v.name}`} onPress={() => { onClose(); nav.push({ name: 'stall', id: v.id }); }} />
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  note: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 18, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  row: { flexDirection: 'row', alignItems: 'center' },
  place: { color: C.chalk, fontWeight: '800', fontSize: 18 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.line2, alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  badge: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.z, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeT: { color: C.ink, fontSize: 10, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, rowGap: 14 },
  cat: { width: '25%', alignItems: 'center', gap: 6 },
  catIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  tag: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  shop: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 6, paddingRight: 12, borderRadius: 14, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, maxWidth: 220 },
});


/** Offers and order updates from stalls you follow. */
function Inbox({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNav();
  const items = useApp((x) => x.inbox);
  const read = useApp((x) => x.readInbox);
  const top = useSafeAreaInsets().top;
  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose} onShow={read}>
      <View style={{ flex: 1, backgroundColor: C.bg, paddingTop: top + 8 }}>
        <View style={[st.row, { paddingHorizontal: 16, paddingBottom: 12 }]}>
          <Text style={{ color: C.chalk, fontSize: 22, fontWeight: '800', flex: 1 }}>Notifications</Text>
          <Pressable onPress={onClose} style={st.iconBtn} accessibilityLabel="Close"><X size={19} color={C.chalk} /></Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
          {!items.length && <Text style={{ color: C.mute, textAlign: 'center', marginTop: 40 }}>Follow stalls to hear about fresh stock and offers.</Text>}
          {items.map((i) => {
            const v = vendor(i.vendorId);
            return (
              <Pressable key={i.id} onPress={() => { onClose(); nav.push({ name: 'stall', id: i.vendorId }); }} style={[st.note, !i.read && { borderColor: C.z }]}>
                <Face media={v.avatar} size={42} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: C.mute, fontSize: 12 }}>{v.name} · {ago(i.at)}{i.kind === 'order' ? ' · order' : ''}</Text>
                  <Text style={{ color: C.chalk, fontWeight: '700' }}>{i.title}</Text>
                  <Text style={{ color: C.mute, fontSize: 13 }}>{i.body}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}
