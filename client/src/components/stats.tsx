// Statistics widgets: leaderboard, line chart, head-to-head and records.

import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from 'react-native-svg';

import { Avatar, Card, Text } from '@/components/ui';
import { formatDay } from '@/lib/format';
import { colorForKey } from '@/lib/palette';
import { formatNumber, formatPercent, type GameRecord, type HeadToHead, type PlayerStats } from '@/lib/stats';
import { radius, spacing, useTheme } from '@/lib/theme';

export function Leaderboard({
  rows,
  showScores,
  colorOf = colorForKey,
}: {
  rows: PlayerStats[];
  showScores: boolean;
  colorOf?: (key: string) => string;
}) {
  const { colors } = useTheme();
  if (rows.length === 0) return null;
  const top = rows[0];
  return (
    <Card style={{ gap: spacing.xs, paddingVertical: spacing.md }}>
      <Text variant="caption" tone="faint" style={{ marginBottom: spacing.xs }}>
        Leaderboard
      </Text>
      {rows.map((r, i) => {
        const leader = i === 0 && top.wins > 0;
        const details = [
          `${r.played} played`,
          `${r.wins} ${r.wins === 1 ? 'win' : 'wins'}`,
          r.draws ? `${r.draws} draws` : null,
          showScores && r.avgScore !== null ? `avg ${formatNumber(r.avgScore)}` : null,
          showScores && r.bestScore !== null ? `best ${formatNumber(r.bestScore)}` : null,
        ].filter(Boolean);
        return (
          <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs + 2 }}>
            <Text variant="smallStrong" tone={leader ? 'gold' : 'faint'} style={{ width: 18, textAlign: 'center' }}>
              {leader ? '👑' : i + 1}
            </Text>
            <Avatar name={r.name} id={r.key} size={34} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {r.name}
              </Text>
              <Text variant="small" tone="muted" numberOfLines={1}>
                {details.join(' · ')}
              </Text>
            </View>
            <View style={{ width: 64, alignItems: 'flex-end', gap: 4 }}>
              <Text variant="number">{formatPercent(r.winRate)}</Text>
              <View style={{ width: 56, height: 4, borderRadius: 2, backgroundColor: colors.cardAlt, overflow: 'hidden' }}>
                <View style={{ width: `${r.winRate * 100}%`, height: 4, backgroundColor: colorOf(r.key) }} />
              </View>
            </View>
          </View>
        );
      })}
    </Card>
  );
}

export interface Series {
  key: string;
  name: string;
  values: number[];
}

