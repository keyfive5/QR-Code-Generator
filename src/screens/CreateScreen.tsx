import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type Svg from 'react-native-svg';
import { QrCanvas } from '../components/QrCanvas';
import { ScanHealth } from '../components/ScanHealth';
import { Button, Card, ChipRow, Field, IconButton, SectionLabel, Toggle, tapSuccess } from '../components/ui';
import { Icon } from '../components/Icon';
import { CONTENT_TYPES, contentTypeById } from '../qr/payloads';
import type { Values } from '../qr/payloads';
import { encodeText } from '../qr/encode';
import { buildArtwork } from '../qr/render';
import type { RenderStyle } from '../qr/render';
import { verifyArtwork } from '../qr/verify';
import type { ScanReport } from '../qr/verify';
import type { EcLevel } from '../qr/spec';
import { PRESETS } from '../presets';
import { buildExportFile, copyText, saveImageToPhotos, shareFile, svgToPngBase64 } from '../export';
import { newId } from '../store';
import type { LibraryItem, Settings } from '../store';
import { radius, space, type } from '../theme';
import type { Palette } from '../theme';

const PREVIEW_MAX = 320;

type Props = {
  p: Palette;
  settings: Settings;
  onOpenDesign: () => void;
  onOpenAbout: () => void;
  style: Partial<RenderStyle>;
  ecLevel: EcLevel;
  typeId: string;
  onTypeChange: (id: string) => void;
  values: Record<string, Values>;
  onValuesChange: (typeId: string, v: Values) => void;
  onSaved: (item: LibraryItem) => void;
  /** Opens the scan-check detail panel on first render (web preview states). */
  expandHealth?: boolean;
};

