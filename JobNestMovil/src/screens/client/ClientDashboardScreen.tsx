import React from 'react';
import { Text, View } from 'react-native';
import { ActionCard, StatCard } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { styles } from '../../styles/theme';

export function ClientDashboardScreen({
  onExplore,
  onRequests,
}: {
  onExplore: () => void;
  onRequests: () => void;
}) {
  const { user } = useAuth();

  return (
    <View>
      <View style={styles.dashboardHero}>
        <Text style={styles.eyebrow}>DASHBOARD CLIENTE</Text>
        <Text style={styles.pageTitle}>{user?.nombre ? `Hola, ${user.nombre}` : 'Tu espacio JobNest'}</Text>
        <Text style={styles.pageText}>Encuentra profesionales, revisa tus solicitudes y administra tus contrataciones.</Text>
      </View>

      <View style={styles.statsGrid}>
        <StatCard label="Contrataciones" value="0" />
        <StatCard label="Favoritos" value="0" />
        <StatCard label="Mensajes" value="0" />
      </View>

      <View style={styles.actionGrid}>
        <ActionCard title="Explorar servicios" text="Revisa el marketplace movil." onPress={onExplore} />
        <ActionCard title="Solicitudes" text="Consulta el estado de tus procesos." onPress={onRequests} />
      </View>
    </View>
  );
}
