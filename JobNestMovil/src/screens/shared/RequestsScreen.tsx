import React, { useMemo, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, EmptyState, GhostButton, SkeletonList } from '../../components/ui';
import { palette, spacing, styles } from '../../styles/theme';
import type { RequestItem, UserType } from '../../types/domain';
import { getRequestDate, getRequestPerson, getRequestStatus, getRequestTitle } from '../../utils/formatters';

function normalizeStatus(value: string) {
  return value.toLowerCase().trim();
}

function statusLabel(status: string) {
  const normalized = normalizeStatus(status);
  if (normalized === 'en_proceso') return 'En proceso';
  return status || 'Pendiente';
}

function requestKey(request: RequestItem, index: number) {
  return `${request.id ?? request.SolicitudId ?? 'solicitud'}-${index}`;
}

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
  const insets = useSafeAreaInsets();
  const [selectedStatus, setSelectedStatus] = useState('Todas');
  const statusOptions = useMemo(() => {
    const values = requests.map((request) => statusLabel(getRequestStatus(request))).filter(Boolean);
    return ['Todas', ...Array.from(new Set(values))];
  }, [requests]);
  const filteredRequests = useMemo(() => {
    if (selectedStatus === 'Todas') return requests;
    return requests.filter((request) => normalizeStatus(statusLabel(getRequestStatus(request))) === normalizeStatus(selectedStatus));
  }, [requests, selectedStatus]);

  const renderHeader = () => (
    <View>
      <View style={styles.requestsHero}>
        <View style={styles.sectionHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>{role === 'Prestador' ? 'Solicitudes recibidas' : 'Mis solicitudes'}</Text>
            <Text style={styles.pageTitle}>{role === 'Prestador' ? 'Clientes interesados' : 'Servicios solicitados'}</Text>
            <Text style={styles.pageText}>
              {role === 'Prestador'
                ? 'Da seguimiento a clientes y oportunidades reales.'
                : 'Consulta el avance de los servicios que pediste.'}
            </Text>
          </View>
          <Pressable
            style={styles.refreshButton}
            onPress={onRefresh}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Actualizar actividad"
            hitSlop={8}
          >
            <Ionicons name="refresh" size={20} style={styles.refreshButtonText} />
          </Pressable>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalChips}>
        {statusOptions.map((status) => {
          const active = selectedStatus === status;
          return (
            <Pressable
              key={status}
              style={[styles.filterChip, active && styles.filterChipActive, { marginRight: 8 }]}
              onPress={() => setSelectedStatus(status)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Filtrar solicitudes por ${status}`}
              hitSlop={8}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{status}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.requestsSummaryRow}>
        <Text style={styles.toolbarTitle}>{filteredRequests.length} solicitudes</Text>
        <Text style={styles.toolbarCaption}>{loading ? 'Actualizando actividad' : 'Información de tu cuenta'}</Text>
      </View>

      {loading && !filteredRequests.length ? <SkeletonList count={3} /> : null}

      {error ? (
        <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
          <EmptyState title="No pudimos cargar tu actividad" text="Inténtalo nuevamente." />
          <GhostButton title="Reintentar" onPress={onRefresh} disabled={loading} />
        </View>
      ) : null}
    </View>
  );

  return (
    <FlatList
      style={styles.marketplaceList}
      contentContainerStyle={[styles.marketplaceContent, { paddingBottom: Math.max(insets.bottom + 120, 136) }]}
      data={error || (loading && !filteredRequests.length) ? [] : filteredRequests}
      keyExtractor={requestKey}
      renderItem={({ item }) => (
        <View style={styles.requestCard}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.compactIcon}>
              <Ionicons name={role === 'Prestador' ? 'person-outline' : 'calendar-outline'} size={18} style={styles.compactIconText} />
            </View>
            <View style={styles.compactItemBody}>
              <Text style={styles.requestTitle} numberOfLines={2}>{getRequestTitle(item)}</Text>
              <Text style={styles.compactItemText} numberOfLines={1}>{getRequestPerson(item, role)} · {getRequestDate(item)}</Text>
            </View>
            <Badge text={getRequestStatus(item)} />
          </View>
          {item.mensaje ?? item.Mensaje ? <Text style={styles.requestMessage} numberOfLines={3}>{item.mensaje ?? item.Mensaje}</Text> : null}
          <Text style={styles.cardFooterAction}>Ver solicitud</Text>
        </View>
      )}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={!loading && !error ? (
        <View style={{ gap: spacing.md }}>
          <EmptyState
            title={role === 'Prestador' ? 'Aún no recibes solicitudes' : 'No tienes solicitudes todavía'}
            text={role === 'Prestador' ? 'Mantén tus servicios activos y tu perfil completo.' : 'Explora servicios para comenzar.'}
          />
          {selectedStatus !== 'Todas' ? <GhostButton title="Ver todas" onPress={() => setSelectedStatus('Todas')} /> : null}
        </View>
      ) : null}
      ListFooterComponent={<View style={{ height: spacing.md }} />}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={palette.primary} />}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={8}
      windowSize={7}
    />
  );
}