/** Simple multi-line chart drawn with SVG (works the same on phones and web). */
export function LineChart({
  title,
  series,
  height = 170,
  colorOf = colorForKey,
}: {
  title: string;
  series: Series[];
  height?: number;
  colorOf?: (key: string) => string;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const count = Math.max(0, ...series.map((s) => s.values.length));
  if (count < 2) return null;

  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const padL = 28;
  const padR = 10;
  const padT = 10;
  const padB = 10;
  const w = Math.max(1, width - padL - padR);
  const h = height - padT - padB;
  const x = (i: number) => padL + (i * w) / (count - 1);
  const y = (v: number) => padT + h - (v / max) * h;
  const ticks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <Card style={{ gap: spacing.md }}>
      <Text variant="caption" tone="faint">
        {title}
      </Text>
      <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
        {width > 0 && (
          <Svg width={width} height={height}>
            {ticks.map((t) => (
              <Line key={`g${t}`} x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke={colors.border} strokeWidth={1} />
            ))}
            {ticks.map((t) => (
              <SvgText key={`l${t}`} x={padL - 8} y={y(t) + 4} fontSize={11} fill={colors.textFaint} textAnchor="end">
                {String(t)}
              </SvgText>
            ))}
            {series.map((s) => {
              const color = colorOf(s.key);
              const points = s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
              const last = s.values.length - 1;
              return (
                <G key={s.key}>
                  <Polyline points={points} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
                  <Circle cx={x(last)} cy={y(s.values[last])} r={4} fill={color} />
                </G>
              );
            })}
          </Svg>
        )}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {series.map((s) => (
          <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colorOf(s.key) }} />
            <Text variant="small">
              {s.name} <Text variant="smallStrong">{s.values[s.values.length - 1]}</Text>
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

export function HeadToHeadCard({
  pairs,
  colorOf = colorForKey,
}: {
  pairs: { a: { key: string; name: string }; b: { key: string; name: string }; h2h: HeadToHead }[];
  colorOf?: (key: string) => string;
}) {
  const { colors } = useTheme();
  const shown = pairs.filter((p) => p.h2h.games > 0);
  if (shown.length === 0) return null;
  return (
    <Card style={{ gap: spacing.md }}>
      <Text variant="caption" tone="faint">
        Head to head
      </Text>
      {shown.map(({ a, b, h2h }) => {
        const total = Math.max(1, h2h.aAhead + h2h.bAhead + h2h.ties);
        return (
          <View key={`${a.key}-${b.key}`} style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text variant="smallStrong" numberOfLines={1} style={{ flex: 1 }}>
                {a.name}
              </Text>
              <Text variant="number" style={{ marginHorizontal: spacing.md }}>
                {h2h.aAhead} – {h2h.bAhead}
              </Text>
              <Text variant="smallStrong" numberOfLines={1} style={{ flex: 1, textAlign: 'right' }}>
                {b.name}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', height: 6, borderRadius: 3, overflow: 'hidden', backgroundColor: colors.cardAlt }}>
              <View style={{ flex: h2h.aAhead / total, backgroundColor: colorOf(a.key) }} />
              <View style={{ flex: h2h.ties / total, backgroundColor: colors.border }} />
              <View style={{ flex: h2h.bAhead / total, backgroundColor: colorOf(b.key) }} />
            </View>
            <Text variant="small" tone="faint" style={{ textAlign: 'center' }}>
              {h2h.games} games together{h2h.ties ? ` · ${h2h.ties} ${h2h.ties === 1 ? 'tie' : 'ties'}` : ''}
            </Text>
          </View>
        );
      })}
    </Card>
  );
}

export function RecordsCard({
  records,
}: {
  records: { bestScore?: GameRecord; biggestWin?: GameRecord; longestStreak?: GameRecord; mostWins?: GameRecord };
}) {
  const { colors } = useTheme();
  const items = [
    records.mostWins && { emoji: '🏆', label: 'Most wins', value: `${records.mostWins.name} · ${records.mostWins.value}` },
    records.longestStreak && {
      emoji: '🔥',
      label: 'Longest win streak',
      value: `${records.longestStreak.name} · ${records.longestStreak.value} in a row`,
    },
    records.bestScore && {
      emoji: '⭐',
      label: 'Best score',
      value: `${records.bestScore.name} · ${formatNumber(records.bestScore.value)}`,
      hint: records.bestScore.date ? formatDay(records.bestScore.date) : undefined,
    },
    records.biggestWin && {
      emoji: '💥',
      label: 'Biggest win',
      value: `${records.biggestWin.name} by ${formatNumber(records.biggestWin.value)}`,
      hint: records.biggestWin.date ? formatDay(records.biggestWin.date) : undefined,
    },
  ].filter(Boolean) as { emoji: string; label: string; value: string; hint?: string }[];
  if (items.length === 0) return null;
  return (
    <Card style={{ gap: spacing.sm }}>
      <Text variant="caption" tone="faint">
        Records
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {items.map((it) => (
          <View
            key={it.label}
            style={{
              flexGrow: 1,
              flexBasis: '45%',
              backgroundColor: colors.cardAlt,
              borderRadius: radius.md,
              padding: spacing.md,
              gap: 2,
            }}>
            <Text style={{ fontSize: 20 }}>{it.emoji}</Text>
            <Text variant="small" tone="muted">
              {it.label}
            </Text>
            <Text variant="bodyStrong" numberOfLines={2}>
              {it.value}
            </Text>
            {it.hint && (
              <Text variant="small" tone="faint">
                {it.hint}
              </Text>
            )}
          </View>
        ))}
      </View>
    </Card>
  );
}
