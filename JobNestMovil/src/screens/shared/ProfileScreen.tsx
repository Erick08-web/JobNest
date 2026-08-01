import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { Badge, EmptyState, Field, PrimaryButton, SkeletonList } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import {
  changeMobilePassword,
  fetchMobileProfile,
  fetchMyPortfolio,
  fetchMyReviews,
  updateMobileProfile,
  uploadProfilePhoto,
  type ProfileUpdatePayload,
} from '../../services/profileService';
import { palette, spacing, styles } from '../../styles/theme';
import type { MobileProfile, PortfolioWork, ProfileReviews, Publication, RequestItem } from '../../types/domain';
import type { FieldErrors } from '../../types/forms';
import { buildAbsoluteUrl, formatServicePrice, getRequestStatus, getTitle, normalizePublication } from '../../utils/formatters';
import { cleanText, isPhone, mergeServerErrors, validatePassword } from '../../utils/validation';

type ProfileField = 'nombre' | 'apellido_paterno' | 'apellido_materno' | 'telefono';
type PasswordField = 'current_password' | 'new_password' | 'confirm_password';

function fullName(profile?: MobileProfile | null) {
  return [profile?.nombre, profile?.apellido_paterno, profile?.apellido_materno].filter(Boolean).join(' ').trim() || 'Usuario JobNest';
}

function initials(profile?: MobileProfile | null) {
  const value = [profile?.nombre, profile?.apellido_paterno]
    .filter((part): part is string => Boolean(part))
    .map((part) => part.trim().charAt(0))
    .join('')
    .slice(0, 2);
  return (value || 'JN').toUpperCase();
}

function normalizeStatus(value?: string) {
  return (value ?? '').toLowerCase().trim();
}

function ProfileRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
}) {
  if (!value) return null;
  return (
    <View style={styles.profileRow}>
      <View style={styles.profileRowIcon}>
        <Ionicons name={icon} size={18} style={styles.profileRowIconText} />
      </View>
      <View style={styles.profileRowBody}>
        <Text style={styles.profileRowLabel}>{label}</Text>
        <Text style={styles.profileRowValue}>{value}</Text>
      </View>
    </View>
  );
}

function ProfileAction({
  icon,
  title,
  text,
  danger,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.profileAction, danger && styles.profileActionDanger, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      hitSlop={8}
    >
      <View style={[styles.profileActionIcon, danger && styles.profileActionIconDanger]}>
        <Ionicons name={icon} size={20} style={[styles.profileActionIconText, danger && styles.profileActionIconTextDanger]} />
      </View>
      <View style={styles.profileActionBody}>
        <Text style={[styles.profileActionTitle, danger && styles.profileActionTitleDanger]}>{title}</Text>
        <Text style={styles.profileActionText}>{text}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} style={styles.dashboardChevron} />
    </Pressable>
  );
}

