import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Appearance,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { Icon } from './src/components/Icon';
import type { IconName } from './src/components/Icon';
import { CreateScreen } from './src/screens/CreateScreen';
import { DesignSheet } from './src/screens/DesignSheet';
import { ScanScreen } from './src/screens/ScanScreen';
import { LibraryScreen } from './src/screens/LibraryScreen';
import { AboutScreen } from './src/screens/AboutScreen';
import { DEFAULT_STYLE } from './src/qr/render';
import type { RenderStyle } from './src/qr/render';
import type { EcLevel } from './src/qr/spec';
import type { Values } from './src/qr/payloads';
import { contentTypeById } from './src/qr/payloads';
import {
  DEFAULT_SETTINGS,
  loadLibrary,
  loadSettings,
  saveLibrary,
  saveSettings,
} from './src/store';
import type { LibraryItem, Settings } from './src/store';
import { palettes, radius, space, type } from './src/theme';
import { PRESETS } from './src/presets';
import { tap } from './src/components/ui';
import { currentShot } from './src/shots';

type Tab = 'create' | 'scan' | 'library';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'create', label: 'Create', icon: 'create' },
  { id: 'scan', label: 'Scan', icon: 'scan' },
  { id: 'library', label: 'Library', icon: 'library' },
];

function Shell() {
  const insets = useSafeAreaInsets();
  const system = useColorScheme();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>('create');
  const [designOpen, setDesignOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const [typeId, setTypeId] = useState('link');
  const [values, setValues] = useState<Record<string, Values>>({
    wifi: { security: 'WPA' },
    social: { network: 'instagram' },
    appstore: { store: 'ios' },
    crypto: { chain: 'bitcoin' },
  });
  const [style, setStyle] = useState<Partial<RenderStyle>>({
    ...DEFAULT_STYLE,
    ...PRESETS[1].style,
  });
  const [ecLevel, setEcLevel] = useState<EcLevel>('Q');

  const [expandHealth, setExpandHealth] = useState(false);

  useEffect(() => {
    (async () => {
      const [s, l] = await Promise.all([loadSettings(), loadLibrary()]);
      setSettings(s);
      setEcLevel(s.defaultEcLevel);
      setLibrary(l);

      // Web-only deterministic states, used for visual review and store
      // screenshots. There is no query string on a device.
      const shot = currentShot();
      if (shot) {
        if (shot.tab) setTab(shot.tab);
        if (shot.typeId) setTypeId(shot.typeId);
        if (shot.values) setValues((prev) => ({ ...prev, ...shot.values }));
        if (shot.style) setStyle(shot.style);
        if (shot.ecLevel) setEcLevel(shot.ecLevel);
        if (shot.library) setLibrary(shot.library);
        if (shot.expandHealth) setExpandHealth(true);
        if (shot.openDesign) setTimeout(() => setDesignOpen(true), 400);
      }
      setReady(true);
    })();
  }, []);

  const theme = settings.theme === 'system' ? (system ?? 'dark') : settings.theme;
  const p = theme === 'light' ? palettes.light : palettes.dark;

  const updateSettings = useCallback((next: Settings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  const addItem = useCallback((item: LibraryItem) => {
    setLibrary((prev) => {
      // Re-saving the same payload with the same look just refreshes its place
      // in the list rather than filling the library with near-duplicates.
      const withoutDuplicate = prev.filter(
        (i) => !(i.payload === item.payload && i.source === item.source && !i.favourite),
      );
      const next = [item, ...withoutDuplicate];
      saveLibrary(next);
      return next;
    });
  }, []);

  const deleteItem = useCallback((id: string) => {
    setLibrary((prev) => {
      const next = prev.filter((i) => i.id !== id);
      saveLibrary(next);
      return next;
    });
  }, []);

  const toggleFavourite = useCallback((id: string) => {
    setLibrary((prev) => {
      const next = prev.map((i) => (i.id === id ? { ...i, favourite: !i.favourite } : i));
      saveLibrary(next);
      return next;
    });
  }, []);

  const openItem = useCallback((item: LibraryItem) => {
    setTypeId(item.typeId);
    setValues((prev) => ({ ...prev, [item.typeId]: item.values }));
    if (Object.keys(item.style).length) setStyle(item.style);
    setEcLevel(item.ecLevel);
    setTab('create');
  }, []);

  const remake = useCallback((payload: string) => {
    setTypeId('raw');
    setValues((prev) => ({ ...prev, raw: { raw: payload } }));
    setTab('create');
  }, []);

  const setValuesFor = useCallback((id: string, v: Values) => {
    setValues((prev) => ({ ...prev, [id]: v }));
  }, []);

  const payload = useMemo(() => {
    try {
      return contentTypeById(typeId).build(values[typeId] ?? {});
    } catch {
      return '';
    }
  }, [typeId, values]);

  const version = (Constants.expoConfig?.version as string) ?? '1.0.0';

  if (!ready) {
    return <View style={{ flex: 1, backgroundColor: p.bg }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: insets.top }}>
      <StatusBar barStyle={theme === 'light' ? 'dark-content' : 'light-content'} />

      <View style={{ flex: 1 }}>
        {/* All three tabs stay mounted so switching does not lose form state
            or restart the camera warm-up. */}
        <View style={[StyleSheet.absoluteFill, { display: tab === 'create' ? 'flex' : 'none' }]}>
          <CreateScreen
            p={p}
            settings={settings}
            style={style}
            ecLevel={ecLevel}
            typeId={typeId}
            onTypeChange={setTypeId}
            values={values}
            onValuesChange={setValuesFor}
            onOpenDesign={() => setDesignOpen(true)}
            onOpenAbout={() => setAboutOpen(true)}
            onSaved={addItem}
            expandHealth={expandHealth}
          />
        </View>
        <View style={[StyleSheet.absoluteFill, { display: tab === 'scan' ? 'flex' : 'none' }]}>
          <ScanScreen p={p} active={tab === 'scan'} onSaved={addItem} onRemake={remake} />
        </View>
        <View style={[StyleSheet.absoluteFill, { display: tab === 'library' ? 'flex' : 'none' }]}>
          <LibraryScreen
            p={p}
            items={library}
            onOpen={openItem}
            onDelete={deleteItem}
            onToggleFavourite={toggleFavourite}
          />
        </View>
      </View>

      <View
        style={{
          flexDirection: 'row',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: p.border,
          backgroundColor: p.surface,
          paddingBottom: Math.max(insets.bottom, space.sm),
          paddingTop: space.sm,
        }}
      >
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <Pressable
              key={t.id}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t.label}
              onPress={() => {
                if (settings.haptics) tap();
                setTab(t.id);
              }}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                gap: 3,
                paddingVertical: 5,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Icon name={t.icon} size={23} color={active ? p.accent : p.textFaint} filled={active} />
              <Text
                style={{
                  ...type.caption,
                  fontSize: 10.5,
                  color: active ? p.accent : p.textFaint,
                }}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <DesignSheet
        p={p}
        visible={designOpen}
        onClose={() => setDesignOpen(false)}
        payload={payload}
        style={style}
        onStyleChange={setStyle}
        ecLevel={ecLevel}
        onEcChange={(e) => {
          setEcLevel(e);
          updateSettings({ ...settings, defaultEcLevel: e });
        }}
      />

      <AboutScreen
        p={p}
        visible={aboutOpen}
        onClose={() => setAboutOpen(false)}
        settings={settings}
        onSettingsChange={updateSettings}
        libraryCount={library.length}
        onClearLibrary={() => {
          setLibrary([]);
          saveLibrary([]);
        }}
        version={version}
      />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
}
