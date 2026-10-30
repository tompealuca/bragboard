// Small design system shared by every screen. Everything reads colors from the theme,
// so light / dark mode work everywhere.

import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  Text as RNText,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { initials, parseNumber } from '@/lib/format';
import { colorForKey } from '@/lib/palette';
import { errorMessage } from '@/lib/pb';
import { formatNumber } from '@/lib/stats';
import { MAX_WIDTH, radius, spacing, useTheme, type Colors } from '@/lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export { Ionicons };

export function haptic() {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
}

// ------------------------------------------------------------------ text

const variants: Record<string, TextStyle> = {
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  h1: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  h2: { fontSize: 18, fontWeight: '700' },
  body: { fontSize: 16 },
  bodyStrong: { fontSize: 16, fontWeight: '600' },
  small: { fontSize: 14 },
  smallStrong: { fontSize: 14, fontWeight: '600' },
  caption: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  number: { fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  big: { fontSize: 28, fontWeight: '800', fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
};

type Tone = 'default' | 'muted' | 'faint' | 'primary' | 'danger' | 'gold' | 'success' | 'inverse';

function toneColor(c: Colors, tone: Tone) {
  switch (tone) {
    case 'muted':
      return c.textMuted;
    case 'faint':
      return c.textFaint;
    case 'primary':
      return c.primary;
    case 'danger':
      return c.danger;
    case 'gold':
      return c.gold;
    case 'success':
      return c.success;
    case 'inverse':
      return '#FFFFFF';
    default:
      return c.text;
  }
}

export function Text({
  variant = 'body',
  tone = 'default',
  style,
  ...rest
}: TextProps & { variant?: keyof typeof variants; tone?: Tone }) {
  const { colors } = useTheme();
  return <RNText {...rest} style={[{ color: toneColor(colors, tone) }, variants[variant], style]} />;
}

// ---------------------------------------------------------------- layout

export function Screen({
  children,
  scroll = true,
  edges = ['top', 'left', 'right'],
  refreshing,
  onRefresh,
  footer,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const content: StyleProp<ViewStyle> = [
    { width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', padding: spacing.lg, gap: spacing.lg },
    contentStyle,
  ];
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={[content, { paddingBottom: spacing.xxl * 2 }]}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
              ) : undefined
            }>
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, content]}>{children}</View>
        )}
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** Sticky bottom bar for the main action of a screen. */
export function Footer({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: colors.card,
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
        paddingBottom: Math.max(insets.bottom, spacing.md),
      }}>
      <View style={{ width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center', gap: spacing.sm }}>{children}</View>
    </View>
  );
}

export function Card({
  children,
  style,
  onPress,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
}) {
  const { colors, dark } = useTheme();
  const base: ViewStyle = {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: padded ? spacing.lg : 0,
    borderWidth: dark ? 1 : 0,
    borderColor: colors.border,
    ...(dark
      ? {}
      : Platform.select<ViewStyle>({
          web: { boxShadow: '0 1px 2px rgba(20,16,50,0.06), 0 2px 12px rgba(20,16,50,0.04)' } as ViewStyle,
          default: {
            shadowColor: '#140f32',
            shadowOpacity: 0.06,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 2 },
            elevation: 1,
          },
        })),
  };
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

/** Horizontal scroller whose content is at least as wide as the screen area (tables). */
export function HScroll({ children }: { children: ReactNode }) {
  const [width, setWidth] = useState(0);
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ minWidth: width || undefined }}>{children}</View>
      </ScrollView>
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[{ height: 1, backgroundColor: colors.border }, style]} />;
}

// --------------------------------------------------------------- buttons

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.primary, fg: colors.primaryText },
    secondary: { bg: colors.card, fg: colors.text, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.primary },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    soft: { bg: colors.primarySoft, fg: colors.primary },
  };
  const p = palette[variant];
  const height = size === 'lg' ? 56 : size === 'sm' ? 36 : 48;
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={inactive}
      onPress={() => {
        haptic();
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          height,
          paddingHorizontal: size === 'sm' ? spacing.md : spacing.xl,
          borderRadius: size === 'sm' ? radius.pill : radius.md,
          backgroundColor: p.bg,
          borderWidth: p.border ? 1 : 0,
          borderColor: p.border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={size === 'sm' ? 16 : 20} color={p.fg} />}
          <Text variant={size === 'sm' ? 'smallStrong' : 'bodyStrong'} style={{ color: p.fg }}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  color,
  size = 22,
  soft,
  style,
}: {
  icon: IconName;
  onPress?: () => void;
  label: string;
  color?: string;
  size?: number;
  soft?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => {
        haptic();
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          width: size + 18,
          height: size + 18,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: soft ? colors.cardAlt : 'transparent',
          opacity: pressed ? 0.6 : 1,
        },
        style,
      ]}>
      <Ionicons name={icon} size={size} color={color ?? colors.text} />
    </Pressable>
  );
}

