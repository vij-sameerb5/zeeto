import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { POINTS, REWARDS, TIERS, VENDORS, ago } from '@zeeto/core';
import { useApp } from '../store';
import { C } from '../theme';
import { Face, Label, Sim, s as ui } from '../ui';

export default function Points() {
  const top = useSafeAreaInsets().top;
  const points = useApp((x) => x.points);
  const tier = [...TIERS].reverse().find((t) => points >= t.at)!;
  const next = TIERS.find((t) => t.at > points);
  const pct = next ? (points - tier.at) / (next.at - tier.at) : 1;

  return (
    <ScrollView style={{ backgroundColor: C.bg }} contentContainerStyle={{ paddingTop: top + 12, paddingHorizontal: 16, paddingBottom: 32, gap: 16 }}>
      <View>
        <Label>Zeeto points</Label>
        <Text style={{ color: C.chalk, fontSize: 28, fontWeight: '800', letterSpacing: -0.8, marginTop: 4 }}>Shop local, earn more</Text>
      </View>

      <View style={[ui.card, { borderColor: C.z, backgroundColor: C.zSoft, gap: 6, paddingVertical: 22 }]}>
        <Text style={{ color: C.z, fontSize: 64, fontWeight: '900', letterSpacing: -3, textShadowColor: 'rgba(255,122,26,0.6)', textShadowRadius: 18 }}>{points}</Text>
        <Text style={{ color: C.chalk, fontWeight: '700' }}>{tier.name}</Text>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(250,248,243,0.1)', overflow: 'hidden', marginTop: 8 }}>
          <View style={{ width: `${Math.round(pct * 100)}%`, height: '100%', backgroundColor: C.z }} />
        </View>
        <Text style={{ color: C.mute, fontSize: 13 }}>{next ? `${next.at - points} points to ${next.name}` : 'Top tier reached'} · ₹10 = 1 point</Text>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <Label>Rewards</Label>
        <Sim />
      </View>
      {REWARDS.map((r) => {
        const v = VENDORS.find((x) => x.id === r.vendorId)!;
        const can = points >= r.cost;
        return (
          <View key={r.id} style={[ui.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
            <Face media={v.avatar} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.chalk, fontWeight: '700' }}>{r.label}</Text>
              <Text style={{ color: C.mute, fontSize: 13 }}>{v.name}</Text>
            </View>
            <Text style={{ color: can ? C.z : C.dim, fontWeight: '800' }}>{r.cost} pts</Text>
          </View>
        );
      })}

      <Label style={{ marginTop: 4 }}>History</Label>
      {POINTS.map((p) => (
        <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.chalk }}>{p.label}</Text>
            <Text style={{ color: C.dim, fontSize: 12 }}>{ago(p.at)}</Text>
          </View>
          <Text style={{ color: C.good, fontWeight: '700' }}>+{p.points}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
