import React from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { PRIMARY, styles } from '../styles/theme';

export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <View style={styles.authCard}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSubtitle}>{subtitle}</Text>
      <View style={styles.formStack}>{children}</View>
    </View>
  );
}

export function Field({
  label,
  multiline,
  error,
  style,
  ...props
}: { label: string; multiline?: boolean; error?: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        accessibilityLabel={props.accessibilityLabel ?? label}
        accessibilityHint={error}
        placeholderTextColor="#98a2b3"
        style={[styles.input, multiline && styles.textArea, error && styles.inputError, style]}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function PrimaryButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, disabled && styles.disabled]} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: Boolean(disabled) }} hitSlop={8}>
      <Text style={styles.primaryButtonText}>{title}</Text>
    </Pressable>
  );
}

export function GhostButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed, disabled && styles.disabled]} onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: Boolean(disabled) }} hitSlop={8}>
      <Text style={styles.ghostButtonText}>{title}</Text>
    </Pressable>
  );
}

export function Segmented({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable key={option} style={[styles.segment, active && styles.segmentActive]} onPress={() => onChange(option)} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={option} hitSlop={8}>
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Badge({ text }: { text: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export function ActionCard({ title, text, onPress }: { title: string; text: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]} onPress={onPress} accessibilityRole="button" accessibilityLabel={title} hitSlop={8}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.bodyText}>{text}</Text>
      <Text style={styles.linkText}>Abrir</Text>
    </Pressable>
  );
}

export function Notice({ text }: { text: string }) {
  return (
    <View style={styles.notice}>
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

export function LoadingPill() {
  return (
    <View style={styles.loadingPill}>
      <ActivityIndicator color={PRIMARY} />
      <Text style={styles.loadingText}>Conectando con JobNest...</Text>
    </View>
  );
}

export function EmptyState({ title, text, actionTitle, onAction }: { title: string; text: string; actionTitle?: string; onAction?: () => void }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Text style={styles.emptyIconText}>⌁</Text>
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
      {actionTitle && onAction ? <GhostButton title={actionTitle} onPress={onAction} /> : null}
    </View>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, index) => (
        <View style={styles.skeletonCard} key={index}>
          <View style={styles.skeletonMedia} />
          <View style={[styles.skeletonBlock, { width: '70%' }]} />
          <View style={[styles.skeletonBlock, { width: '92%' }]} />
          <View style={[styles.skeletonBlock, { width: '46%' }]} />
        </View>
      ))}
    </View>
  );
}
