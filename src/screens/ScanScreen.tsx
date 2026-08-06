import React, { useCallback, useRef, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, Card, IconButton, SectionLabel, tapSuccess } from '../components/ui';
import { Icon } from '../components/Icon';
import { describePayload } from '../qr/payloads';
import { copyText } from '../export';
import { newId } from '../store';
import type { LibraryItem } from '../store';
import { radius, space, type } from '../theme';
import type { Palette } from '../theme';

type Props = {
  p: Palette;
  active: boolean;
  onSaved: (item: LibraryItem) => void;
  onRemake: (payload: string) => void;
};

export function ScanScreen({ p, active, onSaved, onRemake }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [result, setResult] = useState<string | null>(null);
  const lastScan = useRef(0);

  const onBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      const now = Date.now();
      if (now - lastScan.current < 1200) return;
      lastScan.current = now;
      setResult(data);
      tapSuccess();
    },
    [],
  );

  const save = useCallback(
    (payload: string) => {
      const described = describePayload(payload);
      onSaved({
        id: newId(),
        createdAt: Date.now(),
        source: 'scanned',
        typeId: 'raw',
        values: { raw: payload },
        payload,
        style: {},
        ecLevel: 'Q',
        title: described.title,
        subtitle: described.kind,
        favourite: false,
      });
      tapSuccess();
      Alert.alert('Saved', 'The scan is in your library.');
    },
    [onSaved],
  );

  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: p.bg }} />;
  }

  if (!permission.granted) {
    return (
      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        <Text style={{ ...type.display, color: p.text }}>Scan</Text>
        <Card p={p}>
          <Icon name="scan" size={30} color={p.accent} />
          <Text style={{ ...type.heading, color: p.text, marginTop: space.md }}>
            Camera access
          </Text>
          <Text style={{ ...type.body, color: p.textDim, marginTop: space.sm, lineHeight: 22 }}>
            The scanner reads a code and shows you exactly where it leads before anything opens.
            Nothing is uploaded and nothing leaves the device.
          </Text>
          <View style={{ height: space.lg }} />
          <Button p={p} label="Allow camera" icon="scan" onPress={() => requestPermission()} />
        </Card>
      </ScrollView>
    );
  }

  const described = result ? describePayload(result) : null;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.md }}>
        <Text style={{ ...type.display, color: p.text }}>Scan</Text>
        <Text style={{ ...type.caption, color: p.textFaint, marginTop: 1 }}>
          See where a code leads before you follow it
        </Text>
      </View>

      <View
        style={{
          marginHorizontal: space.lg,
          aspectRatio: 1,
          borderRadius: radius.xl,
          overflow: 'hidden',
          backgroundColor: '#000',
        }}
      >
        {active && !result && (
          <CameraView
            style={{ flex: 1 }}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onBarcodeScanned}
          />
        )}
        {result && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md }}>
            <Icon name="check" size={40} color={p.excellent} />
            <Text style={{ ...type.heading, color: '#FFFFFF' }}>Code read</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg }}>
        {described ? (
          <>
            <Card p={p}>
              <SectionLabel p={p}>{described.kind}</SectionLabel>
              <Text style={{ ...type.title, color: p.text }} numberOfLines={3}>
                {described.title}
              </Text>
              {described.detail && described.detail !== described.title ? (
                <Text
                  selectable
                  style={{ ...type.mono, color: p.textDim, marginTop: space.md, lineHeight: 18 }}
                >
                  {described.detail.length > 500
                    ? described.detail.slice(0, 500) + '…'
                    : described.detail}
                </Text>
              ) : null}

              {described.actionUrl ? (
                <View
                  style={{
                    flexDirection: 'row',
                    gap: space.sm,
                    alignItems: 'flex-start',
                    marginTop: space.md,
                    padding: space.md,
                    borderRadius: radius.md,
                    backgroundColor: p.surfaceAlt,
                  }}
                >
                  <Icon name="warning" size={15} color={p.risky} />
                  <Text style={{ ...type.caption, color: p.textDim, flex: 1, lineHeight: 17 }}>
                    Check the address above before opening it. A QR code can point anywhere, and the
                    printed sticker on top of it is not always the original.
                  </Text>
                </View>
              ) : null}
            </Card>

            <View style={{ gap: space.sm }}>
              {described.actionUrl ? (
                <Button
                  p={p}
                  label="Open"
                  icon="share"
                  onPress={() => {
                    Linking.openURL(described.actionUrl!).catch(() =>
                      Alert.alert('Could not open', 'No app on this device handles that link.'),
                    );
                  }}
                />
              ) : null}
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button
                  p={p}
                  label="Copy"
                  icon="copy"
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={() => {
                    copyText(result!).then(tapSuccess).catch(() => {});
                  }}
                />
                <Button
                  p={p}
                  label="Save"
                  icon="save"
                  variant="secondary"
                  style={{ flex: 1 }}
                  onPress={() => save(result!)}
                />
              </View>
              <Button
                p={p}
                label="Make my own version"
                icon="create"
                variant="secondary"
                onPress={() => onRemake(result!)}
              />
              <Button
                p={p}
                label="Scan another"
                variant="quiet"
                onPress={() => setResult(null)}
              />
            </View>
          </>
        ) : (
          <Text style={{ ...type.body, color: p.textFaint, textAlign: 'center', lineHeight: 22 }}>
            Point the camera at a QR code.{'\n'}Nothing opens until you say so.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
