import React, { memo, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, Pressable, Text, View } from 'react-native';
import { styles } from '../styles/theme';
import type { Publication } from '../types/domain';
import { buildAbsoluteUrl, formatServicePrice, getPublicationId, getTitle, normalizePublication } from '../utils/formatters';
import { Badge } from './ui';

function ProfessionalCardBase({ publication, apiUrl, onPress }: { publication: Publication; apiUrl: string; onPress: () => void }) {
  const item = normalizePublication(publication);
  const imageUrl = buildAbsoluteUrl(apiUrl, item.imagen_principal);
  const price = formatServicePrice(item);
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <Pressable
      style={({ pressed }) => [styles.professionalCard, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Abrir servicio ${getTitle(item)}`}
      hitSlop={8}
    >
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
      <View style={styles.cardContent}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.professionalName} numberOfLines={2}>{getTitle(item)}</Text>
          {item.promedio_calificacion ? <Badge text={`${item.promedio_calificacion}`} /> : null}
        </View>
        {item.categoria ? <Text style={styles.professionalRole}>{item.categoria}</Text> : null}
        <Text style={styles.bodyText} numberOfLines={2}>{item.descripcion}</Text>
        <View style={styles.metaRow}>
          {item.nombre_prestador ? <Text style={styles.metaText}>{item.nombre_prestador}</Text> : null}
          {item.ubicacion ? <Text style={styles.metaText}>{item.ubicacion}</Text> : null}
          {price ? <Text style={styles.metaText}>{price}</Text> : null}
        </View>
        {item.disponibilidad ? <Text style={styles.availability}>{item.disponibilidad}</Text> : null}
        <Text style={styles.cardFooterAction}>Ver detalles</Text>
      </View>
    </Pressable>
  );
}

export const ProfessionalCard = memo(ProfessionalCardBase);

export function publicationKey(publication: Publication) {
  return `${getPublicationId(publication)}-${getTitle(publication)}`;
}
