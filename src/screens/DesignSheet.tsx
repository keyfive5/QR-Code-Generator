import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { QrCanvas } from '../components/QrCanvas';
import {
  Button,
  Card,
  ChipRow,
  Divider,
  IconButton,
  SectionLabel,
  SliderRow,
  Swatches,
  Toggle,
  tapSoft,
} from '../components/ui';
import { encodeText } from '../qr/encode';
import { buildArtwork } from '../qr/render';
import type { RenderStyle } from '../qr/render';
import { maxSafeLogoScale, verifyArtwork } from '../qr/verify';
import type { EcLevel } from '../qr/spec';
import { BACKGROUND_SWATCHES, FOREGROUND_SWATCHES, GRADIENT_PRESETS, PRESETS } from '../presets';
import { gradeColor, radius, space, type } from '../theme';
import type { Palette } from '../theme';

const MODULE_STYLES = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'classy', label: 'Classy' },
  { value: 'fluid', label: 'Fluid' },
  { value: 'dot', label: 'Dot' },
  { value: 'diamond', label: 'Diamond' },
];

const EYE_FRAMES = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'circle', label: 'Circle' },
  { value: 'leaf', label: 'Leaf' },
  { value: 'shield', label: 'Shield' },
];

const EYE_BALLS = [
  { value: 'square', label: 'Square' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'circle', label: 'Circle' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'leaf', label: 'Leaf' },
];

const EC_LEVELS: { value: EcLevel; label: string }[] = [
  { value: 'L', label: 'L · 7%' },
  { value: 'M', label: 'M · 15%' },
  { value: 'Q', label: 'Q · 25%' },
  { value: 'H', label: 'H · 30%' },
];

type Props = {
  p: Palette;
  visible: boolean;
  onClose: () => void;
  payload: string;
  style: Partial<RenderStyle>;
  onStyleChange: (s: Partial<RenderStyle>) => void;
  ecLevel: EcLevel;
  onEcChange: (e: EcLevel) => void;
};