// ---------------------------------------------------------------- inputs

export function Input({
  label,
  error,
  icon,
  right,
  style,
  ...rest
}: TextInputProps & { label?: string; error?: string | null; icon?: IconName; right?: ReactNode }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: spacing.xs }}>
      {label && (
        <Text variant="smallStrong" tone="muted">
          {label}
        </Text>
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.cardAlt,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: error ? colors.danger : focused ? colors.primary : 'transparent',
          paddingHorizontal: spacing.md,
          gap: spacing.sm,
        }}>
        {icon && <Ionicons name={icon} size={18} color={colors.textMuted} />}
        <TextInput
          placeholderTextColor={colors.textFaint}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[
            {
              flex: 1,
              minHeight: 48,
              fontSize: 16,
              color: colors.text,
              paddingVertical: rest.multiline ? spacing.md : 0,
              textAlignVertical: rest.multiline ? 'top' : 'center',
            },
            Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
            style,
          ]}
        />
        {right}
      </View>
      {error ? (
        <Text variant="small" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Numeric field with − / + buttons. Accepts negatives and decimals; empty means "no score yet". */
export function NumberField({
  value,
  onChange,
  step = 1,
  min,
  max,
  placeholder = '0',
  width = 64,
  steppers = true,
  autoFocus,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
  placeholder?: string;
  width?: number;
  steppers?: boolean;
  autoFocus?: boolean;
}) {
  const { colors } = useTheme();
  const [text, setText] = useState(value === null || value === undefined ? '' : String(value));

  useEffect(() => {
    if (parseNumber(text) !== (value ?? null)) setText(value === null || value === undefined ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const clamp = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  const bump = (delta: number) => {
    const next = clamp((value ?? 0) + delta);
    setText(String(next));
    onChange(next);
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      {steppers && <IconButton icon="remove" label="Decrease" size={18} soft onPress={() => bump(-step)} />}
      <TextInput
        value={text}
        autoFocus={autoFocus}
        onChangeText={(t) => {
          setText(t);
          const n = parseNumber(t);
          onChange(n === null ? null : clamp(n));
        }}
        selectTextOnFocus
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'}
        returnKeyType="done"
        style={[
          {
            width,
            height: 44,
            borderRadius: radius.sm,
            backgroundColor: colors.cardAlt,
            color: colors.text,
            textAlign: 'center',
            fontSize: 18,
            fontWeight: '700',
            fontVariant: ['tabular-nums'],
          },
          Platform.OS === 'web' && ({ outlineStyle: 'none' } as any),
        ]}
      />
      {steppers && <IconButton icon="add" label="Increase" size={18} soft onPress={() => bump(step)} />}
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: 3 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => {
              haptic();
              onChange(o.value);
            }}
            style={{
              flex: 1,
              paddingVertical: spacing.sm,
              borderRadius: radius.sm + 2,
              alignItems: 'center',
              backgroundColor: active ? colors.card : 'transparent',
            }}>
            <Text variant="smallStrong" tone={active ? 'default' : 'muted'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs }}>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{title}</Text>
        {subtitle && (
          <Text variant="small" tone="muted">
            {subtitle}
          </Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor="#FFFFFF"
        {...(Platform.OS === 'web' ? ({ activeThumbColor: '#FFFFFF' } as any) : {})}
      />
    </Pressable>
  );
}

// ---------------------------------------------------------- chips & people

export function Avatar({ name, id, size = 36 }: { name: string; id: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colorForKey(id),
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <RNText style={{ color: '#FFFFFF', fontWeight: '700', fontSize: size * 0.38 }}>{initials(name)}</RNText>
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  onRemove,
  avatarId,
  icon,
  color,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  onRemove?: () => void;
  avatarId?: string;
  icon?: IconName;
  color?: string;
}) {
  const { colors } = useTheme();
  const accent = color ?? colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => {
        haptic();
        onPress?.();
      }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingLeft: avatarId ? 4 : spacing.md,
        paddingRight: onRemove ? 4 : spacing.md,
        height: 36,
        borderRadius: radius.pill,
        backgroundColor: selected ? accent : colors.cardAlt,
        opacity: pressed ? 0.8 : 1,
      })}>
      {avatarId && <Avatar name={label} id={avatarId} size={28} />}
      {icon && <Ionicons name={icon} size={16} color={selected ? '#FFFFFF' : colors.textMuted} />}
      <Text variant="smallStrong" style={{ color: selected ? '#FFFFFF' : colors.text }} numberOfLines={1}>
        {label}
      </Text>
      {onRemove && (
        <Pressable
          accessibilityLabel={`Remove ${label}`}
          hitSlop={8}
          onPress={onRemove}
          style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="close" size={16} color={selected ? '#FFFFFF' : colors.textMuted} />
        </Pressable>
      )}
    </Pressable>
  );
}

const MEDALS = ['🥇', '🥈', '🥉'];

export function RankBadge({ rank, size = 32 }: { rank: number; size?: number }) {
  const { colors } = useTheme();
  if (rank >= 1 && rank <= 3)
    return <RNText style={{ fontSize: size * 0.72, width: size, textAlign: 'center' }}>{MEDALS[rank - 1]}</RNText>;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.cardAlt,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text variant="smallStrong" tone="muted">
        {rank}
      </Text>
    </View>
  );
}

