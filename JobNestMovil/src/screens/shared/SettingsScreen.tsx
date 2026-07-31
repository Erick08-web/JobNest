import React from 'react';
import { Text, View } from 'react-native';
import { AuthCard, Field } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { styles } from '../../styles/theme';

export function SettingsScreen() {
  const { apiUrl, setApiUrl, tokens } = useAuth();

  return (
    <AuthCard title="Conexión de la app" subtitle="Ajusta la dirección solo si soporte te lo indica.">
      <Field label="Dirección de conexión" value={apiUrl} onChangeText={setApiUrl} autoCapitalize="none" />
      <View style={styles.tipBox}>
        <Text style={styles.tipTitle}>Soporte</Text>
        <Text style={styles.tipText}>Usa la dirección indicada por soporte.</Text>
      </View>
      <View style={styles.tipBoxMuted}>
        <Text style={styles.tipTitle}>Sesion</Text>
        <Text style={styles.tipText}>{tokens ? 'Tu sesión está guardada en este dispositivo.' : 'Aun no hay sesion iniciada.'}</Text>
      </View>
    </AuthCard>
  );
}