export function DesignSheet({
  p,
  visible,
  onClose,
  payload,
  style,
  onStyleChange,
  ecLevel,
  onEcChange,
}: Props) {
  const [fitting, setFitting] = useState(false);

  const sample = payload.trim() || 'https://qrforge.app';

  const preview = useMemo(() => {
    try {
      const qr = encodeText(sample, { ecLevel });
      const art = buildArtwork(qr, style);
      return { art, report: verifyArtwork(art, sample) };
    } catch {
      return { art: null, report: null };
    }
  }, [sample, ecLevel, style]);

  const set = useCallback(
    (patch: Partial<RenderStyle>) => onStyleChange({ ...style, ...patch }),
    [onStyleChange, style],
  );

  const pickLogo = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photos access needed', 'QR Forge needs permission to read the image you pick.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.9,
      base64: true,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    // Inlining the image as a data URI keeps the exported SVG self-contained.
    const href = asset.base64
      ? `data:image/${(asset.mimeType ?? 'image/png').split('/')[1] ?? 'png'};base64,${asset.base64}`
      : asset.uri;
    set({ logo: { scale: 0.18, padding: 1, shape: 'rounded', href } });
  }, [set]);

  const fitLogo = useCallback(() => {
    if (!style.logo) return;
    setFitting(true);
    // Deferred so the button's pressed state paints before the search runs.
    setTimeout(() => {
      try {
        const qr = encodeText(sample, { ecLevel });
        const best = maxSafeLogoScale(
          (scale) => buildArtwork(qr, { ...style, logo: { ...style.logo!, scale } }),
          sample,
        );
        set({ logo: { ...style.logo!, scale: best } });
      } finally {
        setFitting(false);
      }
    }, 30);
  }, [ecLevel, sample, set, style]);

  const gradientOn = !!style.gradient;
  const report = preview.report;

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
          <Text style={{ ...type.title, color: p.text }}>Design</Text>
          <IconButton p={p} icon="close" label="Close design" onPress={onClose} />
        </View>

        {/* The preview and its verdict stay pinned so the effect of every
            control is visible without scrolling back up. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.lg,
            marginHorizontal: space.lg,
            padding: space.md,
            borderRadius: radius.lg,
            backgroundColor: p.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: p.border,
          }}
        >
          <View style={{ borderRadius: radius.sm, overflow: 'hidden', backgroundColor: p.paper }}>
            {preview.art && <QrCanvas artwork={preview.art} size={92} />}
          </View>
          <View style={{ flex: 1 }}>
            {report && (
              <>
                <Text style={{ ...type.heading, color: gradeColor(p, report.grade) }}>
                  {report.decodes ? `Verified · ${report.score}/100` : "Won't scan"}
                </Text>
                <Text style={{ ...type.caption, color: p.textDim, marginTop: 3, lineHeight: 16 }} numberOfLines={3}>
                  {report.warnings[0] ??
                    `${Math.round((1 - report.budgetUsed) * 100)}% damage headroom, ${Math.round(report.inkCoverage * 100)}% mark strength.`}
                </Text>
              </>
            )}
          </View>
        </View>

        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 }}>
          <View>
            <SectionLabel p={p}>Presets</SectionLabel>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: space.md, paddingRight: space.lg, paddingVertical: 2 }}
            >
              {PRESETS.map((preset) => {
                const art = (() => {
                  try {
                    return buildArtwork(encodeText('https://qrforge.app', { ecLevel: 'M' }), preset.style);
                  } catch {
                    return null;
                  }
                })();
                return (
                  <Pressable
                    key={preset.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Preset ${preset.name}`}
                    onPress={() => {
                      tapSoft();
                      onStyleChange({ ...style, ...preset.style });
                    }}
                    style={{ alignItems: 'center', gap: 6 }}
                  >
                    <View
                      style={{
                        borderRadius: radius.md,
                        overflow: 'hidden',
                        borderWidth: 1.5,
                        borderColor: p.border,
                        backgroundColor: p.paper,
                      }}
                    >
                      {art && <QrCanvas artwork={art} size={62} />}
                    </View>
                    <Text style={{ ...type.caption, fontSize: 11, color: p.textDim }}>{preset.name}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <Card p={p}>
            <SectionLabel p={p}>Module shape</SectionLabel>
            <View style={{ marginHorizontal: -space.lg, paddingLeft: space.lg }}>
              <ChipRow
                p={p}
                compact
                options={MODULE_STYLES}
                value={style.moduleStyle ?? 'square'}
                onChange={(v) => set({ moduleStyle: v as RenderStyle['moduleStyle'] })}
              />
            </View>
            <View style={{ height: space.lg }} />
            <SectionLabel p={p}>Corner frame</SectionLabel>
            <View style={{ marginHorizontal: -space.lg, paddingLeft: space.lg }}>
              <ChipRow
                p={p}
                compact
                options={EYE_FRAMES}
                value={style.eyeFrameStyle ?? 'square'}
                onChange={(v) => set({ eyeFrameStyle: v as RenderStyle['eyeFrameStyle'] })}
              />
            </View>
            <View style={{ height: space.lg }} />
            <SectionLabel p={p}>Corner centre</SectionLabel>
            <View style={{ marginHorizontal: -space.lg, paddingLeft: space.lg }}>
              <ChipRow
                p={p}
                compact
                options={EYE_BALLS}
                value={style.eyeBallStyle ?? 'square'}
                onChange={(v) => set({ eyeBallStyle: v as RenderStyle['eyeBallStyle'] })}
              />
            </View>
          </Card>

          <Card p={p}>
            <SectionLabel p={p}>Code colour</SectionLabel>
            <View style={{ marginHorizontal: -space.lg, paddingLeft: space.lg }}>
              <Swatches
                p={p}
                colors={FOREGROUND_SWATCHES}
                value={style.foreground ?? '#000000'}
                onChange={(c) => set({ foreground: c, gradient: undefined })}
              />
            </View>
            <View style={{ height: space.lg }} />
            <SectionLabel p={p}>Background</SectionLabel>
            <View style={{ marginHorizontal: -space.lg, paddingLeft: space.lg }}>
              <Swatches
                p={p}
                colors={BACKGROUND_SWATCHES}
                value={style.background ?? '#FFFFFF'}
                onChange={(c) => set({ background: c })}
              />
            </View>
            <Divider p={p} />
            <Toggle
              p={p}
              label="Gradient"
              value={gradientOn}
              onChange={(on) =>
                set({
                  gradient: on
                    ? { type: 'linear', angle: 45, stops: GRADIENT_PRESETS[0].stops }
                    : undefined,
                })
              }
            />
            {gradientOn && style.gradient && (
              <>
                <View style={{ marginHorizontal: -space.lg, paddingLeft: space.lg }}>
                  <ChipRow
                    p={p}
                    compact
                    options={GRADIENT_PRESETS.map((g) => ({ value: g.name, label: g.name }))}
                    value={
                      GRADIENT_PRESETS.find(
                        (g) => g.stops[0].color === style.gradient?.stops[0]?.color,
                      )?.name ?? ''
                    }
                    onChange={(name) => {
                      const g = GRADIENT_PRESETS.find((x) => x.name === name);
                      if (g) set({ gradient: { ...style.gradient!, stops: g.stops } });
                    }}
                  />
                </View>
                <View style={{ height: space.md }} />
                <ChipRow
                  p={p}
                  compact
                  options={[
                    { value: 'linear', label: 'Linear' },
                    { value: 'radial', label: 'Radial' },
                  ]}
                  value={style.gradient.type}
                  onChange={(t) =>
                    set({ gradient: { ...style.gradient!, type: t as 'linear' | 'radial' } })
                  }
                />
                {style.gradient.type === 'linear' && (
                  <View style={{ marginTop: space.md }}>
                    <SliderRow
                      p={p}
                      label="Angle"
                      value={style.gradient.angle}
                      display={`${Math.round(style.gradient.angle)}°`}
                      min={0}
                      max={360}
                      step={15}
                      onChange={(angle) => set({ gradient: { ...style.gradient!, angle } })}
                    />
                  </View>
                )}
              </>
            )}
          </Card>

          <Card p={p}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <SectionLabel p={p} style={{ marginBottom: 0 }}>
                Logo
              </SectionLabel>
              {style.logo?.href ? (
                <IconButton
                  p={p}
                  icon="trash"
                  label="Remove logo"
                  tone={p.fails}
                  onPress={() => set({ logo: undefined })}
                />
              ) : null}
            </View>
            <View style={{ height: space.md }} />
            {style.logo?.href ? (
              <>
                <SliderRow
                  p={p}
                  label="Size"
                  value={style.logo.scale}
                  display={`${Math.round(style.logo.scale * 100)}% of width`}
                  min={0.06}
                  max={0.36}
                  step={0.01}
                  onChange={(scale) => set({ logo: { ...style.logo!, scale } })}
                />
                <SliderRow
                  p={p}
                  label="Padding ring"
                  value={style.logo.padding}
                  display={`${style.logo.padding} modules`}
                  min={0}
                  max={4}
                  step={1}
                  onChange={(padding) => set({ logo: { ...style.logo!, padding } })}
                />
                <ChipRow
                  p={p}
                  compact
                  options={[
                    { value: 'square', label: 'Square' },
                    { value: 'rounded', label: 'Rounded' },
                    { value: 'circle', label: 'Circle' },
                  ]}
                  value={style.logo.shape}
                  onChange={(shape) =>
                    set({ logo: { ...style.logo!, shape: shape as 'square' | 'rounded' | 'circle' } })
                  }
                />
                <View style={{ height: space.md }} />
                <Button
                  p={p}
                  label="Fit the largest size that still scans"
                  icon="shield"
                  variant="secondary"
                  busy={fitting}
                  onPress={fitLogo}
                />
                <Text style={{ ...type.caption, color: p.textFaint, marginTop: space.sm, lineHeight: 16 }}>
                  Searches for the biggest logo the scan check still passes, treating every module
                  the logo touches as unreadable.
                </Text>
              </>
            ) : (
              <Button p={p} label="Add a logo" icon="image" variant="secondary" onPress={pickLogo} />
            )}
          </Card>

          <Card p={p}>
            <SectionLabel p={p}>Error correction</SectionLabel>
            <ChipRow
              p={p}
              compact
              options={EC_LEVELS.map((e) => ({ value: e.value, label: e.label }))}
              value={ecLevel}
              onChange={(v) => onEcChange(v as EcLevel)}
            />
            <Text style={{ ...type.caption, color: p.textFaint, marginTop: space.sm, lineHeight: 16 }}>
              Higher levels survive more damage but make the code denser. The encoder raises the
              level for free whenever the chosen size has room to spare.
            </Text>
            <Divider p={p} />
            <View style={{ height: space.md }} />
            <SliderRow
              p={p}
              label="Module spacing"
              value={style.moduleGap ?? 0}
              display={`${Math.round((style.moduleGap ?? 0) * 100)}%`}
              min={0}
              max={0.3}
              step={0.01}
              onChange={(moduleGap) => set({ moduleGap })}
            />
            <SliderRow
              p={p}
              label="Quiet zone"
              value={style.quietZone ?? 4}
              display={`${style.quietZone ?? 4} modules`}
              min={0}
              max={8}
              step={1}
              onChange={(quietZone) => set({ quietZone })}
            />
            <SliderRow
              p={p}
              label="Background rounding"
              value={style.backgroundRadius ?? 0}
              display={`${style.backgroundRadius ?? 0}`}
              min={0}
              max={30}
              step={1}
              onChange={(backgroundRadius) => set({ backgroundRadius })}
            />
          </Card>

          <Button p={p} label="Done" onPress={onClose} />
        </ScrollView>
      </View>
    </Modal>
  );
}
