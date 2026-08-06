import React, { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { QrCanvas } from '../components/QrCanvas';
import { Card, ChipRow, Divider, IconButton, SectionLabel, tap, tapSoft } from '../components/ui';
import { Icon } from '../components/Icon';
import { encodeText } from '../qr/encode';
import { buildArtwork } from '../qr/render';
import { contentTypeById } from '../qr/payloads';
import { copyText } from '../export';
import type { LibraryItem } from '../store';
import { radius, space, type } from '../theme';
import type { Palette } from '../theme';

type Props = {
  p: Palette;
  items: LibraryItem[];
  onOpen: (item: LibraryItem) => void;
  onDelete: (id: string) => void;
  onToggleFavourite: (id: string) => void;
};

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  if (d < 30) return `${d} d ago`;
  return new Date(ts).toLocaleDateString();
}

function Thumb({ p, item }: { p: Palette; item: LibraryItem }) {
  const art = useMemo(() => {
    try {
      return buildArtwork(encodeText(item.payload, { ecLevel: item.ecLevel }), item.style);
    } catch {
      return null;
    }
  }, [item.payload, item.ecLevel, item.style]);

  if (!art) {
    return (
      <View
        style={{
          width: 54, height: 54, borderRadius: radius.sm,
          backgroundColor: p.surfaceAlt, alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Icon name="warning" size={18} color={p.textFaint} />
      </View>
    );
  }
  return (
    <View style={{ borderRadius: radius.sm, overflow: 'hidden', backgroundColor: p.paper }}>
      <QrCanvas artwork={art} size={54} />
    </View>
  );
}

export function LibraryScreen({ p, items, onOpen, onDelete, onToggleFavourite }: Props) {
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    const sorted = [...items].sort((a, b) => b.createdAt - a.createdAt);
    if (filter === 'favourites') return sorted.filter((i) => i.favourite);
    if (filter === 'created') return sorted.filter((i) => i.source === 'created');
    if (filter === 'scanned') return sorted.filter((i) => i.source === 'scanned');
    return sorted;
  }, [items, filter]);

  return (
    <ScrollView contentContainerStyle={{ padding: space.lg, paddingBottom: space.xxl * 2, gap: space.lg }}>
      <View>
        <Text style={{ ...type.display, color: p.text }}>Library</Text>
        <Text style={{ ...type.caption, color: p.textFaint, marginTop: 1 }}>
          Stored on this device only
        </Text>
      </View>

      <View style={{ marginHorizontal: -space.lg, paddingLeft: space.lg }}>
        <ChipRow
          p={p}
          compact
          options={[
            { value: 'all', label: `All ${items.length ? `(${items.length})` : ''}`.trim() },
            { value: 'favourites', label: 'Favourites' },
            { value: 'created', label: 'Made here' },
            { value: 'scanned', label: 'Scanned' },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </View>

      {filtered.length === 0 ? (
        <Card p={p} style={{ alignItems: 'center', paddingVertical: space.xxl }}>
          <Icon name="library" size={30} color={p.textFaint} />
          <Text style={{ ...type.heading, color: p.textDim, marginTop: space.md }}>
            Nothing here yet
          </Text>
          <Text
            style={{
              ...type.caption, color: p.textFaint, marginTop: space.sm,
              textAlign: 'center', lineHeight: 18, maxWidth: 260,
            }}
          >
            Codes you make and codes you scan are kept here, on this device. There is no account and
            nothing is uploaded.
          </Text>
        </Card>
      ) : (
        <Card p={p} padded={false}>
          {filtered.map((item, index) => (
            <View key={item.id}>
              {index > 0 && <View style={{ marginLeft: space.lg + 54 + space.md }}><Divider p={p} /></View>}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.title}, ${item.subtitle}`}
                onPress={() => {
                  tap();
                  onOpen(item);
                }}
                onLongPress={() => {
                  tapSoft();
                  Alert.alert(item.title, item.payload.slice(0, 300), [
                    { text: 'Copy payload', onPress: () => { copyText(item.payload).catch(() => {}); } },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => onDelete(item.id),
                    },
                    { text: 'Cancel', style: 'cancel' },
                  ]);
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  padding: space.lg,
                  opacity: pressed ? 0.65 : 1,
                })}
              >
                <Thumb p={p} item={item} />
                <View style={{ flex: 1 }}>
                  <Text style={{ ...type.body, color: p.text }} numberOfLines={1}>
                    {item.title || 'Untitled'}
                  </Text>
                  <Text style={{ ...type.caption, color: p.textFaint, marginTop: 2 }}>
                    {item.subtitle} · {timeAgo(item.createdAt)}
                    {item.source === 'scanned' ? ' · scanned' : ''}
                  </Text>
                </View>
                <IconButton
                  p={p}
                  icon={item.favourite ? 'check' : 'plus'}
                  label={item.favourite ? 'Remove from favourites' : 'Add to favourites'}
                  tone={item.favourite ? p.accent : p.textFaint}
                  onPress={() => onToggleFavourite(item.id)}
                />
              </Pressable>
            </View>
          ))}
        </Card>
      )}

      {items.length > 0 && (
        <Text style={{ ...type.caption, color: p.textFaint, textAlign: 'center', lineHeight: 17 }}>
          Tap to reopen a code with its design intact. Press and hold for more.
        </Text>
      )}
    </ScrollView>
  );
}