export function ProfileScreen({
  publications,
  requests,
  apiUrl,
  onSettings,
  onExplore,
  onRequests,
  onPublish,
}: {
  publications: Publication[];
  requests: RequestItem[];
  apiUrl: string;
  onSettings: () => void;
  onExplore: () => void;
  onRequests: () => void;
  onPublish?: () => void;
}) {
  const { apiFetch, refreshUser, currentUserType, logout } = useAuth();
  const [profile, setProfile] = useState<MobileProfile | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioWork[]>([]);
  const [reviews, setReviews] = useState<ProfileReviews>({ promedio: null, total: 0, resenas: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [profileErrors, setProfileErrors] = useState<FieldErrors<ProfileField>>({});
  const [passwordErrors, setPasswordErrors] = useState<FieldErrors<PasswordField>>({});
  const [draftProfile, setDraftProfile] = useState<ProfileUpdatePayload>({});
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);

  const isProvider = currentUserType === 'Prestador';
  const photoUrl = buildAbsoluteUrl(apiUrl, profile?.foto_perfil);
  const completion = useMemo(() => {
    const items = [Boolean(profile?.nombre), Boolean(profile?.apellido_paterno), Boolean(profile?.email), Boolean(profile?.foto_perfil), Boolean(profile?.telefono)];
    return Math.round((items.filter(Boolean).length / items.length) * 100);
  }, [profile]);
  const activeRequests = useMemo(
    () => requests.filter((request) => ['pendiente', 'aceptada', 'en proceso', 'en_proceso'].includes(normalizeStatus(getRequestStatus(request)))),
    [requests],
  );
  const finishedRequests = useMemo(
    () => requests.filter((request) => ['completada', 'concluida', 'calificado', 'finalizada'].includes(normalizeStatus(getRequestStatus(request)))),
    [requests],
  );
  const ownPublications = useMemo(() => {
    const email = profile?.email?.toLowerCase();
    if (!email || !isProvider) return [];
    return publications
      .map(normalizePublication)
      .filter((publication) => publication.prestador_email?.toLowerCase() === email)
      .slice(0, 3);
  }, [isProvider, profile?.email, publications]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const nextProfile = await fetchMobileProfile(apiFetch);
      setProfile(nextProfile);
      setDraftProfile({
        nombre: nextProfile.nombre,
        apellido_paterno: nextProfile.apellido_paterno,
        apellido_materno: nextProfile.apellido_materno,
        telefono: nextProfile.telefono ?? '',
      });
      const [nextReviews, nextPortfolio] = await Promise.all([
        fetchMyReviews(apiFetch),
        isProvider ? fetchMyPortfolio(apiFetch) : Promise.resolve([]),
      ]);
      setReviews(nextReviews);
      setPortfolio(nextPortfolio);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'No pudimos cargar tu perfil.');
    } finally {
      setLoading(false);
    }
  }, [apiFetch, isProvider]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const validateProfile = () => {
    const nextErrors: FieldErrors<ProfileField> = {};
    const nombre = cleanText(draftProfile.nombre ?? '');
    const apellidoPaterno = cleanText(draftProfile.apellido_paterno ?? '');
    const apellidoMaterno = cleanText(draftProfile.apellido_materno ?? '');
    const telefono = cleanText(draftProfile.telefono ?? '');

    if (!nombre) nextErrors.nombre = 'El nombre es obligatorio.';
    if (!apellidoPaterno) nextErrors.apellido_paterno = 'El apellido paterno es obligatorio.';
    if (!apellidoMaterno) nextErrors.apellido_materno = 'El apellido materno es obligatorio.';
    if (telefono && !isPhone(telefono)) nextErrors.telefono = 'Usa de 10 a 20 dígitos.';
    setProfileErrors(nextErrors);
    return { valid: !Object.keys(nextErrors).length, payload: { nombre, apellido_paterno: apellidoPaterno, apellido_materno: apellidoMaterno, telefono } };
  };

  const saveProfile = async () => {
    const { valid, payload } = validateProfile();
    if (!valid) return;
    setSaving(true);
    setSuccess('');
    try {
      const response = await updateMobileProfile(apiFetch, payload);
      setProfile(response.perfil);
      setEditing(false);
      setSuccess('Perfil actualizado.');
      await refreshUser();
    } catch (saveError) {
      const parsed = mergeServerErrors<ProfileField>(saveError, 'No pudimos actualizar tu perfil.');
      setProfileErrors(parsed.errors);
      setError(parsed.message);
    } finally {
      setSaving(false);
    }
  };

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso necesario', 'Permite acceder a tus fotos para actualizar tu avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.82,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets[0]) return;

    setSaving(true);
    setSuccess('');
    try {
      const response = await uploadProfilePhoto(apiFetch, result.assets[0]);
      setProfile(response.perfil);
      setSuccess('Foto actualizada.');
      await refreshUser();
    } catch (photoError) {
      setError(photoError instanceof Error ? photoError.message : 'No pudimos actualizar la foto.');
    } finally {
      setSaving(false);
    }
  };

  const savePassword = async () => {
    const nextErrors: FieldErrors<PasswordField> = {};
    const passwordError = validatePassword(newPassword);
    if (!currentPassword) nextErrors.current_password = 'La contraseña actual es obligatoria.';
    if (passwordError) nextErrors.new_password = passwordError;
    if (!confirmPassword) nextErrors.confirm_password = 'Confirma tu nueva contraseña.';
    else if (newPassword !== confirmPassword) nextErrors.confirm_password = 'Las contraseñas no coinciden.';
    setPasswordErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      const response = await changeMobilePassword(apiFetch, { currentPassword, newPassword, confirmPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setChangingPassword(false);
      Alert.alert('Contraseña actualizada', response.message, [{ text: 'Iniciar sesión', onPress: () => { void logout(); } }]);
    } catch (passwordErrorResponse) {
      const parsed = mergeServerErrors<PasswordField>(passwordErrorResponse, 'No pudimos cambiar tu contraseña.');
      setPasswordErrors(parsed.errors);
      setError(parsed.message);
    } finally {
      setSaving(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert('Cerrar sesión', '¿Deseas cerrar sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: () => { void logout(); } },
    ]);
  };

  if (loading && !profile) {
    return (
      <ScrollView style={styles.marketplaceList} contentContainerStyle={styles.marketplaceContent}>
        <SkeletonList count={4} />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.marketplaceList}
      contentContainerStyle={[styles.marketplaceContent, { paddingBottom: 140 }]}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={loadProfile} tintColor={palette.primary} />}
      keyboardShouldPersistTaps="handled"
    >
      {error ? (
        <View style={{ gap: spacing.md }}>
          <EmptyState title="No pudimos cargar tu actividad" text="Inténtalo nuevamente." />
          <PrimaryButton title="Reintentar" onPress={loadProfile} disabled={loading} />
        </View>
      ) : null}

      {profile ? (
        <>
          <View style={styles.profileHero}>
            <Pressable onPress={pickPhoto} disabled={saving} accessibilityRole="button" accessibilityLabel="Cambiar foto de perfil" hitSlop={8}>
              <View style={styles.profileAvatarFrame}>
                {photoUrl ? <Image source={{ uri: photoUrl }} style={styles.profileAvatarImage} resizeMode="cover" /> : <Text style={styles.avatarText}>{initials(profile)}</Text>}
              </View>
            </Pressable>
            <Text style={styles.profileName}>{fullName(profile)}</Text>
            <Text style={styles.profileRole}>{currentUserType}</Text>
            <Text style={styles.profileEmail}>{profile.email}</Text>
            <View style={styles.profileCompletion}>
              <Text style={styles.profileCompletionText}>Perfil {completion}% completo</Text>
            </View>
          </View>

          {success ? (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>{success}</Text>
            </View>
          ) : null}

          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.dashboardSectionTitle}>Datos personales</Text>
                <Text style={styles.dashboardSectionCaption}>Información guardada en tu cuenta.</Text>
              </View>
              <Pressable onPress={() => setEditing((value) => !value)} accessibilityRole="button" accessibilityLabel="Editar perfil" hitSlop={8}>
                <Text style={styles.linkText}>{editing ? 'Cancelar' : 'Editar'}</Text>
              </Pressable>
            </View>
            {editing ? (
              <View style={styles.profileSectionCard}>
                <Field label="Nombre" value={draftProfile.nombre} onChangeText={(value) => { setDraftProfile((current) => ({ ...current, nombre: value })); setProfileErrors((current) => ({ ...current, nombre: undefined })); }} error={profileErrors.nombre} />
                <Field label="Apellido paterno" value={draftProfile.apellido_paterno} onChangeText={(value) => { setDraftProfile((current) => ({ ...current, apellido_paterno: value })); setProfileErrors((current) => ({ ...current, apellido_paterno: undefined })); }} error={profileErrors.apellido_paterno} />
                <Field label="Apellido materno" value={draftProfile.apellido_materno} onChangeText={(value) => { setDraftProfile((current) => ({ ...current, apellido_materno: value })); setProfileErrors((current) => ({ ...current, apellido_materno: undefined })); }} error={profileErrors.apellido_materno} />
                <Field label="Teléfono" value={draftProfile.telefono} onChangeText={(value) => { setDraftProfile((current) => ({ ...current, telefono: value })); setProfileErrors((current) => ({ ...current, telefono: undefined })); }} keyboardType="phone-pad" error={profileErrors.telefono} />
                <PrimaryButton title={saving ? 'Guardando...' : 'Guardar perfil'} onPress={saveProfile} disabled={saving} />
              </View>
            ) : (
              <View style={styles.profileSectionCard}>
                <ProfileRow icon="person-outline" label="Nombre" value={fullName(profile)} />
                <ProfileRow icon="mail-outline" label="Correo" value={profile.email} />
                <ProfileRow icon="call-outline" label="Teléfono" value={profile.telefono || 'Pendiente'} />
                <ProfileRow icon="shield-checkmark-outline" label="Estado" value={profile.activo ? 'Cuenta activa' : 'Cuenta inactiva'} />
                <ProfileRow icon="calendar-outline" label="Registro" value={profile.fecha_registro} />
              </View>
            )}
          </View>

          {isProvider ? (
            <>
              <View style={styles.sectionBlock}>
                <Text style={styles.dashboardSectionTitle}>Perfil profesional</Text>
                <View style={styles.metricGrid}>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricValue}>{ownPublications.length}</Text>
                    <Text style={styles.metricLabel}>Publicaciones activas</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <Text style={styles.metricValue}>{profile.profesional?.total_resenas ?? reviews.total}</Text>
                    <Text style={styles.metricLabel}>Reseñas</Text>
                  </View>
                </View>
              </View>

              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.dashboardSectionTitle}>Servicios publicados</Text>
                    <Text style={styles.dashboardSectionCaption}>Resumen de publicaciones propias.</Text>
                  </View>
                  {onPublish ? <Pressable onPress={onPublish} accessibilityRole="button" accessibilityLabel="Publicar servicio" hitSlop={8}><Text style={styles.linkText}>Publicar</Text></Pressable> : null}
                </View>
                {ownPublications.length ? ownPublications.map((publication) => (
                  <Pressable key={`${publication.id}-${getTitle(publication)}`} style={({ pressed }) => [styles.compactListItem, pressed && styles.pressed]} onPress={onExplore} accessibilityRole="button" accessibilityLabel={`Ver ${getTitle(publication)}`}>
                    <View style={styles.compactIconAlt}><Ionicons name="briefcase-outline" size={18} style={styles.compactIconTextAlt} /></View>
                    <View style={styles.compactItemBody}>
                      <Text style={styles.compactItemTitle} numberOfLines={1}>{getTitle(publication)}</Text>
                      <Text style={styles.compactItemText} numberOfLines={1}>{publication.categoria ?? 'Servicio'} · {formatServicePrice(publication) || 'Precio por confirmar'}</Text>
                    </View>
                    <Badge text="Activa" />
                  </Pressable>
                )) : <EmptyState title="Aún no tienes servicios publicados" text="Publica tu primer servicio para comenzar." />}
              </View>

              <View style={styles.sectionBlock}>
                <Text style={styles.dashboardSectionTitle}>Portafolio</Text>
                {portfolio.length ? portfolio.slice(0, 3).map((work) => (
                  <View key={work.id} style={styles.compactListItem}>
                    <View style={styles.compactIconAlt}><Ionicons name="images-outline" size={18} style={styles.compactIconTextAlt} /></View>
                    <View style={styles.compactItemBody}>
                      <Text style={styles.compactItemTitle} numberOfLines={1}>{work.titulo}</Text>
                      <Text style={styles.compactItemText} numberOfLines={1}>{work.publicacion_titulo ?? work.categoria ?? 'Trabajo realizado'}</Text>
                    </View>
                  </View>
                )) : <EmptyState title="Portafolio vacío" text="Cuando agregues trabajos desde una función compatible, aparecerán aquí." />}
              </View>
            </>
          ) : (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <View>
                  <Text style={styles.dashboardSectionTitle}>Actividad</Text>
                  <Text style={styles.dashboardSectionCaption}>Seguimiento de tus solicitudes.</Text>
                </View>
                <Pressable onPress={onRequests} accessibilityRole="button" accessibilityLabel="Ver solicitudes" hitSlop={8}>
                  <Text style={styles.linkText}>Ver</Text>
                </Pressable>
              </View>
              <View style={styles.metricGrid}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{activeRequests.length}</Text>
                  <Text style={styles.metricLabel}>Solicitudes activas</Text>
                </View>
                <View style={styles.metricCard}>
                  <Text style={styles.metricValue}>{finishedRequests.length}</Text>
                  <Text style={styles.metricLabel}>Trabajos concluidos</Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.sectionBlock}>
            <Text style={styles.dashboardSectionTitle}>Reseñas</Text>
            {reviews.total ? (
              <View style={styles.profileSectionCard}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.priceText}>{reviews.promedio?.toFixed(1) ?? '-'}</Text>
                  <Badge text={`${reviews.total} reseñas`} />
                </View>
                {reviews.resenas.slice(0, 3).map((review, index) => (
                  <View key={`${review.fecha}-${index}`} style={styles.tipBoxMuted}>
                    <Text style={styles.tipTitle}>{review.revisor_nombre ?? 'Usuario JobNest'} · {review.calificacion ?? '-'}</Text>
                    <Text style={styles.tipText}>{review.comentario || 'Sin comentario adicional.'}</Text>
                  </View>
                ))}
              </View>
            ) : <EmptyState title="Sin reseñas todavía" text="Las reseñas reales aparecerán cuando tus servicios sean calificados." />}
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.dashboardSectionTitle}>Seguridad</Text>
            <ProfileAction icon="key-outline" title="Cambiar contraseña" text="Valida tu contraseña actual y crea una nueva." onPress={() => setChangingPassword((value) => !value)} />
            {changingPassword ? (
              <View style={styles.profileSectionCard}>
                <Field label="Contraseña actual" value={currentPassword} onChangeText={(value) => { setCurrentPassword(value); setPasswordErrors((current) => ({ ...current, current_password: undefined })); }} secureTextEntry={!showPasswords} error={passwordErrors.current_password} />
                <Field label="Nueva contraseña" value={newPassword} onChangeText={(value) => { setNewPassword(value); setPasswordErrors((current) => ({ ...current, new_password: undefined })); }} secureTextEntry={!showPasswords} error={passwordErrors.new_password} />
                <Field label="Confirmar contraseña" value={confirmPassword} onChangeText={(value) => { setConfirmPassword(value); setPasswordErrors((current) => ({ ...current, confirm_password: undefined })); }} secureTextEntry={!showPasswords} error={passwordErrors.confirm_password} />
                <Pressable onPress={() => setShowPasswords((value) => !value)} accessibilityRole="button" accessibilityLabel="Mostrar u ocultar contraseñas" hitSlop={8}>
                  <Text style={styles.linkText}>{showPasswords ? 'Ocultar contraseñas' : 'Mostrar contraseñas'}</Text>
                </Pressable>
                <PrimaryButton title={saving ? 'Guardando...' : 'Actualizar contraseña'} onPress={savePassword} disabled={saving} />
              </View>
            ) : null}
          </View>

          <View style={styles.sectionBlock}>
            <Text style={styles.dashboardSectionTitle}>Preferencias</Text>
            <ProfileAction icon="settings-outline" title="Ajustes" text="Soporte y opciones avanzadas." onPress={onSettings} />
            <ProfileAction icon="log-out-outline" title="Cerrar sesión" text="Salir de esta cuenta en el dispositivo." danger onPress={confirmLogout} />
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}
