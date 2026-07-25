import React from 'react';
import { Text, View } from 'react-native';
import { Badge, EmptyState, GhostButton, LoadingPill } from '../../components/ui';
import { styles } from '../../styles/theme';
import type { RequestItem, UserType } from '../../types/domain';
import { getRequestStatus, getRequestTitle } from '../../utils/formatters';

export function RequestsScreen({
  requests,
  onRefresh,
  role,
  loading,
  error,
}: {
  requests: RequestItem[];
  onRefresh: () => void;
  role: UserType;
  loading: boolean;
  error: string;
}) {
  return (
    <View>
      <View style={styles.pageIntro}>
        <Text style={styles.eyebrow}>SOLICITUDES</Text>
        <Text style={styles.pageTitle}>{role === 'Prestador' ? 'Clientes interesados' : 'Servicios solicitados'}</Text>
        <Text style={styles.pageText}>Seguimiento rapido de solicitudes desde la app movil.</Text>
      </View>
      <GhostButton title="Actualizar solicitudes" onPress={onRefresh} disabled={loading} />
      {loading ? (
        <LoadingPill />
      ) : error ? (
        <EmptyState title="No fue posible cargar solicitudes" text={error} />
      ) : requests.length ? (
        requests.map((request, index) => (
          <View key={`${request.id ?? request.SolicitudId ?? index}`} style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>{getRequestTitle(request)}</Text>
              <Badge text={getRequestStatus(request)} />
            </View>
            <Text style={styles.bodyText}>{request.mensaje ?? request.Mensaje ?? 'Sin mensaje adicional.'}</Text>
            <Text style={styles.metaText}>{request.fecha_servicio ?? request.FechaServicio ?? 'Fecha por confirmar'}</Text>
          </View>
        ))
      ) : (
        <EmptyState
          title="Sin solicitudes"
          text={role === 'Prestador' ? 'Aún no has recibido solicitudes.' : 'Todavía no has realizado solicitudes.'}
        />
      )}
    </View>
  );
}
