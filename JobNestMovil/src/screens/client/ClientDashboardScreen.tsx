import React, { useMemo } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import { Badge, EmptyState, SkeletonList } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { styles } from '../../styles/theme';
import type { Publication, RequestItem } from '../../types/domain';
import { getRequestDate, getRequestPerson, getRequestStatus, getRequestTitle, getTitle, normalizePublication } from '../../utils/formatters';

const ACTIVE_STATUSES = ['pendiente', 'aceptada', 'en proceso', 'en_proceso'];

function normalizedStatus(request: RequestItem) {
  return getRequestStatus(request).toLowerCase().trim();
}

function isActiveRequest(request: RequestItem) {
  return ACTIVE_STATUSES.includes(normalizedStatus(request));
}

function firstName(value?: string) {
  return value?.trim().split(/\s+/)[0] || 'Cliente';
}

function DashboardAction({
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
      <View style={styles.dashboardActionIcon}>
        <Ionicons name={icon} size={22} style={styles.dashboardActionIconText} />
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

export function ClientDashboardScreen({
  requests,
  publications,
  loading,
  onExplore,
  onRequests,
  onProfile,
}: {
  requests: RequestItem[];
  publications: Publication[];
  loading: boolean;
  onExplore: () => void;
  onRequests: () => void;
  onProfile: () => void;
}) {
  const { user } = useAuth();
  const activeRequests = useMemo(() => requests.filter(isActiveRequest), [requests]);
  const recentPublications = useMemo(() => publications.map(normalizePublication).slice(0, 3), [publications]);

  return (
    <View style={styles.dashboardStack}>
      <View style={styles.roleHeroClient}>
        <View style={styles.roleHeaderRow}>
          <View style={styles.roleAvatar}>
            <Text style={styles.roleAvatarText}>{firstName(user?.nombre).charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.roleHeaderText}>
            <Text style={styles.eyebrow}>Cliente</Text>
            <Text style={styles.roleTitle}>Hola, {firstName(user?.nombre)}</Text>
            <Text style={styles.roleSubtitle}>Encuentra ayuda confiable para lo que necesitas hoy.</Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [styles.primaryDashboardAction, pressed && styles.pressed]}
          onPress={onExplore}
          accessibilityRole="button"
          accessibilityLabel="Explorar servicios"
          hitSlop={8}
        >
          <View>
            <Text style={styles.primaryDashboardTitle}>Explorar servicios</Text>
            <Text style={styles.primaryDashboardText}>Busca profesionales disponibles y solicita atención.</Text>
          </View>
          <Ionicons name="search" size={24} style={styles.primaryDashboardIcon} />
        </Pressable>
      </View>

      <View style={styles.metricGrid}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{activeRequests.length}</Text>
          <Text style={styles.metricLabel}>Solicitudes activas</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{requests.length}</Text>
          <Text style={styles.metricLabel}>Solicitudes totales</Text>
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.dashboardSectionTitle}>Accesos rápidos</Text>
            <Text style={styles.dashboardSectionCaption}>Todo lleva a pantallas disponibles.</Text>
          </View>
        </View>
        <View style={styles.dashboardActionList}>
          <DashboardAction icon="search-outline" title="Explorar" text="Encuentra servicios publicados." onPress={onExplore} />
          <DashboardAction icon="calendar-outline" title="Mis solicitudes" text="Revisa el avance de tus servicios." badge={activeRequests.length ? `${activeRequests.length}` : undefined} onPress={onRequests} />
          <DashboardAction icon="person-circle-outline" title="Perfil" text="Consulta tus datos de cuenta." onPress={onProfile} />
        </View>
      </View>

      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.dashboardSectionTitle}>Solicitudes activas</Text>
            <Text style={styles.dashboardSectionCaption}>Pendientes, aceptadas o en proceso.</Text>
          </View>
          <Pressable onPress={onRequests} accessibilityRole="button" accessibilityLabel="Ver solicitudes" hitSlop={8}>
            <Text style={styles.linkText}>Ver</Text>
          </Pressable>
        </View>
        {loading ? (
          <SkeletonList count={2} />
        ) : activeRequests.length ? (
          activeRequests.slice(0, 3).map((request, index) => (
            <Pressable key={`${request.id ?? request.SolicitudId ?? index}`} style={({ pressed }) => [styles.compactListItem, pressed && styles.pressed]} onPress={onRequests} accessibilityRole="button" accessibilityLabel={`Ver solicitud ${getRequestTitle(request)}`}>
              <View style={styles.compactIcon}>
                <Ionicons name="calendar-outline" size={18} style={styles.compactIconText} />
              </View>
              <View style={styles.compactItemBody}>
                <Text style={styles.compactItemTitle} numberOfLines={1}>{getRequestTitle(request)}</Text>
                <Text style={styles.compactItemText} numberOfLines={1}>{getRequestPerson(request, 'Cliente')} · {getRequestDate(request)}</Text>
              </View>
              <Badge text={getRequestStatus(request)} />
            </Pressable>
          ))
        ) : (
          <EmptyState title="Aún no tienes solicitudes activas" text="Explora servicios y encuentra al profesional ideal." />
        )}
      </View>

      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <View>
            <Text style={styles.dashboardSectionTitle}>Servicios recientes</Text>
            <Text style={styles.dashboardSectionCaption}>Publicaciones reales disponibles.</Text>
          </View>
          <Pressable onPress={onExplore} accessibilityRole="button" accessibilityLabel="Ver servicios recientes" hitSlop={8}>
            <Text style={styles.linkText}>Explorar</Text>
          </Pressable>
        </View>
        {recentPublications.length ? (
          recentPublications.map((publication) => (
            <Pressable key={`${publication.id}-${getTitle(publication)}`} style={({ pressed }) => [styles.compactListItem, pressed && styles.pressed]} onPress={onExplore} accessibilityRole="button" accessibilityLabel={`Explorar ${getTitle(publication)}`}>
              <View style={styles.compactIcon}>
                <Ionicons name="briefcase-outline" size={18} style={styles.compactIconText} />
              </View>
              <View style={styles.compactItemBody}>
                <Text style={styles.compactItemTitle} numberOfLines={1}>{getTitle(publication)}</Text>
                <Text style={styles.compactItemText} numberOfLines={1}>{publication.categoria ?? 'Servicio'} · {publication.ubicacion ?? 'Ubicación por confirmar'}</Text>
              </View>
            </Pressable>
          ))
        ) : (
          <EmptyState title="Aún no hay servicios disponibles" text="Vuelve pronto para descubrir nuevos profesionales." />
        )}
      </View>
    </View>
  );
}
