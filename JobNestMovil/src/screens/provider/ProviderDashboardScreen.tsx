import React, { useMemo } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import { Badge, EmptyState, SkeletonList } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { styles } from '../../styles/theme';
import type { Publication, RequestItem } from '../../types/domain';
import { formatServicePrice, getRequestDate, getRequestPerson, getRequestStatus, getRequestTitle, getTitle, normalizePublication } from '../../utils/formatters';

function normalizeStatus(value: string) {
  return value.toLowerCase().trim();
}

function statusMatches(request: RequestItem, values: string[]) {
  return values.includes(normalizeStatus(getRequestStatus(request)));
}

function firstName(value?: string) {
  return value?.trim().split(/\s+/)[0] || 'Prestador';
}

function ProviderAction({
  icon,
  title,
  text,
  badge,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  badge?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.dashboardAction, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      hitSlop={8}
    >
      <View style={styles.dashboardActionIconAlt}>
        <Ionicons name={icon} size={22} style={styles.dashboardActionIconTextAlt} />
      </View>
      <View style={styles.dashboardActionBody}>
        <View style={styles.dashboardActionHeader}>
          <Text style={styles.dashboardActionTitle}>{title}</Text>
          {badge ? <Badge text={badge} /> : null}
        </View>
        <Text style={styles.dashboardActionText}>{text}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} style={styles.dashboardChevron} />
    </Pressable>
  );
}

