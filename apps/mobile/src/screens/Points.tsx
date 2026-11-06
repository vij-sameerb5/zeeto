import { Gift, Sparkles, WalletCards } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { REWARDS, VENDORS, ago, loyaltyCards } from '@zeeto/core';
import { findVendor } from '../vendors';
import { useApp } from '../store';
import { useMyOrders } from '../server';
import { C, mono } from '../theme';
import { Face, Label, s as ui } from '../ui';

/** Loyalty: one card per stall. Points earned at a stall are spent only there; visits set the tier. */
export default function Points() {
  const top = useSafeAreaInsets().top;
  const local = useApp((x) => x.history);
  const orders = useMyOrders();
  // Points from real (server) orders: ₹10 = 1 point at that stall, same rule as the website.
  const history = useMemo(() => [
    ...orders.filter((o) => o.server && ['paid', 'accepted', 'ready', 'done', 'part-refunded'].includes(o.status)).map((o) => ({ id: `srv-${o.id}`, label: `Order ${o.code}`, points: o.points, at: o.at, vendorId: o.vendorId })),
    ...local,
  ], [orders, local]);
  const redeem = useApp((x) => x.redeem);
  const cards = useMemo(() => loyaltyCards(history, orders), [history, orders]);
  const [open, setOpen] = useState<string | null>(cards[0]?.vendorId ?? null);

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ paddingTop: top + 12, paddingHorizontal: 16, paddingBottom: 32, gap: 14 }}>
      <View>
        <Label>Loyalty cards</Label>
        <Text style={{ color: C.chalk, fontSize: 28, fontWeight: '800', letterSpacing: -0.8, marginTop: 4 }}>One card per stall</Text>
        <Text style={{ color: C.mute, marginTop: 4 }}>₹10 = 1 point at that stall. Spend it there.</Text>
      </View>

      {!cards.length && <Text style={{ color: C.mute, textAlign: 'center', marginTop: 30 }}>Pay at any stall to get its card.</Text>}
      {cards.map((c) => {
        const v = findVendor(c.vendorId);
        if (!v) return null;
        const on = open === c.vendorId;
        const pct = c.next ? Math.min(1, c.visits / c.next.at) : 1;
        const rewards = REWARDS.filter((r) => r.vendorId === c.vendorId);
        return (
          <View key={c.vendorId} style={[ui.card, { padding: 0, overflow: 'hidden' }, on && { borderColor: C.z }]}>
            <Pressable onPress={() => setOpen(on ? null : c.vendorId)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: C.zSoft }}>
              <Face media={v.avatar} size={50} ring />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: C.chalk, fontWeight: '800', fontSize: 16 }} numberOfLines={1}>{v.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><Sparkles size={13} color={C.z} /><Text style={{ color: C.mute, fontSize: 13 }}>{c.tier} · {c.visits} {c.visits === 1 ? 'visit' : 'visits'}</Text></View>
                <View style={{ height: 5, borderRadius: 3, backgroundColor: 'rgba(250,248,243,0.1)', overflow: 'hidden', marginTop: 4 }}><View style={{ width: `${Math.round(pct * 100)}%`, height: '100%', backgroundColor: C.z }} /></View>
                <Text style={{ color: C.dim, fontSize: 11 }}>{c.next ? `${c.next.at - c.visits} more to ${c.next.name}` : 'Top tier here'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: C.z, fontSize: 30, fontWeight: '900' }}>{c.points}</Text>
                <Text style={{ color: C.mute, fontSize: 11 }}>points here</Text>
              </View>
            </Pressable>
            {on && (
              <View style={{ padding: 16, gap: 10 }}>
                {rewards.length ? rewards.map((r) => {
                  const can = c.points >= r.cost;
                  return (
                    <View key={r.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.raised, borderRadius: 14, padding: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: C.chalk, fontWeight: '700' }}>{r.label}</Text>
                        <Text style={{ color: C.mute, fontSize: 12 }}>{can ? 'Ready to use' : `${r.cost - c.points} more points`}</Text>
                      </View>
                      <Pressable disabled={!can} onPress={() => Alert.alert(`Redeem ${r.label}?`, `Uses ${r.cost} of your ${v.name} points.`, [{ text: 'Not now', style: 'cancel' }, { text: 'Redeem', onPress: () => { const ok = redeem(r.label, r.cost, r.vendorId); Alert.alert(ok ? 'Redeemed' : 'Not enough points', ok ? `Show this screen at ${v.name}.` : 'Points only count at the stall that gave them.'); } }])} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: can ? C.z : 'transparent', borderWidth: can ? 0 : 1, borderColor: C.line2, borderRadius: 16, paddingHorizontal: 12, height: 34 }}>
                        <Gift size={14} color={can ? C.ink : C.dim} /><Text style={{ color: can ? C.ink : C.dim, fontWeight: '800' }}>{r.cost}</Text>
                      </Pressable>
                    </View>
                  );
                }) : <Text style={{ color: C.mute }}>{v.name} hasn’t set rewards yet. Points keep adding up.</Text>}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, backgroundColor: '#000', borderWidth: 1, borderColor: C.line2, height: 46, opacity: 0.9 }}>
                  <WalletCards size={17} color={C.chalk} /><Text style={{ color: C.chalk, fontWeight: '700' }}>Add card to Apple Wallet</Text>
                  <Text style={{ color: C.z, fontFamily: mono, fontSize: 10, backgroundColor: C.zSoft, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, overflow: 'hidden' }}>SOON</Text>
                </View>
                {history.filter((h) => h.vendorId === c.vendorId).slice(0, 5).map((h) => (
                  <View key={h.id} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: C.mute, fontSize: 13, flex: 1 }} numberOfLines={1}>{h.label} · {ago(h.at)}</Text>
                    <Text style={{ color: h.points >= 0 ? C.good : C.mute, fontWeight: '700' }}>{h.points >= 0 ? '+' : ''}{h.points}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
      <Text style={{ color: C.dim, fontSize: 12, textAlign: 'center' }}>Points can’t move between stalls: each stall pays for its own rewards.</Text>
    </ScrollView>
  );
}
