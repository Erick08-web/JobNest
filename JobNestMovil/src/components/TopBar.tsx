import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { styles } from '../styles/theme';
import type { SessionUser } from '../types/domain';

export function TopBar({
  isLoggedIn,
  user,
  onHome,
  onSettings,
  onLogout,
}: {
  isLoggedIn: boolean;
  user: SessionUser | null;
  onHome: () => void;
  onSettings: () => void;
  onLogout: () => void;
}) {
  return (
    <View style={styles.topBar}>
      <Pressable style={styles.brand} onPress={onHome}>
        <View style={styles.logoMark}>
          <Text style={styles.logoText}>JN</Text>
        </View>
        <View>
          <Text style={styles.brandTitle}>JobNest</Text>
          <Text style={styles.brandSub}>Servicios confiables</Text>
        </View>
      </Pressable>
      <View style={styles.topActions}>
        <Pressable style={styles.iconButton} onPress={onSettings}>
          <Text style={styles.iconButtonText}>Ajustes</Text>
        </Pressable>
        {isLoggedIn ? (
          <Pressable style={styles.iconButton} onPress={onLogout}>
            <Text style={styles.iconButtonText}>Salir</Text>
          </Pressable>
        ) : null}
      </View>
      {user?.nombre ? <Text style={styles.welcome}>Hola, {user.nombre}</Text> : null}
    </View>
  );
}
