import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ProfessionalCard, publicationKey } from '../../components/ProfessionalCard';
import { EmptyState, GhostButton, LoadingPill } from '../../components/ui';
import { styles } from '../../styles/theme';
import type { Category, Publication } from '../../types/domain';

export function ExploreScreen({
  search,
  onSearch,
  publications,
  categories,
  apiUrl,
  loading,
  error,
  onRefresh,
  onOpenPublication,
}: {
  search: string;
  onSearch: (value: string) => void;
  publications: Publication[];
  categories: Category[];
  apiUrl: string;
  loading: boolean;
  error: string;
  onRefresh: () => void;
  onOpenPublication: (publication: Publication) => void;
}) {
  return (
    <View>
      <View style={styles.pageIntro}>
        <Text style={styles.eyebrow}>EXPLORAR</Text>
        <Text style={styles.pageTitle}>Servicios cerca de ti</Text>
        <Text style={styles.pageText}>Filtra por palabra clave y abre el perfil de cada servicio.</Text>
      </View>
      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={onSearch}
        placeholder="Busca arquitectos, fotografos, electricistas..."
        placeholderTextColor="#98a2b3"
      />
      <View style={styles.filtersRow}>
        {categories.slice(0, 4).map((category) => (
          <Pressable key={category.nombre} style={styles.filterChip} onPress={() => onSearch(category.nombre)}>
            <Text style={styles.filterChipText}>{category.nombre}</Text>
          </Pressable>
        ))}
      </View>
      <GhostButton title="Actualizar servicios" onPress={onRefresh} disabled={loading} />
      {loading ? (
        <LoadingPill />
      ) : error ? (
        <EmptyState title="No fue posible cargar servicios" text={error} />
      ) : publications.length ? (
        publications.map((publication) => (
          <ProfessionalCard key={publicationKey(publication)} publication={publication} apiUrl={apiUrl} onPress={() => onOpenPublication(publication)} />
        ))
      ) : (
        <EmptyState title="Sin servicios" text="No hay servicios disponibles por el momento." />
      )}
    </View>
  );
}
