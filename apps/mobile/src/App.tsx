import { StatusBar } from 'expo-status-bar';
import { Compass, House, ReceiptText, Sparkles, Wallet as WalletIcon } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavContext, useNav, type Nav, type Route, type Tab } from './nav';
import Bag from './screens/Bag';
import Explore from './screens/Explore';
import Feed from './screens/Feed';
import OrderScreen from './screens/Order';
import Orders from './screens/Orders';
import Points from './screens/Points';
import Scan from './screens/Scan';
import Sell from './screens/Sell';
import Stall from './screens/Stall';
import Wallet from './screens/Wallet';
import Welcome from './screens/Welcome';
import { C } from './theme';

export default function App() {
  const [stack, setStack] = useState<Route[]>([{ name: 'welcome' }]);
  const [tab, setTab] = useState<Tab>('home');
  const [search, setSearch] = useState('');

  const nav = useMemo<Nav>(() => ({
    push: (r) => setStack((s) => [...s, r]),
    back: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
    reset: (...r) => setStack(r),
    tab,
    setTab,
    search,
    setSearch,
  }), [tab, search]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (stack.length > 1) { nav.back(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [stack.length, nav]);

  const top = stack[stack.length - 1];
  return (
    <SafeAreaProvider>
      <NavContext.Provider value={nav}>
        <StatusBar style="light" />
        <View style={{ flex: 1, backgroundColor: C.bg }}>
          {top.name === 'welcome' && <Welcome />}
          {top.name === 'tabs' && <Tabs />}
          {top.name === 'stall' && <Stall key={top.id} id={top.id} />}
          {top.name === 'bag' && <Bag />}
          {top.name === 'order' && <OrderScreen id={top.id} />}
          {top.name === 'sell' && <Sell />}
          {top.name === 'scan' && <Scan />}
        </View>
      </NavContext.Provider>
    </SafeAreaProvider>
  );
}

const TABS: { id: Tab; label: string; Icon: typeof Compass }[] = [
  { id: 'home', label: 'Home', Icon: House },
  { id: 'explore', label: 'Explore', Icon: Compass },
  { id: 'orders', label: 'Orders', Icon: ReceiptText },
  { id: 'points', label: 'Points', Icon: Sparkles },
  { id: 'wallet', label: 'Wallet', Icon: WalletIcon },
];

function Tabs() {
  const { tab, setTab } = useNav();
  const bottom = useSafeAreaInsets().bottom;
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {tab === 'home' && <Feed />}
        {tab === 'explore' && <Explore />}
        {tab === 'orders' && <Orders />}
        {tab === 'points' && <Points />}
        {tab === 'wallet' && <Wallet />}
      </View>
      <View style={[st.bar, { paddingBottom: Math.max(bottom, 10) }]}>
        {TABS.map(({ id, label, Icon }) => {
          const on = id === tab;
          return (
            <Pressable key={id} onPress={() => setTab(id)} style={st.item} accessibilityRole="tab" accessibilityState={{ selected: on }}>
              <Icon size={22} color={on ? C.z : C.dim} />
              <Text style={[st.label, { color: on ? C.chalk : C.dim }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  bar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.bg, paddingTop: 8 },
  item: { flex: 1, alignItems: 'center', gap: 3 },
  label: { fontSize: 11, fontWeight: '600' },
});
