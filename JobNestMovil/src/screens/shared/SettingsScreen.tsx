import React from 'react';
import { Text, View } from 'react-native';
import { AuthCard, Field } from '../../components/ui';
import { DEFAULT_API_URL, useAuth } from '../../context/AuthContext';
import { styles } from '../../styles/theme';

export function SettingsScreen() {
  const { apiUrl, setApiUrl, tokens } = useAuth();

  return (
    <AuthCard title="Conexion con API" subtitle="En Expo Go usa la IP local de tu Mac, no localhost.">
      <Field label="URL del backend Flask" value={apiUrl} onChangeText={setApiUrl} autoCapitalize="none" />
      <View style={styles.tipBox}>
        <Text style={styles.tipTitle}>Detectada</Text>
        <Text style={styles.tipText}>{DEFAULT_API_URL}</Text>
        <Text style={styles.tipText}>El backend debe correr con host 0.0.0.0 para que tu telefono lo vea.</Text>
      </View>
      <View style={styles.tipBoxMuted}>
        <Text style={styles.tipTitle}>Sesion</Text>
        <Text style={styles.tipText}>{tokens ? 'Tokens JWT guardados en SecureStore.' : 'Aun no hay sesion iniciada.'}</Text>
      </View>
    </AuthCard>
  );
}