export function ProviderDashboardScreen({
  requests,
  publications,
  loading,
  onExplore,
  onRequests,
  onPublish,
}: {
  requests: RequestItem[];
  publications: Publication[];
  loading: boolean;
  onExplore: () => void;
  onRequests: () => void;
  onPublish: () => void;
}) {
  const { user } = useAuth();
  const ownPublications = useMemo(() => {
    const email = user?.email?.toLowerCase();
    if (!email) return [];
    return publications
      .map(normalizePublication)
      .filter((publication) => publication.prestador_email?.toLowerCase() === email);
  }, [publications, user?.email]);
  const pendingRequests = useMemo(() => requests.filter((request) => statusMatches(request, ['pendiente'])), [requests]);
  const acceptedRequests = useMemo(() => requests.filter((request) => statusMatches(request, ['aceptada', 'en proceso', 'en_proceso'])), [requests]);
  const finishedRequests = useMemo(() => requests.filter((request) => statusMatches(request, ['completada', 'concluida', 'calificado', 'finalizada'])), [requests]);
  const relevantRequests = useMemo(() => [...pendingRequests, ...acceptedRequests, ...requests.filter((request) => !pendingRequests.includes(request) && !acceptedRequests.includes(request))].slice(0, 3), [acceptedRequests, pendingRequests, requests]);

  return (
    <View style={styles.dashboardStack}>
      <View style={styles.roleHeroProvider}>
        <View style={styles.roleHeaderRow}>
          <View style={styles.roleAvatarAlt}>
            <Text style={styles.roleAvatarTextAlt}>{firstName(user?.nombre).charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.roleHeaderText}>
            <Text style={styles.eyebrow}>Prestador</Text>
            <Text style={styles.roleTitle}>Hola, {firstName(user?.nombre)}</Text>
            <Text style={styles.roleSubtitle}>Gestiona oportunidades y mantén tus servicios listos.</Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [styles.primaryDashboardActionAlt, pressed && styles.pressed]}
          onPress={onPublish}
          accessibilityRole="button"
          accessibilityLabel="Publicar servicio"
          hitSlop={8}
        >
          <View>
            <Text style={styles.primaryDashboardTitle}>Publicar servicio</Text>
            <Text style={styles.primaryDashboardText}>Crea una oferta clara para nuevos clientes.</Text>
          </View>
          <Ionicons name="add-circle" size={26} style={styles.primaryDashboardIcon} />
        </Pressable>
      </View>

      <View style={styles.metricGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{ownPublications.length}</Text>
          <Text style={styles.metricLabel}>Publicaciones activas</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{pendingRequests.length}</Text>
          <Text style={styles.metricLabel}>Solicitudes pendientes</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{finishedRequests.length}</Text>
          <Text style={styles.metricLabel}>Trabajos cerrados</Text>
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.dashboardSectionTitle}>Accesos rápidos</Text>
            <Text style={styles.dashboardSectionCaption}>Acciones disponibles para tu rol.</Text>
          </View>
        </View>
        <View style={styles.dashboardActionList}>
          <ProviderAction icon="add-circle-outline" title="Publicar" text="Crea una nueva publicación." onPress={onPublish} />
          <ProviderAction icon="clipboard-outline" title="Solicitudes" text="Atiende clientes interesados." badge={pendingRequests.length ? `${pendingRequests.length}` : undefined} onPress={onRequests} />
          <ProviderAction icon="search-outline" title="Explorar" text="Consulta cómo se ve el marketplace." onPress={onExplore} />
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.dashboardSectionTitle}>Solicitudes recibidas</Text>
            <Text style={styles.dashboardSectionCaption}>Pendientes y aceptadas primero.</Text>
          </View>
          <Pressable onPress={onRequests} accessibilityRole="button" accessibilityLabel="Ver solicitudes recibidas" hitSlop={8}>
            <Text style={styles.linkText}>Ver</Text>
          </Pressable>
        </View>
        {loading ? (
          <SkeletonList count={2} />
        ) : relevantRequests.length ? (
          relevantRequests.map((request, index) => (
            <Pressable key={`${request.id ?? request.SolicitudId ?? index}`} style={({ pressed }) => [styles.compactListItem, pressed && styles.pressed]} onPress={onRequests} accessibilityRole="button" accessibilityLabel={`Ver solicitud ${getRequestTitle(request)}`}>
              <View style={styles.compactIconAlt}>
                <Ionicons name="person-outline" size={18} style={styles.compactIconTextAlt} />
              </View>
              <View style={styles.compactItemBody}>
                <Text style={styles.compactItemTitle} numberOfLines={1}>{getRequestTitle(request)}</Text>
                <Text style={styles.compactItemText} numberOfLines={1}>{getRequestPerson(request, 'Prestador')} · {getRequestDate(request)}</Text>
              </View>
              <Badge text={getRequestStatus(request)} />
            </Pressable>
          ))
        ) : (
          <EmptyState title="No tienes solicitudes nuevas" text="Mantén tus publicaciones actualizadas para recibir oportunidades." actionTitle="Ver publicaciones" onAction={onExplore} />
        )}
      </View>

      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.dashboardSectionTitle}>Tus publicaciones</Text>
            <Text style={styles.dashboardSectionCaption}>Resumen de servicios activos.</Text>
          </View>
          <Pressable onPress={onPublish} accessibilityRole="button" accessibilityLabel="Publicar otro servicio" hitSlop={8}>
            <Text style={styles.linkText}>Publicar</Text>
          </Pressable>
        </View>
        {ownPublications.length ? (
          ownPublications.slice(0, 3).map((publication) => (
            <View key={`${publication.id}-${getTitle(publication)}`} style={styles.compactListItem}>
              <View style={styles.compactIconAlt}>
                <Ionicons name="briefcase-outline" size={18} style={styles.compactIconTextAlt} />
              </View>
              <View style={styles.compactItemBody}>
                <Text style={styles.compactItemTitle} numberOfLines={1}>{getTitle(publication)}</Text>
                <Text style={styles.compactItemText} numberOfLines={1}>{publication.categoria ?? 'Servicio'} · {formatServicePrice(publication) || 'Precio por confirmar'}</Text>
              </View>
              <Badge text="Activa" />
            </View>
          ))
        ) : (
          <EmptyState title="Aún no tienes publicaciones activas" text="Publica tu primer servicio para aparecer en el marketplace." actionTitle="Publicar servicio" onAction={onPublish} />
        )}
      </View>
    </View>
  );
}
