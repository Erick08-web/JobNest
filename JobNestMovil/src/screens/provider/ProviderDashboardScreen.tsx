import React from 'react';
import { Text, View } from 'react-native';
import { ActionCard, StatCard } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { styles } from '../../styles/theme';

export function ProviderDashboardScreen({
  onExplore,
  onRequests,
  onPublish,
}: {
  onExplore: () => void;
  onRequests: () => void;
  onPublish: () => void;
}) {
  const { user } = useAuth();

  return (
    <View>
      <View style={styles.dashboardHero}>
        <Text style={styles.eyebrow}>DASHBOARD PRESTADOR</Text>
        <Text style={styles.pageTitle}>{user?.nombre ? `Hola, ${user.nombre}` : 'Tu espacio JobNest'}</Text>
        <Text style={styles.pageText}>Gestiona solicitudes, publica servicios y da seguimiento a tus clientes.</Text>
      </View>

      <View style={styles.statsGrid}>
        <StatCard label="Solicitudes" value="0" />
        <StatCard label="Ingresos" value="0" />
        <StatCard label="Mensajes" value="0" />
      </View>

      <View style={styles.actionGrid}>
        <ActionCard title="Explorar servicios" text="Revisa el marketplace movil." onPress={onExplore} />
        <ActionCard title="Solicitudes" text="Consulta el estado de tus procesos." onPress={onRequests} />
        <ActionCard title="Publicar servicio" text="Crea una nueva oferta." onPress={onPublish} />
      </View>
    </View>
  );
}
