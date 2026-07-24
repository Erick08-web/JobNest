import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { ProfessionalCard, publicationKey } from '../../components/ProfessionalCard';
import { EmptyState, GhostButton } from '../../components/ui';
import { categories } from '../../constants/categories';
import { styles } from '../../styles/theme';
import type { Publication } from '../../types/domain';

export function ExploreScreen({
  search,
  onSearch,
  publications,
  onRefresh,
  onOpenPublication,
}: {
  search: string;
  onSearch: (value: string) => void;
  publications: Publication[];
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
          <Pressable key={category} style={styles.filterChip} onPress={() => onSearch(category)}>
            <Text style={styles.filterChipText}>{category}</Text>
          </Pressable>
        ))}
      </View>
      <GhostButton title="Actualizar desde API" onPress={onRefresh} />
      {publications.length ? (
        publications.map((publication) => (
          <ProfessionalCard key={publicationKey(publication)} publication={publication} onPress={() => onOpenPublication(publication)} />
        ))
      ) : (
        <EmptyState title="No encontramos servicios" text="Prueba otra busqueda o actualiza desde la API." />
      )}
    </View>
  );
}
