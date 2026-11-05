import { LinearGradient } from 'expo-linear-gradient';
import { ImageBackground, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, VENDORS } from '@zeeto/core';
import { img } from '../media';
import { useNav } from '../nav';
import { C, mono } from '../theme';
import { Btn, Icon } from '../ui';

export default function Welcome() {
  const nav = useNav();
  const { top, bottom } = useSafeAreaInsets();
  const kinds = Object.values(CATEGORIES);
  return (
    <ImageBackground source={img('hero-tall')} style={{ flex: 1 }} resizeMode="cover">
      <LinearGradient colors={['rgba(10,10,10,0.55)', 'rgba(10,10,10,0.15)', 'rgba(10,10,10,0.92)', C.bg]} locations={[0, 0.3, 0.68, 1]} style={StyleSheet.absoluteFill} />
      <View style={[s.top, { paddingTop: top + 12 }]}>
        <View style={s.mark}><Text style={s.markT}>Z</Text></View>
        <Text style={s.where}>KALBADEVI · MUMBAI</Text>
      </View>

      <View style={[s.body, { paddingBottom: bottom + 20 }]}>
        <Text style={s.word}>zeeto<Text style={{ color: C.z }}>.</Text></Text>
        <Text style={s.lead}>Every street stall near you. Follow them, order for pickup, pay in USDT.</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 18 }}>
          {kinds.slice(0, 10).map((k) => (
            <View key={k.label} style={s.kind}><Icon name={k.icon} size={14} color={C.z} /><Text style={s.kindT}>{k.label}</Text></View>
          ))}
        </ScrollView>

        <Btn title="Explore the market" onPress={() => nav.reset({ name: 'tabs' })} right={<Text style={{ color: C.ink, fontSize: 18 }}>→</Text>} />
        <Btn
          title="I sell here"
          kind="line"
          style={{ marginTop: 10 }}
          onPress={() => nav.reset({ name: 'tabs' }, { name: 'sell' })}
        />
        <Text style={s.foot}>{VENDORS.length} stalls · demo data · built at ETHGlobal Mumbai</Text>
      </View>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
  mark: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.z, alignItems: 'center', justifyContent: 'center' },
  markT: { color: C.ink, fontWeight: '900', fontSize: 22 },
  where: { color: C.chalk, fontFamily: mono, fontSize: 11, letterSpacing: 2, opacity: 0.8 },
  body: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 20 },
  word: { color: C.chalk, fontSize: 92, fontWeight: '900', letterSpacing: -5, lineHeight: 96 },
  lead: { color: C.chalk, opacity: 0.85, fontSize: 18, lineHeight: 25, marginTop: 6, maxWidth: 340 },
  kind: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: 'rgba(20,20,20,0.8)', borderWidth: 1, borderColor: C.line2 },
  kindT: { color: C.chalk, fontSize: 13 },
  foot: { color: C.dim, fontFamily: mono, fontSize: 10, textAlign: 'center', marginTop: 16, letterSpacing: 1 },
});
