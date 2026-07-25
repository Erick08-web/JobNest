import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { AuthCard, Badge, Field, PrimaryButton } from '../../components/ui';
import { sendServiceRequest } from '../../services/requestService';
import { styles } from '../../styles/theme';
import type { Publication } from '../../types/domain';
import { getPublicationId, money, normalizePublication } from '../../utils/formatters';
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
  const { isLoggedIn, apiFetch, loading, setLoading } = useAuth();
  const item = normalizePublication(publication);
  const [serviceDate, setServiceDate] = useState('');
  const [serviceTime, setServiceTime] = useState('');
  const [serviceMessage, setServiceMessage] = useState('');
  const [errors, setErrors] = useState<FieldErrors<RequestField>>({});

  const handleRequestService = async () => {
    if (!isLoggedIn) {
      onLoginRequired();
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
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarText}>{String(item.nombre_prestador ?? 'JN').slice(0, 2).toUpperCase()}</Text>
        </View>
        <Text style={styles.profileName}>{item.nombre_prestador || 'Prestador no especificado'}</Text>
        <Text style={styles.profileRole}>{item.titulo}</Text>
        <View style={styles.metaRow}>
          <Badge text={`${item.promedio_calificacion} rating`} />
          <Badge text={item.ubicacion ?? 'Ubicacion'} />
          <Badge text={item.disponibilidad ?? 'Disponible'} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sobre el servicio</Text>
        <Text style={styles.bodyText}>{item.descripcion}</Text>
        <View style={styles.pricePanel}>
          <Text style={styles.priceLabel}>Tarifa estimada</Text>
          <Text style={styles.priceText}>{money(item.salario)} / hora</Text>
        </View>
      </View>

      <AuthCard title="Solicitar servicio" subtitle="El profesional recibira fecha, hora y mensaje.">
        <Field label="Fecha" value={serviceDate} onChangeText={(value) => { setServiceDate(value); setErrors((current) => ({ ...current, fecha_servicio: undefined })); }} placeholder="YYYY-MM-DD" error={errors.fecha_servicio} />
        <Field label="Hora" value={serviceTime} onChangeText={(value) => { setServiceTime(value); setErrors((current) => ({ ...current, hora_servicio: undefined })); }} placeholder="HH:MM" error={errors.hora_servicio} />
        <Field label="Mensaje" value={serviceMessage} onChangeText={(value) => { setServiceMessage(value); setErrors((current) => ({ ...current, mensaje: undefined })); }} multiline error={errors.mensaje} />
        <PrimaryButton title="Enviar solicitud" onPress={handleRequestService} disabled={loading} />
      </AuthCard>
    </View>
  );
}
