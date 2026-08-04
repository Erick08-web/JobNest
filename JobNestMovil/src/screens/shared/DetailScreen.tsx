import React, { useMemo, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert, Image, ScrollView, Text, View } from 'react-native';
import { AuthCard, Badge, Field, PrimaryButton } from '../../components/ui';
import { sendServiceRequest } from '../../services/requestService';
import { styles } from '../../styles/theme';
import type { Publication } from '../../types/domain';
import { buildAbsoluteUrl, formatServicePrice, getPublicationId, normalizePublication } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import type { FieldErrors } from '../../types/forms';
import { cleanText, isHour, isIsoDate, isTodayOrFuture, mergeServerErrors } from '../../utils/validation';

type RequestField = 'publicacion_id' | 'fecha_servicio' | 'hora_servicio' | 'mensaje';

export function DetailScreen({
  publication,
  onLoginRequired,
  onRequestSent,
}: {
  publication: Publication;
  onLoginRequired: () => void;
  onRequestSent: () => void;
}) {
  const { isLoggedIn, apiFetch, apiUrl, loading, setLoading, user, currentUserType } = useAuth();
  const item = normalizePublication(publication);
  const imageUrls = useMemo(() => {
    const values = item.imagenes?.length ? item.imagenes : item.imagen_principal ? [item.imagen_principal] : [];
    return values.map((value) => buildAbsoluteUrl(apiUrl, value)).filter(Boolean);
  }, [apiUrl, item.imagen_principal, item.imagenes]);
  const imageUrl = imageUrls[0] ?? '';
  const price = formatServicePrice(item);
  const isOwner = currentUserType === 'Prestador' && Boolean(user?.email && item.prestador_email && user.email.toLowerCase() === item.prestador_email.toLowerCase());
  const [imageFailed, setImageFailed] = useState(false);
  const [serviceDate, setServiceDate] = useState('');
  const [serviceTime, setServiceTime] = useState('');
  const [serviceMessage, setServiceMessage] = useState('');
  const [errors, setErrors] = useState<FieldErrors<RequestField>>({});

  const handleRequestService = async () => {
    if (!isLoggedIn) {
      onLoginRequired();
      return;
    }
    if (isOwner) {
      Alert.alert('Publicación propia', 'No puedes solicitar un servicio publicado por tu propia cuenta.');
      return;
    }

    const id = getPublicationId(item);
    if (!id) {
      setErrors({ publicacion_id: 'Selecciona un servicio publicado.' });
      return;
    }

    const nextErrors: FieldErrors<RequestField> = {};
    const date = cleanText(serviceDate);
    const time = cleanText(serviceTime);
    const message = cleanText(serviceMessage);
    if (!date) nextErrors.fecha_servicio = 'La fecha del servicio es obligatoria.';
    else if (!isIsoDate(date)) nextErrors.fecha_servicio = 'Usa formato YYYY-MM-DD.';
    else if (!isTodayOrFuture(date)) nextErrors.fecha_servicio = 'La fecha no puede ser pasada.';
    if (time && !isHour(time)) nextErrors.hora_servicio = 'Usa formato HH:MM.';
    if (message.length > 1000) nextErrors.mensaje = 'El mensaje debe tener máximo 1000 caracteres.';

    setServiceDate(date);
    setServiceTime(time);
    setServiceMessage(message);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      return;
    }

    setLoading(true);
    try {
      await sendServiceRequest(apiFetch, {
        publicationId: id,
        serviceDate: date,
        serviceTime: time,
        serviceMessage: message,
      });
      Alert.alert('Solicitud enviada', 'El profesional podra revisar tu solicitud.');
      onRequestSent();
    } catch (error) {
      const parsed = mergeServerErrors<RequestField>(error, 'Intentalo de nuevo.');
      setErrors(parsed.errors);
      Alert.alert('No se pudo enviar', parsed.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <View style={styles.profileHero}>
        <View style={styles.cardImage}>
          {imageUrl && !imageFailed ? (
            <Image source={{ uri: imageUrl }} style={styles.cardImageFill} resizeMode="cover" onError={() => setImageFailed(true)} />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="briefcase-outline" size={30} style={styles.imagePlaceholderIcon} />
              <Text style={styles.imagePlaceholderText}>Servicio JobNest</Text>
            </View>
          )}
        </View>
        {imageUrls.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryRail} contentContainerStyle={styles.galleryRailContent}>
            {imageUrls.map((url, index) => (
              <Image key={`${url}-${index}`} source={{ uri: url }} style={styles.galleryThumb} resizeMode="cover" />
            ))}
          </ScrollView>
        ) : null}
        <Text style={styles.profileName}>{item.titulo}</Text>
        {item.nombre_prestador ? <Text style={styles.profileRole}>{item.nombre_prestador}</Text> : null}
        <View style={styles.metaRow}>
          {item.categoria ? <Badge text={item.categoria} /> : null}
          {item.ubicacion ? <Badge text={item.ubicacion} /> : null}
          {item.disponibilidad ? <Badge text={item.disponibilidad} /> : null}
          {item.promedio_calificacion ? <Badge text={`${item.promedio_calificacion} · ${item.total_resenas ?? 0} reseñas`} /> : null}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sobre el servicio</Text>
        <Text style={styles.bodyText}>{item.descripcion}</Text>
        {item.habilidades ? <View style={styles.metaRow}>{item.habilidades.split(',').slice(0, 5).map((skill) => <Badge key={skill.trim()} text={skill.trim()} />)}</View> : null}
        {price ? (
          <View style={styles.pricePanel}>
            <Text style={styles.priceLabel}>Precio</Text>
            <Text style={styles.priceText}>{price}</Text>
          </View>
        ) : null}
      </View>

      <AuthCard title={isOwner ? 'Tu publicación' : 'Solicitar servicio'} subtitle={isOwner ? 'Puedes revisar esta publicación como prestador.' : 'El profesional recibira fecha, hora y mensaje.'}>
        <Field label="Fecha" value={serviceDate} onChangeText={(value) => { setServiceDate(value); setErrors((current) => ({ ...current, fecha_servicio: undefined })); }} placeholder="YYYY-MM-DD" error={errors.fecha_servicio} />
        <Field label="Hora" value={serviceTime} onChangeText={(value) => { setServiceTime(value); setErrors((current) => ({ ...current, hora_servicio: undefined })); }} placeholder="HH:MM" error={errors.hora_servicio} />
        <Field label="Mensaje" value={serviceMessage} onChangeText={(value) => { setServiceMessage(value); setErrors((current) => ({ ...current, mensaje: undefined })); }} multiline error={errors.mensaje} />
        <PrimaryButton title={isOwner ? 'Publicación propia' : 'Enviar solicitud'} onPress={handleRequestService} disabled={loading || isOwner} />
      </AuthCard>
    </View>
  );
}
