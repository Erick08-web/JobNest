import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { AuthCard, Badge, Field, PrimaryButton } from '../../components/ui';
import { sendServiceRequest } from '../../services/requestService';
import { styles } from '../../styles/theme';
import type { Publication } from '../../types/domain';
import { getPublicationId, money, normalizePublication } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';

export function DetailScreen({
  publication,
  onLoginRequired,
  onRequestSent,
}: {
  publication: Publication;
  onLoginRequired: () => void;
  onRequestSent: () => void;
}) {
  const { isLoggedIn, apiFetch, setLoading } = useAuth();
  const item = normalizePublication(publication);
  const [serviceDate, setServiceDate] = useState('2026-07-10');
  const [serviceTime, setServiceTime] = useState('10:00');
  const [serviceMessage, setServiceMessage] = useState('Hola, me interesa contratar este servicio.');

  const handleRequestService = async () => {
    if (!isLoggedIn) {
      onLoginRequired();
      return;
    }

    const id = getPublicationId(item);
    if (!id) {
      Alert.alert('Servicio no valido', 'Selecciona un servicio publicado.');
      return;
    }

    setLoading(true);
    try {
      await sendServiceRequest(apiFetch, {
        publicationId: id,
        serviceDate,
        serviceTime,
        serviceMessage,
      });
      Alert.alert('Solicitud enviada', 'El profesional podra revisar tu solicitud.');
      onRequestSent();
    } catch (error) {
      Alert.alert('No se pudo enviar', error instanceof Error ? error.message : 'Intentalo de nuevo.');
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
        <Text style={styles.profileName}>{item.nombre_prestador}</Text>
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
        <Field label="Fecha" value={serviceDate} onChangeText={setServiceDate} placeholder="YYYY-MM-DD" />
        <Field label="Hora" value={serviceTime} onChangeText={setServiceTime} placeholder="HH:MM" />
        <Field label="Mensaje" value={serviceMessage} onChangeText={setServiceMessage} multiline />
        <PrimaryButton title="Enviar solicitud" onPress={handleRequestService} />
      </AuthCard>
    </View>
  );
}
