import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { styles } from '../styles/theme';
import type { Publication } from '../types/domain';
import { buildAbsoluteUrl, getPublicationId, getTitle, money, normalizePublication } from '../utils/formatters';
import { Badge } from './ui';

export function ProfessionalCard({ publication, apiUrl, onPress }: { publication: Publication; apiUrl: string; onPress: () => void }) {
  const item = normalizePublication(publication);
  const imageUrl = buildAbsoluteUrl(apiUrl, item.imagen_principal);
  const price = item.precio_texto || money(item.salario);

  return (
    <Pressable style={({ pressed }) => [styles.professionalCard, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.cardImage}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.cardImageFill} resizeMode="cover" />
        ) : (
          <Text style={styles.cardImageText}>Sin imagen</Text>
        )}
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.professionalName}>{item.nombre_prestador || 'Prestador no especificado'}</Text>
          {item.promedio_calificacion ? <Badge text={`${item.promedio_calificacion}`} /> : null}
        </View>
        <Text style={styles.professionalRole}>{getTitle(item)}</Text>
        <Text style={styles.bodyText} numberOfLines={2}>{item.descripcion}</Text>
        <View style={styles.metaRow}>
          {item.ubicacion ? <Text style={styles.metaText}>{item.ubicacion}</Text> : null}
          {price ? <Text style={styles.metaText}>{price}</Text> : null}
        </View>
        {item.disponibilidad ? <Text style={styles.availability}>{item.disponibilidad}</Text> : null}
      </View>
    </Pressable>
  );
}

export function publicationKey(publication: Publication) {
  return `${getPublicationId(publication)}-${getTitle(publication)}`;
}