export function Pill({
  text,
  tone = 'muted',
  icon,
  center,
}: {
  text: string;
  tone?: 'muted' | 'primary' | 'gold' | 'success';
  icon?: IconName;
  center?: boolean;
}) {
  const { colors } = useTheme();
  const map = {
    muted: { bg: colors.cardAlt, fg: colors.textMuted },
    primary: { bg: colors.primarySoft, fg: colors.primary },
    gold: { bg: colors.goldSoft, fg: colors.gold },
    success: { bg: colors.successSoft, fg: colors.success },
  }[tone];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: center ? 'center' : 'flex-start',
        backgroundColor: map.bg,
        borderRadius: radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}>
      {icon && <Ionicons name={icon} size={13} color={map.fg} />}
      <Text variant="smallStrong" style={{ color: map.fg, fontSize: 13 }}>
        {text}
      </Text>
    </View>
  );
}

// ------------------------------------------------------------ list pieces

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: -4 }}>
      <Text variant="h2">{title}</Text>
      {action && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text variant="smallStrong" tone="primary">
            {action}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export function Row({
  left,
  title,
  subtitle,
  right,
  onPress,
  chevron,
}: {
  left?: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm + 2,
        opacity: pressed ? 0.7 : 1,
      })}>
      {left}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="small" tone="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {chevron && <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />}
    </Pressable>
  );
}

export function GameIcon({ emoji, color, size = 44 }: { emoji: string; color: string; size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: color + '26',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <RNText style={{ fontSize: size * 0.52 }}>{emoji || '🎲'}</RNText>
    </View>
  );
}

export function StatTile({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 90,
        backgroundColor: colors.cardAlt,
        borderRadius: radius.md,
        padding: spacing.md,
        gap: 2,
      }}>
      <Text variant="big">{typeof value === 'number' ? formatNumber(value) : value}</Text>
      <Text variant="small" tone="muted">
        {label}
      </Text>
      {hint ? (
        <Text variant="small" tone="faint" numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------ states

export function EmptyState({
  emoji,
  title,
  text,
  action,
  onAction,
}: {
  emoji: string;
  title: string;
  text?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, gap: spacing.sm }}>
      <RNText style={{ fontSize: 48 }}>{emoji}</RNText>
      <Text variant="h2" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {text && (
        <Text tone="muted" style={{ textAlign: 'center', maxWidth: 360 }}>
          {text}
        </Text>
      )}
      {action && <Button title={action} onPress={onAction} style={{ marginTop: spacing.md }} />}
    </View>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl, backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.dangerSoft, borderRadius: radius.md, padding: spacing.lg, gap: spacing.sm }}>
      <Text tone="danger" variant="bodyStrong">
        {errorMessage(error)}
      </Text>
      {onRetry && <Button title="Try again" size="sm" variant="secondary" onPress={onRetry} style={{ alignSelf: 'flex-start' }} />}
    </View>
  );
}

// ----------------------------------------------------------------- sheet

/** Bottom sheet on phones, centered dialog on wide screens. */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
        <Pressable
          accessibilityLabel="Close"
          onPress={onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay }}
        />
        <View
          style={{
            width: '100%',
            maxWidth: 600,
            maxHeight: '90%',
            backgroundColor: colors.bg,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingBottom: Math.max(insets.bottom, spacing.lg),
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.lg,
              paddingBottom: spacing.sm,
            }}>
            <Text variant="h1" style={{ flex: 1 }} numberOfLines={1}>
              {title}
            </Text>
            <IconButton icon="close" label="Close" soft onPress={onClose} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.md }}>
            {children}
          </ScrollView>
          {footer && <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm }}>{footer}</View>}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
