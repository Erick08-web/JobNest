import React, { useMemo, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, EmptyState, GhostButton, SkeletonList } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { cancelServiceRequest, fetchRequestHistory, markServiceRequestDone, rateMobileService, updateServiceRequestStatus, type RequestHistoryEvent } from '../../services/requestService';
import { palette, spacing, styles } from '../../styles/theme';
import type { RequestItem, UserType } from '../../types/domain';
import { getRequestDate, getRequestPerson, getRequestStatus, getRequestTitle } from '../../utils/formatters';
import { cleanText, mergeServerErrors } from '../../utils/validation';

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

function requestId(request: RequestItem) {
  return request.id ?? request.SolicitudId ?? null;
}

function canCancelRequest(request: RequestItem) {
  return ['pendiente', 'aceptada'].includes(normalizeStatus(getRequestStatus(request)));
}

function canProviderReview(request: RequestItem) {
  return normalizeStatus(getRequestStatus(request)) === 'pendiente';
}

function canProviderFinish(request: RequestItem) {
  return normalizeStatus(getRequestStatus(request)) === 'aceptada';
}

function canRateRequest(request: RequestItem) {
  const status = normalizeStatus(getRequestStatus(request));
  const price = Number(request.precio ?? 0);
  return ['concluido', 'calificado'].includes(status) && !request.mi_calificacion && (price <= 0 || Boolean(request.pago_completado));
}