export function CreateScreen({
  p,
  settings,
  onOpenDesign,
  onOpenAbout,
  style,
  ecLevel,
  typeId,
  onTypeChange,
  values,
  onValuesChange,
  onSaved,
  expandHealth,
}: Props) {
  const { width } = useWindowDimensions();
  const svgRef = useRef<Svg>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [report, setReport] = useState<ScanReport | null>(null);
  const [checking, setChecking] = useState(false);

  const contentType = contentTypeById(typeId);
  const current = values[typeId] ?? {};
  const payload = useMemo(() => {
    try {
      return contentType.build(current);
    } catch {
      return '';
    }
  }, [contentType, current]);

  const empty = payload.trim().length === 0;

  const built = useMemo(() => {
    if (empty) return { qr: null, art: null, error: null as string | null };
    try {
      const qr = encodeText(payload, { ecLevel });
      return { qr, art: buildArtwork(qr, style), error: null };
    } catch (e) {
      return { qr: null, art: null, error: e instanceof Error ? e.message : 'Could not build this code.' };
    }
  }, [payload, ecLevel, style, empty]);

  // Verification is the expensive part, so it runs after the preview has
  // already painted rather than blocking every keystroke.
  useEffect(() => {
    if (!built.art) {
      setReport(null);
      setChecking(false);
      return;
    }
    setChecking(true);
    const art = built.art;
    const handle = setTimeout(() => {
      const result = verifyArtwork(art, payload);
      setReport(result);
      setChecking(false);
    }, 220);
    return () => clearTimeout(handle);
  }, [built.art, payload]);

  const previewSize = Math.min(PREVIEW_MAX, width - space.lg * 2 - space.xl * 2);

  const setValue = useCallback(
    (key: string, v: string) => {
      onValuesChange(typeId, { ...current, [key]: v });
    },
    [current, onValuesChange, typeId],
  );

  const persist = useCallback(() => {
    if (!settings.saveToLibrary || !built.qr) return;
    const item: LibraryItem = {
      id: newId(),
      createdAt: Date.now(),
      source: 'created',
      typeId,
      values: current,
      payload,
      style,
      ecLevel,
      title: contentType.summarize(current),
      subtitle: contentType.label,
      favourite: false,
      grade: report?.grade,
    };
    onSaved(item);
  }, [built.qr, contentType, current, ecLevel, onSaved, payload, report?.grade, settings.saveToLibrary, style, typeId]);

  const runExport = useCallback(
    async (format: 'png' | 'svg' | 'pdf', destination: 'share' | 'photos') => {
      if (!built.art) return;
      setBusy(`${format}-${destination}`);
      try {
        const png =
          format === 'png'
            ? await svgToPngBase64(svgRef.current as never, settings.exportSize)
            : null;
        const file = await buildExportFile(
          format,
          built.art,
          contentType.summarize(current),
          png,
          settings.exportSize,
        );
        if (destination === 'photos') await saveImageToPhotos(file.uri);
        else await shareFile(file);
        tapSuccess();
        persist();
        if (destination === 'photos') {
          Alert.alert('Saved', 'The image is in your photo library.');
        }
      } catch (e) {
        Alert.alert('Could not export', e instanceof Error ? e.message : 'Something went wrong.');
      } finally {
        setBusy(null);
      }
    },
    [built.art, contentType, current, persist, settings.exportSize],
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl * 2, gap: space.lg }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ ...type.display, color: p.text }}>QR Forge</Text>
            <Text style={{ ...type.caption, color: p.textFaint, marginTop: 1 }}>
              Every code proof-read before you use it
            </Text>
          </View>
          <IconButton p={p} icon="info" label="About QR Forge" onPress={onOpenAbout} />
        </View>

        <View style={{ marginHorizontal: -space.lg, paddingLeft: space.lg }}>
          <ChipRow
            p={p}
            options={CONTENT_TYPES.map((t) => ({ value: t.id, label: t.label }))}
            value={typeId}
            onChange={onTypeChange}
          />
        </View>

        <Card p={p}>
          <Text style={{ ...type.caption, color: p.textFaint, marginBottom: space.md }}>
            {contentType.blurb}
          </Text>
          {contentType.fields.map((f) => {
            if (f.type === 'select') {
              return (
                <View key={f.key} style={{ marginBottom: space.md }}>
                  <SectionLabel p={p}>{f.label}</SectionLabel>
                  <View style={{ marginHorizontal: -space.lg, paddingLeft: space.lg }}>
                    <ChipRow
                      p={p}
                      compact
                      options={f.options ?? []}
                      value={current[f.key] ?? f.options?.[0]?.value ?? ''}
                      onChange={(v) => setValue(f.key, v)}
                    />
                  </View>
                </View>
              );
            }
            if (f.type === 'switch') {
              return (
                <Toggle
                  key={f.key}
                  p={p}
                  label={f.label}
                  value={current[f.key] === 'true'}
                  onChange={(v) => setValue(f.key, v ? 'true' : 'false')}
                />
              );
            }
            return (
              <Field
                key={f.key}
                p={p}
                label={f.label}
                value={current[f.key] ?? ''}
                onChange={(v) => setValue(f.key, v)}
                placeholder={f.placeholder}
                optional={f.optional}
                help={f.help}
                multiline={f.type === 'multiline'}
                keyboardType={
                  f.type === 'email' ? 'email-address'
                    : f.type === 'tel' ? 'phone-pad'
                      : f.type === 'url' ? 'url'
                        : f.type === 'number' ? 'numeric'
                          : 'default'
                }
                autoCapitalize={
                  f.type === 'email' || f.type === 'url' ? 'none'
                    : f.key === 'firstName' || f.key === 'lastName' ? 'words'
                      : 'sentences'
                }
              />
            );
          })}
        </Card>

        {built.error ? (
          <Card p={p} style={{ borderColor: p.fails + '55' }}>
            <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
              <Icon name="warning" size={18} color={p.fails} />
              <Text style={{ ...type.body, color: p.text, flex: 1, lineHeight: 21 }}>{built.error}</Text>
            </View>
          </Card>
        ) : null}

        <Card p={p} style={{ alignItems: 'center', paddingVertical: space.xl }}>
          {built.art ? (
            <View
              style={{
                borderRadius: radius.md,
                overflow: 'hidden',
                backgroundColor: built.art.background === 'transparent' ? p.paper : 'transparent',
              }}
            >
              <QrCanvas ref={svgRef} artwork={built.art} size={previewSize} />
            </View>
          ) : (
            <View
              style={{
                width: previewSize,
                height: previewSize,
                borderRadius: radius.md,
                borderWidth: 1,
                borderStyle: 'dashed',
                borderColor: p.border,
                alignItems: 'center',
                justifyContent: 'center',
                gap: space.md,
              }}
            >
              <Icon name="create" size={30} color={p.textFaint} />
              <Text style={{ ...type.caption, color: p.textFaint }}>
                Fill in the form to see your code
              </Text>
            </View>
          )}

          {built.qr && (
            <View style={{ flexDirection: 'row', gap: space.lg, marginTop: space.lg }}>
              <Stat p={p} label="Version" value={`${built.qr.version}`} />
              <Stat p={p} label="Level" value={built.qr.ecLevel} />
              <Stat p={p} label="Modules" value={`${built.qr.size}²`} />
              <Stat
                p={p}
                label="Capacity"
                value={`${Math.round((built.qr.dataBitsUsed / built.qr.dataBitsAvailable) * 100)}%`}
              />
            </View>
          )}
        </Card>

        {built.art && (
          <ScanHealth p={p} report={report} checking={checking} initiallyOpen={expandHealth} />
        )}

        <View style={{ gap: space.sm }}>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button
              p={p}
              label="Design"
              icon="design"
              variant="secondary"
              onPress={onOpenDesign}
              style={{ flex: 1 }}
            />
            <Button
              p={p}
              label="Share"
              icon="share"
              onPress={() => runExport('png', 'share')}
              disabled={!built.art}
              busy={busy === 'png-share'}
              style={{ flex: 1 }}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button
              p={p}
              label="Save PNG"
              icon="save"
              variant="secondary"
              onPress={() => runExport('png', 'photos')}
              disabled={!built.art}
              busy={busy === 'png-photos'}
              style={{ flex: 1 }}
            />
            <Button
              p={p}
              label="SVG"
              variant="secondary"
              onPress={() => runExport('svg', 'share')}
              disabled={!built.art}
              busy={busy === 'svg-share'}
              style={{ flex: 1 }}
            />
            <Button
              p={p}
              label="PDF"
              variant="secondary"
              onPress={() => runExport('pdf', 'share')}
              disabled={!built.art}
              busy={busy === 'pdf-share'}
              style={{ flex: 1 }}
            />
          </View>
        </View>

        {!empty && (
          <Card p={p}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <SectionLabel p={p} style={{ marginBottom: 0 }}>
                Encoded payload
              </SectionLabel>
              <IconButton
                p={p}
                icon="copy"
                label="Copy payload"
                onPress={() => {
                  copyText(payload).then(tapSuccess).catch(() => {});
                }}
              />
            </View>
            <Text selectable style={{ ...type.mono, color: p.textDim, marginTop: space.sm, lineHeight: 18 }}>
              {payload.length > 400 ? payload.slice(0, 400) + '…' : payload}
            </Text>
          </Card>
        )}

        <View style={{ marginTop: space.sm }}>
          <SectionLabel p={p}>Quick looks</SectionLabel>
          <Text style={{ ...type.caption, color: p.textFaint, marginBottom: space.md }}>
            Every preset in the Design sheet is covered by the project's test suite and reads at
            least as well as a plain black-and-white code.
          </Text>
          <Text style={{ ...type.caption, color: p.textFaint }}>
            {PRESETS.length} presets · {CONTENT_TYPES.length} content types · no account, no
            network, no subscription.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Stat({ p, label, value }: { p: Palette; label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Text style={{ ...type.heading, color: p.text }}>{value}</Text>
      <Text style={{ ...type.caption, fontSize: 10.5, color: p.textFaint, marginTop: 1 }}>
        {label}
      </Text>
    </View>
  );
}
