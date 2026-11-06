import { LinearGradient } from 'expo-linear-gradient';
import { Check, LogIn, ShoppingBag, Store } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ImageBackground, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VENDORS } from '@zeeto/core';
import { img } from '../media';
import { useNav } from '../nav';
import { useSession } from '../session';
import { C, mono } from '../theme';
import { Btn } from '../ui';

type As = 'customer' | 'merchant';
const ROLES: { id: As; title: string; sub: string; Icon: typeof Store }[] = [
  { id: 'customer', title: 'I’m shopping', sub: 'Stalls near you, order ahead, pay in USDT. No gas fee.', Icon: ShoppingBag },
  { id: 'merchant', title: 'I run a stall or shop', sub: 'Take USDT, see orders, know your regulars.', Icon: Store },
];

/**
 * First screen: pick shopping or selling, then sign in or sign up (a new phone number makes a new account).
 * The pick only decides where the app opens; who may sell is checked by the server when the stall is created.
 */
export default function Welcome() {
  const nav = useNav();
  const { top, bottom } = useSafeAreaInsets();
  const me = useSession();
  const [as, setAs] = useState<As | null>(me.startAs);
  const [busy, setBusy] = useState(false);
  const forwarded = useRef(false);

  const go = (r: As) => {
    forwarded.current = true;
    nav.reset(...(r === 'merchant' ? [{ name: 'tabs' as const }, { name: 'sell' as const }] : [{ name: 'tabs' as const }]));
  };

  // Came back to the app with a choice already made: skip this screen.
  useEffect(() => {
    const done = () => { const s = useSession.getState(); if (!forwarded.current && s.startAs) go(s.startAs); };
    if (useSession.persist.hasHydrated()) done();
    return useSession.persist.onFinishHydration(done);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (r: As) => setAs(r);
  const signIn = async () => {
    if (!as) return;
    setBusy(true);
    const r = await me.link().catch(() => 'cancel' as const);
    setBusy(false);
    if (r === 'no-web') return Alert.alert('Sign-in isn’t set up', 'Add EXPO_PUBLIC_WEB_URL (your Vercel URL) to apps/mobile/.env and restart Expo. You can look around for now.');
    if (r === 'ok') { me.setStartAs(as); go(as); }
  };
  const skip = () => { if (as) me.setStartAs(as); go(as ?? 'customer'); };

  return (
    <ImageBackground source={img('hero-tall')} style={{ flex: 1 }} resizeMode="cover">
      <LinearGradient colors={['rgba(10,10,10,0.55)', 'rgba(10,10,10,0.35)', 'rgba(10,10,10,0.95)', C.bg]} locations={[0, 0.25, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <View style={[s.top, { paddingTop: top + 12 }]}>
        <View style={s.mark}><Text style={s.markT}>Z</Text></View>
        <Text style={s.where}>KALBADEVI · MUMBAI</Text>
      </View>

      <View style={[s.body, { paddingBottom: bottom + 20 }]}>
        <Text style={s.word}>zeeto<Text style={{ color: C.z }}>.</Text></Text>
        <Text style={s.step}>STEP {as ? 2 : 1} OF 2</Text>
        <Text style={s.lead}>{as ? 'Sign in or create your account' : 'How will you use Zeeto?'}</Text>

        <View style={{ gap: 10, marginTop: 14 }} accessibilityRole="radiogroup">
          {ROLES.map(({ id, title, sub, Icon }) => {
            const on = as === id;
            return (
              <Pressable key={id} onPress={() => pick(id)} accessibilityRole="radio" accessibilityState={{ checked: on }}
                style={[s.role, on && { borderColor: C.z, backgroundColor: 'rgba(255,122,26,0.12)' }, as && !on && { opacity: 0.55 }]}>
                <View style={[s.roleIcon, on && { backgroundColor: C.z }]}><Icon size={20} color={on ? C.ink : C.z} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.chalk, fontWeight: '800', fontSize: 16 }}>{title}</Text>
                  <Text style={{ color: C.mute, fontSize: 13, marginTop: 2 }}>{sub}</Text>
                </View>
                {on && <Check size={18} color={C.z} />}
              </Pressable>
            );
          })}
        </View>

        {as && (
          <>
            <Text style={s.note}>Use your phone number or email. New here? The same step makes your account and a wallet for you, no seed phrase.</Text>
            <Btn title={busy ? 'Opening…' : 'Continue with phone or email'} onPress={signIn} disabled={busy} right={busy ? <ActivityIndicator color={C.ink} /> : <LogIn size={16} color={C.ink} />} />
          </>
        )}
        <Pressable onPress={skip} hitSlop={10} style={{ alignSelf: 'center', marginTop: 14 }}>
          <Text style={{ color: C.mute, fontSize: 14 }}>{as ? 'Skip for now, just look around →' : 'Just look around →'}</Text>
        </Pressable>
        <Text style={s.foot}>{VENDORS.length}+ stalls · Whitechain testnet · ETHGlobal Mumbai</Text>
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
  word: { color: C.chalk, fontSize: 72, fontWeight: '900', letterSpacing: -4, lineHeight: 76 },
  step: { color: C.z, fontFamily: mono, fontSize: 11, letterSpacing: 2, marginTop: 8 },
  lead: { color: C.chalk, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginTop: 4 },
  role: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: C.line2, backgroundColor: 'rgba(20,20,20,0.85)' },
  roleIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,122,26,0.15)' },
  note: { color: C.mute, fontSize: 13, lineHeight: 18, marginVertical: 14 },
  foot: { color: C.dim, fontFamily: mono, fontSize: 10, textAlign: 'center', marginTop: 16, letterSpacing: 1 },
});
