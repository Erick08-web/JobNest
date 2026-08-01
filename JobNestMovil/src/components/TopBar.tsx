import React from 'react';
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
      <Pressable style={styles.headerLeft} onPress={onHome}>
        <View style={styles.logoMark}>
          <Text style={styles.logoText}>JN</Text>
        </View>
        <View>
          <Text style={styles.brandTitle}>JobNest</Text>
          <Text style={styles.headerGreeting}>{isLoggedIn && firstName ? `Hola, ${firstName}` : 'Servicios confiables'}</Text>
        </View>
      </Pressable>
      <View style={styles.headerActions}>
        <Pressable style={styles.iconButton} onPress={onSettings}>
          <Text style={styles.iconButtonText}>⚙</Text>
        </Pressable>
      </View>
    </View>
  );
}
