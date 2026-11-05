import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../theme';
import { Bar, Btn } from '../ui';
import { WEB_URL, openWeb, zeetoPayLink } from '../web';

/** Scan a stall's QR and pay. Only Zeeto pay links open; anything else is refused. */
export default function Scan() {
  const [perm, ask] = useCameraPermissions();
  const [warn, setWarn] = useState('');
  const busy = useRef(false);
  const bottom = useSafeAreaInsets().bottom;

  const onCode = async ({ data }: { data: string }) => {
    if (busy.current) return;
    busy.current = true;
    const link = zeetoPayLink(data);
    if (!link) {
      setWarn('That isn’t a Zeeto payment QR. Don’t pay it.');
      setTimeout(() => { busy.current = false; }, 1500);
      return;
    }
    setWarn('');
    await openWeb(link);
    setTimeout(() => { busy.current = false; }, 800);
  };

  if (!WEB_URL) {
    return (
      <View style={st.wrap}><Bar title="Scan to pay" />
        <View style={st.center}><Text style={st.h}>Web link not set</Text><Text style={st.p}>Add EXPO_PUBLIC_WEB_URL (your deployed Zeeto web app) to apps/mobile/.env and restart Expo.</Text></View>
      </View>
    );
  }
  if (!perm) return <View style={st.wrap}><Bar title="Scan to pay" /></View>;
  if (!perm.granted) {
    return (
      <View style={st.wrap}><Bar title="Scan to pay" />
        <View style={st.center}><Text style={st.h}>Camera needed</Text><Text style={st.p}>Zeeto uses the camera only to read the stall’s QR code.</Text><Btn title="Allow camera" onPress={ask} /></View>
      </View>
    );
  }
  return (
    <View style={st.wrap}>
      <Bar title="Scan to pay" />
      <View style={{ flex: 1 }}>
        <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onCode} />
        <View style={st.frame} pointerEvents="none" />
        <View style={[st.hint, { bottom: bottom + 24 }]}>
          <Text style={st.hintT}>{warn || 'Point at the QR on the stall’s phone or sticker'}</Text>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  h: { color: C.chalk, fontSize: 22, fontWeight: '800' },
  p: { color: C.mute, textAlign: 'center', lineHeight: 21 },
  frame: { position: 'absolute', alignSelf: 'center', top: '22%', width: 250, height: 250, borderRadius: 28, borderWidth: 3, borderColor: C.z },
  hint: { position: 'absolute', left: 20, right: 20, backgroundColor: 'rgba(10,10,10,0.85)', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: C.line2 },
  hintT: { color: C.chalk, textAlign: 'center', fontWeight: '600' },
});
