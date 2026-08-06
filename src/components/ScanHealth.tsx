import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';
import { Divider, tapSoft } from './ui';
import { GRADE_LABEL, gradeColor, radius, space, type } from '../theme';
import type { Palette } from '../theme';
import type { ScanReport } from '../qr/verify';

function Meter({ p, value, tone }: { p: Palette; value: number; tone: string }) {
  return (
    <View style={{ height: 5, borderRadius: 3, backgroundColor: p.surfaceHi, overflow: 'hidden' }}>
      <View
        style={{
          height: 5,
          borderRadius: 3,
          width: `${Math.max(2, Math.min(100, value * 100))}%`,
          backgroundColor: tone,
        }}
      />
    </View>
  );
}

function Metric({
  p,
  label,
  value,
  detail,
  meter,
  tone,
}: {
  p: Palette;
  label: string;
  value: string;
  detail?: string;
  meter?: number;
  tone?: string;
}) {
  return (
    <View style={{ paddingVertical: 9 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text style={{ ...type.body, fontSize: 14, color: p.textDim }}>{label}</Text>
        <Text style={{ ...type.label, color: tone ?? p.text }}>{value}</Text>
      </View>
      {meter !== undefined && (
        <View style={{ marginTop: 7 }}>
          <Meter p={p} value={meter} tone={tone ?? p.accent} />
        </View>
      )}
      {detail ? (
        <Text style={{ ...type.caption, color: p.textFaint, marginTop: 5 }}>{detail}</Text>
      ) : null}
    </View>
  );
}

export function ScanHealth({
  p,
  report,
  checking,
  initiallyOpen = false,
}: {
  p: Palette;
  report: ScanReport | null;
  checking: boolean;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);

  if (checking || !report) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          backgroundColor: p.surface,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: p.border,
          paddingHorizontal: space.lg,
          paddingVertical: space.lg,
        }}
      >
        <ActivityIndicator size="small" color={p.textFaint} />
        <Text style={{ ...type.body, color: p.textDim }}>Reading the code back…</Text>
      </View>
    );
  }

  const tone = gradeColor(p, report.grade);
  const headroom = 1 - report.budgetUsed;
  const summary = report.decodes
    ? report.warnings.length === 0
      ? 'Decoded back to exactly what you entered, with room to spare.'
      : report.warnings[0]
    : (report.failure ?? 'This design does not decode.');

  return (
    <View
      style={{
        backgroundColor: p.surface,
        borderRadius: radius.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: report.grade === 'fails' ? p.fails + '66' : p.border,
        overflow: 'hidden',
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Scan check: ${GRADE_LABEL[report.grade]}, score ${report.score} of 100. Tap for details.`}
        onPress={() => {
          tapSoft();
          setOpen((v) => !v);
        }}
        style={({ pressed }) => ({ padding: space.lg, opacity: pressed ? 0.8 : 1 })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: tone + '22',
            }}
          >
            <Icon name={report.decodes ? 'shield' : 'warning'} size={19} color={tone} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
              <Text style={{ ...type.heading, color: tone }}>{GRADE_LABEL[report.grade]}</Text>
              {report.decodes && (
                <Text style={{ ...type.caption, color: p.textFaint }}>
                  {report.score}/100
                </Text>
              )}
            </View>
            <Text style={{ ...type.caption, color: p.textDim, marginTop: 2 }} numberOfLines={open ? undefined : 2}>
              {summary}
            </Text>
          </View>
          <Icon name={open ? 'chevronDown' : 'chevronRight'} size={16} color={p.textFaint} />
        </View>
      </Pressable>

      {open && (
        <View style={{ paddingHorizontal: space.lg, paddingBottom: space.lg }}>
          <Divider p={p} />
          <Metric
            p={p}
            label="Read back correctly"
            value={report.decodes ? 'Yes' : 'No'}
            tone={report.decodes ? p.excellent : p.fails}
            detail={
              report.decodes
                ? 'The finished artwork was sampled and decoded; the payload came back byte for byte.'
                : 'The artwork was sampled and decoded, and the payload did not survive.'
            }
          />
          <Divider p={p} />
          <Metric
            p={p}
            label="Damage headroom left"
            value={`${Math.round(headroom * 100)}%`}
            meter={headroom}
            tone={headroom > 0.6 ? p.excellent : headroom > 0.35 ? p.good : p.risky}
            detail={`The styling used ${report.errorsCorrected} of the ${report.errorBudget} codewords a reader can repair. What is left absorbs scratches, glare and print flaws.`}
          />
          <Divider p={p} />
          <Metric
            p={p}
            label="Off-centre reads"
            value={`${Math.round(report.registrationTolerance * 5)}/5`}
            meter={report.registrationTolerance}
            tone={report.registrationTolerance === 1 ? p.excellent : p.risky}
            detail="Re-read five times with the sampling grid nudged off true, the way a reader sees a code photographed at an angle."
          />
          <Divider p={p} />
          <Metric
            p={p}
            label="Mark strength"
            value={`${Math.round(report.inkCoverage * 100)}%`}
            meter={report.inkCoverage}
            tone={report.inkCoverage > 0.7 ? p.excellent : report.inkCoverage > 0.6 ? p.good : p.risky}
            detail="How much of each module actually carries ink. Readers average brightness over small patches, so thin marks wash out."
          />
          <Divider p={p} />
          <Metric
            p={p}
            label="Contrast"
            value={`${report.contrastRatio.toFixed(1)}:1`}
            tone={report.contrastRatio >= 4.5 ? p.excellent : report.contrastRatio >= 3 ? p.risky : p.fails}
            detail={report.inverted ? 'Light modules on a dark background.' : undefined}
          />
          <Divider p={p} />
          <Metric p={p} label="Quiet zone" value={`${report.quietZone} modules`} tone={report.quietZone >= 4 ? p.excellent : p.risky} />
          {report.logoCoverage > 0 && (
            <>
              <Divider p={p} />
              <Metric
                p={p}
                label="Hidden by the logo"
                value={`${Math.round(report.logoCoverage * 100)}%`}
                tone={report.logoCoverage <= 0.25 ? p.excellent : p.risky}
                detail="Every module the logo touches is counted as unreadable, whatever the logo actually looks like."
              />
            </>
          )}
          <Divider p={p} />
          <Metric
            p={p}
            label="Smallest safe print"
            value={`${report.minPrintMm.toFixed(0)} mm`}
            detail="Below this width the modules fall under the 0.4 mm that print and camera can resolve."
          />

          {report.warnings.length > 0 && (
            <View style={{ marginTop: space.md, gap: space.sm }}>
              {report.warnings.map((w, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
                  <View style={{ marginTop: 1 }}>
                    <Icon name="warning" size={14} color={p.risky} />
                  </View>
                  <Text style={{ ...type.caption, color: p.textDim, flex: 1, lineHeight: 17 }}>{w}</Text>
                </View>
              ))}
            </View>
          )}
          {report.notes.length > 0 && (
            <View style={{ marginTop: space.md, gap: 5 }}>
              {report.notes.map((n, i) => (
                <Text key={i} style={{ ...type.caption, color: p.textFaint, lineHeight: 17 }}>
                  {n}
                </Text>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}
