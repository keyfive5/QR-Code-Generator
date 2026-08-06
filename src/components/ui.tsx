import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import { radius, space, type } from '../theme';
import type { Palette } from '../theme';

export function tap() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
export function tapSoft() {
  Haptics.selectionAsync().catch(() => {});
}
export function tapSuccess() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/* ------------------------------------------------------------------ */

export function Card({
  p,
  children,
  style,
  padded = true,
}: {
  p: Palette;
  children: React.ReactNode;
  style?: object;
  padded?: boolean;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: p.surface,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: p.border,
          padding: padded ? space.lg : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionLabel({ p, children, style }: { p: Palette; children: React.ReactNode; style?: object }) {
  return (
    <Text
      style={[
        {
          ...type.label,
          color: p.textFaint,
          textTransform: 'uppercase',
          letterSpacing: 0.8,
          fontSize: 11.5,
          marginBottom: space.sm,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/* ------------------------------------------------------------------ */

export function Chip({
  p,
  label,
  active,
  onPress,
  compact = false,
}: {
  p: Palette;
  label: string;
  active: boolean;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={() => {
        tapSoft();
        onPress();
      }}
      style={({ pressed }) => ({
        paddingHorizontal: compact ? space.md : space.lg - 2,
        paddingVertical: compact ? 7 : 9,
        borderRadius: radius.pill,
        backgroundColor: active ? p.accent : p.surfaceAlt,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: active ? p.accent : p.border,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text
        style={{
          ...type.label,
          fontSize: compact ? 12.5 : 13.5,
          color: active ? p.onAccent : p.textDim,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipRow({
  p,
  options,
  value,
  onChange,
  compact,
}: {
  p: Palette;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  compact?: boolean;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space.sm, paddingRight: space.lg }}
    >
      {options.map((o) => (
        <Chip
          key={o.value}
          p={p}
          label={o.label}
          active={o.value === value}
          onPress={() => onChange(o.value)}
          compact={compact}
        />
      ))}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */

export function Button({
  p,
  label,
  icon,
  onPress,
  variant = 'primary',
  disabled,
  busy,
  style,
}: {
  p: Palette;
  label: string;
  icon?: IconName;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'quiet' | 'danger';
  disabled?: boolean;
  busy?: boolean;
  style?: object;
}) {
  const bg =
    variant === 'primary' ? p.accent : variant === 'danger' ? p.fails + '1A' : p.surfaceAlt;
  const fg =
    variant === 'primary' ? p.onAccent : variant === 'danger' ? p.fails : p.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || busy}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.sm,
          paddingVertical: 13,
          paddingHorizontal: space.lg,
          borderRadius: radius.md,
          backgroundColor: bg,
          borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth : 0,
          borderColor: p.border,
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={17} color={fg} />}
          <Text style={{ ...type.heading, fontSize: 15, color: fg }}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  p,
  icon,
  onPress,
  label,
  tone,
}: {
  p: Palette;
  icon: IconName;
  onPress: () => void;
  label: string;
  tone?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: p.surfaceAlt,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Icon name={icon} size={19} color={tone ?? p.textDim} />
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */

export function Field({
  p,
  label,
  value,
  onChange,
  placeholder,
  multiline,
  keyboardType,
  autoCapitalize,
  optional,
  help,
}: {
  p: Palette;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'url' | 'numeric';
  autoCapitalize?: 'none' | 'sentences' | 'words';
  optional?: boolean;
  help?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: 6 }}>
        <Text style={{ ...type.label, color: p.textDim }}>{label}</Text>
        {optional && <Text style={{ ...type.caption, color: p.textFaint }}>optional</Text>}
      </View>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={p.textFaint}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCapitalize === 'none' ? false : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          ...type.body,
          color: p.text,
          backgroundColor: p.surfaceAlt,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: focused ? p.accent : 'transparent',
          paddingHorizontal: space.md,
          paddingVertical: multiline ? space.md : 11,
          minHeight: multiline ? 88 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
      {help && (
        <Text style={{ ...type.caption, color: p.textFaint, marginTop: 5 }}>{help}</Text>
      )}
    </View>
  );
}

export function Toggle({
  p,
  label,
  value,
  onChange,
}: {
  p: Palette;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      onPress={() => {
        tapSoft();
        onChange(!value);
      }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: space.md,
      }}
    >
      <Text style={{ ...type.body, color: p.text }}>{label}</Text>
      <View
        style={{
          width: 46,
          height: 28,
          borderRadius: 14,
          padding: 3,
          backgroundColor: value ? p.accent : p.surfaceHi,
          alignItems: value ? 'flex-end' : 'flex-start',
        }}
      >
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF' }} />
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */

export function Slider({
  p,
  value,
  min,
  max,
  step,
  onChange,
}: {
  p: Palette;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  const [width, setWidth] = useState(1);
  const widthRef = useRef(1);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    widthRef.current = e.nativeEvent.layout.width;
    setWidth(e.nativeEvent.layout.width);
  }, []);

  const clampToStep = useCallback(
    (raw: number) => {
      const snapped = Math.round(raw / step) * step;
      return Math.max(min, Math.min(max, Number(snapped.toFixed(4))));
    },
    [min, max, step],
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          onChange(clampToStep(min + (e.nativeEvent.locationX / widthRef.current) * (max - min)));
          tapSoft();
        },
        onPanResponderMove: (e) => {
          const x = Math.max(0, Math.min(widthRef.current, e.nativeEvent.locationX));
          onChange(clampToStep(min + (x / widthRef.current) * (max - min)));
        },
      }),
    [clampToStep, max, min, onChange],
  );

  const pct = max > min ? (value - min) / (max - min) : 0;

  return (
    <View
      onLayout={onLayout}
      {...responder.panHandlers}
      style={{ height: 36, justifyContent: 'center' }}
      accessibilityRole="adjustable"
      accessibilityValue={{ min, max, now: value }}
    >
      <View style={{ height: 5, borderRadius: 3, backgroundColor: p.surfaceHi }}>
        <View
          style={{ height: 5, borderRadius: 3, width: `${pct * 100}%`, backgroundColor: p.accent }}
        />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: Math.max(0, Math.min(width - 22, pct * width - 11)),
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: '#FFFFFF',
          borderWidth: 2,
          borderColor: p.accent,
        }}
      />
    </View>
  );
}

export function SliderRow({
  p,
  label,
  value,
  display,
  min,
  max,
  step,
  onChange,
}: {
  p: Palette;
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={{ marginBottom: space.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 }}>
        <Text style={{ ...type.label, color: p.textDim }}>{label}</Text>
        <Text style={{ ...type.label, color: p.text }}>{display}</Text>
      </View>
      <Slider p={p} value={value} min={min} max={max} step={step} onChange={onChange} />
    </View>
  );
}

/* ------------------------------------------------------------------ */

export function Swatches({
  p,
  colors,
  value,
  onChange,
}: {
  p: Palette;
  colors: string[];
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: space.sm, paddingRight: space.lg, paddingVertical: 3 }}
    >
      {colors.map((c) => {
        const active = c.toLowerCase() === value.toLowerCase();
        return (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityLabel={`Colour ${c}`}
            accessibilityState={{ selected: active }}
            onPress={() => {
              tapSoft();
              onChange(c);
            }}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              backgroundColor: c === 'transparent' ? p.surfaceHi : c,
              borderWidth: active ? 2.5 : StyleSheet.hairlineWidth,
              borderColor: active ? p.accent : p.borderStrong,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {c === 'transparent' && (
              <Text style={{ ...type.caption, fontSize: 9, color: p.textFaint }}>none</Text>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */

export function Row({
  p,
  title,
  subtitle,
  onPress,
  right,
  danger,
}: {
  p: Palette;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      onPress={
        onPress
          ? () => {
              tap();
              onPress();
            }
          : undefined
      }
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
        paddingVertical: 13,
        opacity: pressed && onPress ? 0.6 : 1,
      })}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ ...type.body, color: danger ? p.fails : p.text }}>{title}</Text>
        {subtitle ? (
          <Text style={{ ...type.caption, color: p.textFaint, marginTop: 2 }} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="chevronRight" size={16} color={p.textFaint} /> : null)}
    </Pressable>
  );
}

export function Divider({ p }: { p: Palette }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: p.border }} />;
}
