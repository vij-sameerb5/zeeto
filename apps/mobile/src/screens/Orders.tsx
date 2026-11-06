import { FlatList, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VENDORS, ago, inr } from '@zeeto/core';
import { findVendor } from '../vendors';
import { useNav } from '../nav';
import { useMyOrders } from '../server';
import { C, mono } from '../theme';
import { Face, Label, s as ui } from '../ui';
import { STATUS } from './Order';

export default function Orders() {
  const nav = useNav();
  const top = useSafeAreaInsets().top;
  const orders = useMyOrders();
  return (
    <FlatList
      style={{ backgroundColor: C.bg }}
      data={orders}
      keyExtractor={(o) => o.id}
      contentContainerStyle={{ paddingTop: top + 12, paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
      ListHeaderComponent={
        <View style={{ marginBottom: 8 }}>
          <Label>Pickup orders</Label>
          <Text style={{ color: C.chalk, fontSize: 28, fontWeight: '800', letterSpacing: -0.8, marginTop: 4 }}>Your orders</Text>
        </View>
      }
      ListEmptyComponent={<Text style={{ color: C.mute, paddingVertical: 40, textAlign: 'center' }}>No orders yet.</Text>}
      renderItem={({ item: o }) => {
        const v = findVendor(o.vendorId)!;
        const st = STATUS[o.status];
        return (
          <Pressable onPress={() => nav.push({ name: 'order', id: o.id })} style={({ pressed }) => [ui.card, { flexDirection: 'row', gap: 12, alignItems: 'center', opacity: pressed ? 0.85 : 1 }]}>
            <Face media={v.avatar} size={48} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: C.chalk, fontWeight: '700' }} numberOfLines={1}>{v.name}</Text>
              <Text style={{ color: st.color, fontSize: 13 }}>{st.label}</Text>
              <Text style={{ color: C.dim, fontSize: 12 }}>{o.lines.length} item{o.lines.length > 1 ? 's' : ''} · {ago(o.at)}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text style={{ color: C.chalk, fontWeight: '800' }}>{inr(o.inr)}</Text>
              <Text style={{ color: C.mute, fontFamily: mono, fontSize: 12 }}>{o.code}</Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}