export function RequestsScreen({
  requests,
  onRefresh,
  role,
  loading,
  error,
  onOpenChat,
  onEmptyAction,
}: {
  requests: RequestItem[];
  onRefresh: () => void;
  role: UserType;
  loading: boolean;
  error: string;
  onOpenChat: (request: RequestItem) => void;
  onEmptyAction: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { apiFetch, setLoading } = useAuth();
  const [selectedStatus, setSelectedStatus] = useState('Todas');
  const [cancelingId, setCancelingId] = useState<number | string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [localError, setLocalError] = useState('');
  const [history, setHistory] = useState<Record<string, RequestHistoryEvent[]>>({});
  const [ratingRequest, setRatingRequest] = useState<RequestItem | null>(null);
  const [rating, setRating] = useState(5);
  const [ratingComment, setRatingComment] = useState('');
  const statusOptions = useMemo(() => {
    const values = requests.map((request) => statusLabel(getRequestStatus(request))).filter(Boolean);
    return ['Todas', ...Array.from(new Set(values))];
  }, [requests]);
  const filteredRequests = useMemo(() => {
    if (selectedStatus === 'Todas') return requests;
    return requests.filter((request) => normalizeStatus(statusLabel(getRequestStatus(request))) === normalizeStatus(selectedStatus));
  }, [requests, selectedStatus]);

  const loadHistory = async (request: RequestItem) => {
    const id = requestId(request);
    if (!id) return;
    try {
      const events = await fetchRequestHistory(apiFetch, id);
      setHistory((current) => ({ ...current, [String(id)]: events }));
    } catch {
      setHistory((current) => ({ ...current, [String(id)]: [] }));
    }
  };

  const confirmCancel = (request: RequestItem) => {
    const id = requestId(request);
    if (!id) return;
    const reason = cleanText(cancelReason);
    if (!reason) {
      setLocalError('El motivo de cancelación es obligatorio.');
      return;
    }
    Alert.alert('Cancelar servicio', '¿Deseas cancelar este servicio? Esta acción puede no ser reversible.', [
      { text: 'Volver', style: 'cancel' },
      {
        text: 'Confirmar',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setLoading(true);
            setLocalError('');
            try {
              const response = await cancelServiceRequest(apiFetch, id, reason);
              Alert.alert('Servicio cancelado', response.message || 'El servicio fue cancelado correctamente.');
              setCancelingId(null);
              setCancelReason('');
              onRefresh();
            } catch (cancelError) {
              const parsed = mergeServerErrors(cancelError, 'No pudimos completar la acción.');
              setLocalError(parsed.message);
            } finally {
              setLoading(false);
            }
          })();
        },
      },
    ]);
  };

  const updateStatus = async (request: RequestItem, status: 'aceptada' | 'rechazada') => {
    const id = requestId(request);
    if (!id) return;
    setLoading(true);
    setLocalError('');
    try {
      const response = await updateServiceRequestStatus(apiFetch, id, status);
      Alert.alert('Solicitud actualizada', response.message || 'Solicitud actualizada.');
      onRefresh();
    } catch (statusError) {
      const parsed = mergeServerErrors(statusError, 'No pudimos completar la acción.');
      setLocalError(parsed.message);
    } finally {
      setLoading(false);
    }
  };

  const markDone = async (request: RequestItem) => {
    const id = requestId(request);
    if (!id) return;
    setLoading(true);
    setLocalError('');
    try {
      const response = await markServiceRequestDone(apiFetch, id);
      Alert.alert('Trabajo concluido', response.message || 'Trabajo marcado como concluido.');
      onRefresh();
    } catch (doneError) {
      const parsed = mergeServerErrors(doneError, 'No pudimos completar la acción.');
      setLocalError(parsed.message);
    } finally {
      setLoading(false);
    }
  };

  const submitRating = async () => {
    if (!ratingRequest) return;
    const id = requestId(ratingRequest);
    if (!id) return;
    setLoading(true);
    setLocalError('');
    try {
      const response = await rateMobileService(apiFetch, { requestId: id, rating, comment: cleanText(ratingComment) });
      Alert.alert('Reseña enviada', response.message || 'Tu calificación fue guardada.');
      setRatingRequest(null);
      setRating(5);
      setRatingComment('');
      onRefresh();
    } catch (rateError) {
      const parsed = mergeServerErrors(rateError, 'No pudimos guardar la reseña.');
      setLocalError(parsed.message);
    } finally {
      setLoading(false);
    }
  };

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
      {localError ? (
        <View style={{ marginBottom: spacing.md }}>
          <EmptyState title="No pudimos completar la acción" text={localError} />
        </View>
      ) : null}
    </View>
  );

  return (
    <>
    <FlatList
      style={styles.marketplaceList}
      contentContainerStyle={[styles.marketplaceContent, { paddingBottom: Math.max(insets.bottom + 120, 136) }]}
      data={error || (loading && !filteredRequests.length) ? [] : filteredRequests}
      keyExtractor={requestKey}
      renderItem={({ item }) => (
        <Pressable style={styles.requestCard} onPress={() => void loadHistory(item)} accessibilityRole="button" accessibilityLabel={`Ver historial de ${getRequestTitle(item)}`}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.compactIcon}>
              <Ionicons name={role === 'Prestador' ? 'person-outline' : 'clipboard-outline'} size={18} style={styles.compactIconText} />
            </View>
            <View style={styles.compactItemBody}>
              <Text style={styles.requestTitle} numberOfLines={2}>{getRequestTitle(item)}</Text>
              <Text style={styles.compactItemText} numberOfLines={1}>{getRequestPerson(item, role)} · {getRequestDate(item)}</Text>
            </View>
            <Badge text={getRequestStatus(item)} />
          </View>
          {item.mensaje ?? item.Mensaje ? <Text style={styles.requestMessage} numberOfLines={3}>{item.mensaje ?? item.Mensaje}</Text> : null}
          {(history[String(requestId(item))] ?? []).map((event, index) => (
            <View key={`${event.titulo}-${index}`} style={styles.requestHistoryEvent}>
              <Ionicons name="ellipse" size={7} color={palette.textMuted} />
              <Text style={styles.requestMessage}>{event.fecha || 'Sin fecha'} · {event.titulo}{event.detalle ? `: ${event.detalle}` : ''}</Text>
            </View>
          ))}
          {item.mi_calificacion ? (
            <View style={styles.ratingReadOnly}>
              <Text style={styles.ratingReadOnlyTitle}>Ya calificaste este servicio</Text>
              <View style={styles.ratingStarsRow}>
                {Array.from({ length: 5 }).map((_, index) => (
                  <Ionicons key={index} name={index < Number(item.mi_calificacion) ? 'star' : 'star-outline'} size={18} color={palette.warning} />
                ))}
              </View>
              {item.mi_comentario ? <Text style={styles.requestMessage}>{item.mi_comentario}</Text> : null}
              {item.mi_resena_fecha ? <Text style={styles.toolbarCaption}>{item.mi_resena_fecha}</Text> : null}
            </View>
          ) : null}
          {normalizeStatus(getRequestStatus(item)) === 'concluido' && !item.pago_completado && Number(item.precio ?? 0) > 0 ? (
            <Text style={styles.requestHint}>Podrás calificar cuando el pago esté registrado.</Text>
          ) : null}
          {cancelingId === requestId(item) ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
              <Text style={styles.label}>Motivo de cancelación</Text>
              <TextInput
                value={cancelReason}
                onChangeText={setCancelReason}
                placeholder="Escribe el motivo..."
                multiline
                maxLength={500}
                style={[styles.input, styles.textArea]}
              />
              <Text style={styles.toolbarCaption}>{cancelReason.length}/500</Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <GhostButton title="Volver" onPress={() => { setCancelingId(null); setCancelReason(''); }} />
                <GhostButton title="Confirmar cancelación" onPress={() => confirmCancel(item)} />
              </View>
            </View>
          ) : canCancelRequest(item) ? (
            <GhostButton title="Cancelar servicio" onPress={() => { setCancelingId(requestId(item)); void loadHistory(item); }} />
          ) : null}
          {role === 'Prestador' && canProviderReview(item) ? (
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <GhostButton title="Aceptar" onPress={() => void updateStatus(item, 'aceptada')} disabled={loading} />
              <GhostButton title="Rechazar" onPress={() => void updateStatus(item, 'rechazada')} disabled={loading} />
            </View>
          ) : null}
          {role === 'Prestador' && canProviderFinish(item) ? (
            <GhostButton title="Concluir trabajo" onPress={() => void markDone(item)} disabled={loading} />
          ) : null}
          <View style={styles.requestActionsRow}>
            <GhostButton title="Mensajes" onPress={() => onOpenChat(item)} disabled={loading} />
            {canRateRequest(item) ? <GhostButton title="Calificar" onPress={() => setRatingRequest(item)} disabled={loading} /> : null}
          </View>
          <Text style={styles.cardFooterAction}>Toca para ver historial</Text>
        </Pressable>
      )}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={!loading && !error ? (
        <View style={{ gap: spacing.md }}>
          <EmptyState
            title={role === 'Prestador' ? 'Aún no recibes solicitudes' : 'No tienes solicitudes todavía'}
            text={role === 'Prestador' ? 'Mantén tus servicios activos y tu perfil completo.' : 'Explora servicios para comenzar.'}
            actionTitle={role === 'Prestador' ? 'Publicar servicio' : 'Explorar servicios'}
            onAction={onEmptyAction}
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
    <Modal visible={Boolean(ratingRequest)} transparent animationType="fade" onRequestClose={() => setRatingRequest(null)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.ratingModal}>
          <Text style={styles.cardTitle}>Calificar servicio</Text>
          <Text style={styles.bodyText}>{ratingRequest ? getRequestTitle(ratingRequest) : ''}</Text>
          <View style={styles.ratingStarsRowLarge}>
            {Array.from({ length: 5 }).map((_, index) => {
              const value = index + 1;
              return (
                <Pressable
                  key={value}
                  onPress={() => setRating(value)}
                  accessibilityRole="button"
                  accessibilityLabel={`${value} estrellas`}
                  accessibilityState={{ selected: rating === value }}
                  hitSlop={8}
                >
                  <Ionicons name={value <= rating ? 'star' : 'star-outline'} size={34} color={palette.warning} />
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={ratingComment}
            onChangeText={setRatingComment}
            placeholder="Comentario opcional"
            placeholderTextColor={palette.textMuted}
            multiline
            maxLength={1000}
            style={[styles.input, styles.textArea]}
            accessibilityLabel="Comentario de la reseña"
          />
          <Text style={styles.toolbarCaption}>{ratingComment.length}/1000</Text>
          <View style={styles.requestActionsRow}>
            <GhostButton title="Cancelar" onPress={() => setRatingRequest(null)} disabled={loading} />
            <GhostButton title={loading ? 'Guardando...' : 'Enviar reseña'} onPress={submitRating} disabled={loading} />
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}
