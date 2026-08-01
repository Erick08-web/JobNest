import React, { useEffect, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert, Pressable, Text, View } from 'react-native';
import { AuthCard, Field, PrimaryButton } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { styles } from '../../styles/theme';

export function SettingsScreen() {
  const { apiUrl, setApiUrl, tokens } = useAuth();
  const [draftUrl, setDraftUrl] = useState(apiUrl);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setDraftUrl(apiUrl);
  }, [apiUrl]);

  const confirmAdvanced = () => {
    if (showAdvanced) {
      setShowAdvanced(false);
      return;
    }
    Alert.alert('Ajustes avanzados', 'Cambia estos datos solo si soporte te lo indica.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Continuar', onPress: () => setShowAdvanced(true) },
    ]);
  };

  return (
    <View style={styles.dashboardStack}>
      <AuthCard title="Ajustes" subtitle="Preferencias y soporte de tu aplicación.">
        <View style={styles.profileSectionCard}>
          <View style={styles.profileRow}>
            <View style={styles.profileRowIcon}>
              <Ionicons name="shield-checkmark-outline" size={18} style={styles.profileRowIconText} />
            </View>
            <View style={styles.profileRowBody}>
              <Text style={styles.profileRowLabel}>Sesión</Text>
              <Text style={styles.profileRowValue}>{tokens ? 'Activa en este dispositivo' : 'Sin sesión iniciada'}</Text>
            </View>
          </View>
          <View style={styles.profileRow}>
            <View style={styles.profileRowIcon}>
              <Ionicons name="help-circle-outline" size={18} style={styles.profileRowIconText} />
            </View>
            <View style={styles.profileRowBody}>
              <Text style={styles.profileRowLabel}>Soporte</Text>
              <Text style={styles.profileRowValue}>Usa los ajustes avanzados solo con ayuda de soporte.</Text>
            </View>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.profileAction, pressed && styles.pressed]}
          onPress={confirmAdvanced}
          accessibilityRole="button"
          accessibilityLabel="Abrir ajustes avanzados"
          hitSlop={8}
        >
          <View style={styles.profileActionIcon}>
            <Ionicons name="options-outline" size={20} style={styles.profileActionIconText} />
          </View>
          <View style={styles.profileActionBody}>
            <Text style={styles.profileActionTitle}>Ajustes avanzados</Text>
            <Text style={styles.profileActionText}>Opciones de conexión para soporte.</Text>
          </View>
          <Ionicons name={showAdvanced ? 'chevron-up' : 'chevron-forward'} size={18} style={styles.dashboardChevron} />
        </Pressable>

        {showAdvanced ? (
          <View style={styles.advancedPanel}>
            <Field label="Dirección de conexión" value={draftUrl} onChangeText={setDraftUrl} autoCapitalize="none" />
            <PrimaryButton title="Guardar conexión" onPress={() => setApiUrl(draftUrl)} />
          </View>
        ) : null}
      </AuthCard>
    </View>
  );
}
