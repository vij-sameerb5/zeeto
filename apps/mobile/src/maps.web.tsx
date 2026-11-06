// Web-only stand-in for react-native-maps (used only when previewing the app in a browser).
import { View, type ViewProps } from 'react-native';
export default function MapView(p: ViewProps & Record<string, unknown>) { return <View {...p} style={[{ backgroundColor: '#141414' }, p.style as object]} />; }
export const Marker = (_: Record<string, unknown>) => null;
export const PROVIDER_GOOGLE = 'google';
