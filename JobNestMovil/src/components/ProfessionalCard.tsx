import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { styles } from '../styles/theme';
import type { Publication } from '../types/domain';
import { getPublicationId, getTitle, money, normalizePublication } from '../utils/formatters';
import { Badge } from './ui';

export function ProfessionalCard({ publication, onPress }: { publication: Publication; onPress: () => void }) {
  const item = normalizePublication(publication);

  return (
    <Pressable style={({ pressed }) => [styles.professionalCard, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.cardImage}>
        <Text style={styles.cardImageText}>{String(item.categoria ?? 'JN').slice(0, 2).toUpperCase()}</Text>
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.professionalName}>{item.nombre_prestador}</Text>
          <Badge text={`${item.promedio_calificacion}`} />
        </View>
        <Text style={styles.professionalRole}>{getTitle(item)}</Text>
        <Text style={styles.bodyText} numberOfLines={2}>{item.descripcion}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{item.ubicacion}</Text>
          <Text style={styles.metaText}>{money(item.salario)} / hora</Text>
        </View>
        <Text style={styles.availability}>{item.disponibilidad}</Text>
      </View>
    </Pressable>
  );
}

export function publicationKey(publication: Publication) {
  return `${getPublicationId(publication)}-${getTitle(publication)}`;
}
