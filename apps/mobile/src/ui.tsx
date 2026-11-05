import {
  Apple, BookOpen, Cake, Carrot, ChevronLeft, Coffee, Croissant, Fish, Flame, Flower2, Lightbulb, Milk, Minus, PenLine, Pill as PillIcon,
  Plus, Sandwich, Scissors, ShoppingBasket, Smartphone, Sparkles, UtensilsCrossed, Wrench, type LucideIcon,
} from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type TextProps, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { img } from './media';
import { useNav } from './nav';
import { C, mono } from './theme';

const ICONS: Record<string, LucideIcon> = {
  Apple, BookOpen, Cake, Carrot, Coffee, Croissant, Fish, Flame, Flower2, Lightbulb, Milk, PenLine, Pill: PillIcon, Sandwich, Scissors,
  ShoppingBasket, Smartphone, Sparkles, UtensilsCrossed, Wrench,
};
export const Icon = ({ name, size = 20, color = C.chalk }: { name: string; size?: number; color?: string }) => {
  const I = ICONS[name] ?? ShoppingBasket;
  return <I size={size} color={color} />;
};

export const T = ({ style, ...p }: TextProps & { style?: StyleProp<TextStyle> }) => <Text {...p} style={[s.t, style]} />;
export const Label = ({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) => <Text style={[s.label, style]}>{children}</Text>;

export function Btn({ title, onPress, kind = 'z', disabled, style, right }: { title: string; onPress?: () => void; kind?: 'z' | 'chalk' | 'line'; disabled?: boolean; style?: StyleProp<ViewStyle>; right?: ReactNode }) {
  const bg = kind === 'z' ? C.z : kind === 'chalk' ? C.chalk : 'transparent';
  const fg = kind === 'line' ? C.chalk : C.ink;
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [s.btn, { backgroundColor: bg, borderWidth: kind === 'line' ? 1 : 0, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }, style]}>
      <Text style={[s.btnT, { color: fg }]}>{title}</Text>
      {right}
    </Pressable>
  );
}

export const Pill = ({ title, on, onPress }: { title: string; on?: boolean; onPress?: () => void }) => (
  <Pressable onPress={onPress} style={[s.pill, on && { backgroundColor: C.z, borderColor: C.z }]}>
    <Text style={[s.pillT, on && { color: C.ink }]}>{title}</Text>
  </Pressable>
);

/** Round avatar; orange ring means the stall has something new today. */
export const Face = ({ media, size = 48, ring }: { media: string; size?: number; ring?: boolean }) => {
  // Explicit pixel size: on the new RN architecture an Image with only `flex: 1` keeps the photo's own width and spills out.
  const pad = ring ? 2.5 : 0;
  const inner = size - pad * 2;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, padding: pad, backgroundColor: ring ? C.z : 'transparent', overflow: 'hidden' }}>
      <Image source={img(media)} resizeMode="cover" style={{ width: inner, height: inner, borderRadius: inner / 2, borderWidth: ring ? 2 : 0, borderColor: C.bg }} />
    </View>
  );
};

export const Pic = ({ media, style }: { media: string; style?: StyleProp<any> }) => <Image source={img(media)} style={[{ backgroundColor: C.raised }, style]} resizeMode="cover" />;

export const Sim = () => (
  <View style={s.sim}><Text style={s.simT}>SIMULATED</Text></View>
);

export function Qty({ n, onChange }: { n: number; onChange: (n: number) => void }) {
  if (!n) return (
    <Pressable onPress={() => onChange(1)} style={s.add} hitSlop={6}><Plus size={16} color={C.ink} /><Text style={s.addT}>Add</Text></Pressable>
  );
  return (
    <View style={s.qty}>
      <Pressable onPress={() => onChange(n - 1)} hitSlop={8} style={s.qtyB}><Minus size={15} color={C.chalk} /></Pressable>
      <Text style={s.qtyN}>{n}</Text>
      <Pressable onPress={() => onChange(n + 1)} hitSlop={8} style={s.qtyB}><Plus size={15} color={C.chalk} /></Pressable>
    </View>
  );
}

/** Top bar for pushed screens. */
export function Bar({ title, right }: { title?: string; right?: ReactNode }) {
  const nav = useNav();
  const top = useSafeAreaInsets().top;
  return (
    <View style={[s.bar, { paddingTop: top + 6 }]}>
      <Pressable onPress={nav.back} style={s.round} hitSlop={8} accessibilityLabel="Back"><ChevronLeft size={22} color={C.chalk} /></Pressable>
      <Text style={s.barT} numberOfLines={1}>{title}</Text>
      <View style={{ minWidth: 40, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export const s = StyleSheet.create({
  t: { color: C.chalk, fontSize: 15 },
  label: { color: C.mute, fontFamily: mono, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  btn: { height: 52, borderRadius: 26, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, borderColor: C.line2 },
  btnT: { fontSize: 16, fontWeight: '700' },
  pill: { paddingHorizontal: 16, height: 38, borderRadius: 19, borderWidth: 1, borderColor: C.line2, justifyContent: 'center', backgroundColor: C.panel },
  pillT: { color: C.chalk, fontSize: 14, fontWeight: '600' },
  sim: { borderWidth: 1, borderColor: C.warn, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start' },
  simT: { color: C.warn, fontFamily: mono, fontSize: 9, letterSpacing: 1 },
  add: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.z, borderRadius: 16, height: 32, paddingHorizontal: 12 },
  addT: { color: C.ink, fontWeight: '700', fontSize: 13 },
  qty: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, height: 32, backgroundColor: C.raised, borderWidth: 1, borderColor: C.z },
  qtyB: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  qtyN: { color: C.chalk, fontWeight: '700', minWidth: 18, textAlign: 'center' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 8, backgroundColor: C.bg, gap: 8 },
  barT: { color: C.chalk, fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: C.panel, borderRadius: 22, borderWidth: 1, borderColor: C.line, padding: 16 },
});
