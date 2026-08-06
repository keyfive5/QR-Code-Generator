import React from 'react';
import { Linking, Modal, ScrollView, Text, View } from 'react-native';
import { Card, Divider, IconButton, Row, SectionLabel, Toggle } from '../components/ui';
import { Icon } from '../components/Icon';
import type { Settings } from '../store';
import { space, type } from '../theme';
import type { Palette } from '../theme';

const REPO = 'https://github.com/keyfive5/QR-Code-Generator';

type Props = {
  p: Palette;
  visible: boolean;
  onClose: () => void;
  settings: Settings;
  onSettingsChange: (s: Settings) => void;
  libraryCount: number;
  onClearLibrary: () => void;
  version: string;
};

function Para({ p, children }: { p: Palette; children: React.ReactNode }) {
  return (
    <Text style={{ ...type.body, color: p.textDim, lineHeight: 23, marginBottom: space.md }}>
      {children}
    </Text>
  );
}

export function AboutScreen({
  p,
  visible,
  onClose,
  settings,
  onSettingsChange,
  libraryCount,
  onClearLibrary,
  version,
}: Props) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: space.lg,
            paddingTop: space.lg,
            paddingBottom: space.md,
          }}
        >
          <Text style={{ ...type.title, color: p.text }}>About</Text>
          <IconButton p={p} icon="close" label="Close" onPress={onClose} />
        </View>

        <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl * 2, gap: space.lg }}>
          <Card p={p}>
            <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              <Icon name="shield" size={26} color={p.accent} />
              <Text style={{ ...type.title, color: p.text }}>The scan check</Text>
            </View>
            <View style={{ height: space.md }} />
            <Para p={p}>
              Most QR tools draw a code and hand it over. This one reads its own work back before
              you get it.
            </Para>
            <Para p={p}>
              Once the artwork is drawn — rounded modules, gradient, logo punched through the middle
              — the app samples that finished drawing the way a camera does, picking module centres
              and deciding light from dark. The result goes through a complete Reed-Solomon decode.
              If the payload does not come back byte for byte, you are told before you print
              anything.
            </Para>
            <Para p={p}>
              It also re-reads the code five times with the sampling grid nudged off true, because a
              real reader has to guess where the grid sits. And it counts every module your logo
              touches as unreadable, whatever your logo actually looks like, so the headroom it
              reports is a floor rather than a hope.
            </Para>
            <Divider p={p} />
            <View style={{ height: space.md }} />
            <Text style={{ ...type.caption, color: p.textFaint, lineHeight: 18 }}>
              The encoder is written from the ISO/IEC 18004 standard: all 40 versions, all four
              error-correction levels, cost-optimal mode segmentation and full mask scoring. Its
              output is checked module-for-module against an independent reference implementation
              across thousands of symbols.
            </Text>
          </Card>

          <Card p={p}>
            <SectionLabel p={p}>Privacy</SectionLabel>
            <Para p={p}>
              QR Forge has no servers. It makes no network requests of any kind — there is nothing
              to sign in to, no analytics, no tracking, and no way for your data to leave the phone,
              because there is no code in the app that could send it.
            </Para>
            <Para p={p}>
              Codes are static. They encode your content directly, so they keep working forever and
              cannot be switched off, redirected, or put behind a subscription later.
            </Para>
            <Text style={{ ...type.caption, color: p.textFaint, lineHeight: 18 }}>
              Your library, your logo images and your settings stay in the app's own storage on this
              device.
            </Text>
          </Card>

          <Card p={p} padded={false}>
            <View style={{ padding: space.lg, paddingBottom: 0 }}>
              <SectionLabel p={p}>Settings</SectionLabel>
            </View>
            <View style={{ paddingHorizontal: space.lg }}>
              <Toggle
                p={p}
                label="Save what I make to the library"
                value={settings.saveToLibrary}
                onChange={(v) => onSettingsChange({ ...settings, saveToLibrary: v })}
              />
              <Divider p={p} />
              <Toggle
                p={p}
                label="Haptics"
                value={settings.haptics}
                onChange={(v) => onSettingsChange({ ...settings, haptics: v })}
              />
              <Divider p={p} />
              <Row
                p={p}
                title="Export size"
                subtitle={`${settings.exportSize} x ${settings.exportSize} pixels for PNG. SVG and PDF are vector and stay sharp at any size.`}
                right={
                  <Text style={{ ...type.label, color: p.accent }}>
                    {settings.exportSize >= 4096 ? '4096' : settings.exportSize >= 2048 ? '2048' : '1024'}
                  </Text>
                }
                onPress={() =>
                  onSettingsChange({
                    ...settings,
                    exportSize:
                      settings.exportSize >= 4096 ? 1024 : settings.exportSize >= 2048 ? 4096 : 2048,
                  })
                }
              />
              <Divider p={p} />
              <Row
                p={p}
                title="Clear the library"
                subtitle={`${libraryCount} saved ${libraryCount === 1 ? 'code' : 'codes'}`}
                danger
                onPress={onClearLibrary}
              />
            </View>
            <View style={{ height: space.sm }} />
          </Card>

          <Card p={p} padded={false}>
            <View style={{ paddingHorizontal: space.lg }}>
              <Row
                p={p}
                title="Source code"
                subtitle="The engine, the scan check and its test suite are public."
                onPress={() => Linking.openURL(REPO).catch(() => {})}
              />
              <Divider p={p} />
              <Row
                p={p}
                title="Privacy policy"
                subtitle="Short version: nothing is collected."
                onPress={() => Linking.openURL(`${REPO}#privacy`).catch(() => {})}
              />
              <Divider p={p} />
              <Row p={p} title="Version" right={<Text style={{ ...type.label, color: p.textFaint }}>{version}</Text>} />
            </View>
          </Card>

          <Text
            style={{
              ...type.caption,
              color: p.textFaint,
              textAlign: 'center',
              lineHeight: 18,
              paddingHorizontal: space.lg,
            }}
          >
            QR Code is a registered trademark of Denso Wave Incorporated. QR Forge is not affiliated
            with Denso Wave.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}
