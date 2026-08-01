import React from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import { styles } from '../styles/theme';
import type { SessionUser } from '../types/domain';

export function TopBar({
  isLoggedIn,
  user,
  onHome,
  onSettings,
}: {
  isLoggedIn: boolean;
  user: SessionUser | null;
  onHome: () => void;
  onSettings: () => void;
}) {
  const firstName = user?.nombre?.split(' ')[0];

  return (
    <View style={styles.headerCard}>
      <Pressable style={styles.headerLeft} onPress={onHome} accessibilityRole="button" accessibilityLabel="Ir al inicio" hitSlop={8}>
        <View style={styles.logoMark}>
          <Text style={styles.logoText}>JN</Text>
        </View>
        <View style={styles.headerTextBlock}>
          <Text style={styles.brandTitle}>JobNest</Text>
          <Text style={styles.headerGreeting} numberOfLines={1}>{isLoggedIn && firstName ? `Hola, ${firstName}` : 'Servicios confiables'}</Text>
        </View>
      </Pressable>
      <View style={styles.headerActions}>
        <Pressable style={styles.iconButton} onPress={onSettings} accessibilityRole="button" accessibilityLabel="Abrir ajustes" hitSlop={8}>
          <Ionicons name="settings-outline" size={20} style={styles.iconButtonText} />
        </Pressable>
      </View>
    </View>
  );
}
