import React from 'react';
import { Text, View } from 'react-native';
import { GhostButton } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { styles } from '../../styles/theme';

export function ProfileScreen({ onSettings }: { onSettings: () => void }) {
  const { user, currentUserType, logout } = useAuth();

  return (
    <View>
      <View style={styles.profileHero}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarText}>{String(user?.nombre ?? 'JN').slice(0, 2).toUpperCase()}</Text>
        </View>
        <Text style={styles.profileName}>{user?.nombre ?? 'Usuario JobNest'}</Text>
        <Text style={styles.profileRole}>{currentUserType}</Text>
      </View>
      <View style={styles.actionGrid}>
        <GhostButton title="Conexion con API" onPress={onSettings} />
        <GhostButton title="Cerrar sesion" onPress={logout} />
      </View>
    </View>
  );
}
