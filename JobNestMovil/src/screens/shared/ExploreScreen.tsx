import React, { useEffect, useMemo, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfessionalCard, publicationKey } from '../../components/ProfessionalCard';
import { EmptyState, GhostButton, SkeletonList } from '../../components/ui';
import { palette, spacing, styles } from '../../styles/theme';
import type { Category, Publication } from '../../types/domain';
import { formatServicePrice, normalizePublication } from '../../utils/formatters';

type SortMode = 'recommended' | 'recent' | 'price';

const SORT_OPTIONS: Array<{ label: string; value: SortMode }> = [
  { label: 'Recomendados', value: 'recommended' },
  { label: 'Recientes', value: 'recent' },
  { label: 'Precio', value: 'price' },
];

function normalizeText(value?: string | number | null) {
  return String(value ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function isSmokePublication(publication: Publication) {
  const haystack = normalizeText(`${publication.titulo} ${publication.descripcion} ${publication.nombre_prestador} ${publication.prestador_nombre}`);
  return haystack.includes('codex-smoke') || haystack.includes('codex smoke') || haystack.includes('codex prestador final');
}

function priceNumber(publication: Publication) {
  const value = Number(publication.precio ?? publication.salario ?? publication.Salario);
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function categoryName(category: Category | string) {
  return typeof category === 'string' ? category : category.nombre;
}

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
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState(search);
  const [debouncedQuery, setDebouncedQuery] = useState(search);
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [showFilters, setShowFilters] = useState(false);
  const [location, setLocation] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [availability, setAvailability] = useState('Todas');
  const [sort, setSort] = useState<SortMode>('recommended');

  useEffect(() => {
    setQuery(search);
    setDebouncedQuery(search);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      onSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [onSearch, query]);

  const normalizedPublications = useMemo(() => publications.map(normalizePublication), [publications]);
  const categoryOptions = useMemo(() => ['Todas', ...categories.map(categoryName).filter(Boolean)], [categories]);
  const availabilityOptions = useMemo(() => {
    const values = normalizedPublications.map((item) => item.disponibilidad).filter(Boolean) as string[];
    return ['Todas', ...Array.from(new Set(values)).slice(0, 6)];
  }, [normalizedPublications]);

  const filteredPublications = useMemo(() => {
    const term = normalizeText(debouncedQuery);
    const locationTerm = normalizeText(location);
    const max = Number(maxPrice);
    const hasMax = Number.isFinite(max) && max > 0;

    const results = normalizedPublications.filter((publication) => {
      const searchable = normalizeText(`${publication.titulo} ${publication.descripcion} ${publication.categoria} ${publication.ubicacion} ${publication.nombre_prestador} ${publication.prestador_nombre}`);
      const matchesSearch = !term || searchable.includes(term);
      const matchesCategory = selectedCategory === 'Todas' || publication.categoria === selectedCategory;
      const matchesLocation = !locationTerm || normalizeText(publication.ubicacion).includes(locationTerm);
      const matchesPrice = !hasMax || priceNumber(publication) <= max || priceNumber(publication) === Number.POSITIVE_INFINITY;
      const matchesAvailability = availability === 'Todas' || publication.disponibilidad === availability;
      return matchesSearch && matchesCategory && matchesLocation && matchesPrice && matchesAvailability;
    });

    return [...results].sort((a, b) => {
      const smokeDelta = Number(isSmokePublication(a)) - Number(isSmokePublication(b));
      if (smokeDelta) return smokeDelta;
      if (sort === 'price') return priceNumber(a) - priceNumber(b);
      if (sort === 'recent') return normalizeText(b.fecha_creacion).localeCompare(normalizeText(a.fecha_creacion));
      return Number(Boolean(b.imagen_principal)) - Number(Boolean(a.imagen_principal));
    });
  }, [availability, debouncedQuery, location, maxPrice, normalizedPublications, selectedCategory, sort]);

  const hasActiveFilters = Boolean(query.trim() || location.trim() || maxPrice.trim() || selectedCategory !== 'Todas' || availability !== 'Todas' || sort !== 'recommended');

  const clearFilters = () => {
    setQuery('');
    setDebouncedQuery('');
    onSearch('');
    setSelectedCategory('Todas');
    setLocation('');
    setMaxPrice('');
    setAvailability('Todas');
    setSort('recommended');
  };

  const renderHeader = () => (
    <View>
      <View style={styles.marketplaceHero}>
        <Text style={styles.eyebrow}>Explorar</Text>
        <Text style={styles.pageTitle}>Encuentra el servicio ideal.</Text>
        <Text style={styles.pageText}>Descubre profesionales disponibles y solicita ayuda en pocos pasos.</Text>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={21} style={styles.searchIcon} />
          <TextInput
            style={styles.searchField}
            value={query}
            onChangeText={setQuery}
            placeholder="¿Qué servicio necesitas?"
            placeholderTextColor="#98a2b3"
            returnKeyType="search"
            accessibilityLabel="Buscar servicios"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} style={styles.clearButton} accessibilityRole="button" accessibilityLabel="Limpiar búsqueda" hitSlop={8}>
              <Ionicons name="close" size={20} style={styles.clearButtonText} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalChips}>
        {categoryOptions.map((category) => {
          const active = selectedCategory === category;
          return (
            <Pressable
              key={category}
              style={[styles.filterChip, active && styles.filterChipActive, { marginRight: 8 }]}
              onPress={() => setSelectedCategory(category)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Filtrar por ${category}`}
            >
              <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{category}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.marketplaceToolbar}>
        <View>
          <Text style={styles.toolbarTitle}>{filteredPublications.length} servicios</Text>
          <Text style={styles.toolbarCaption}>{loading ? 'Actualizando resultados' : 'Publicaciones activas'}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            style={styles.iconButton}
            onPress={() => setShowFilters((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel="Abrir filtros"
            hitSlop={8}
          >
            <Ionicons name="options-outline" size={21} style={styles.iconButtonText} />
          </Pressable>
          <Pressable
            style={styles.refreshButton}
            onPress={onRefresh}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Actualizar servicios"
            hitSlop={8}
          >
            <Ionicons name="refresh" size={20} style={styles.refreshButtonText} />
          </Pressable>
        </View>
      </View>

      {showFilters ? (
        <View style={styles.filterPanel}>
          <Text style={styles.filterPanelTitle}>Filtros</Text>
          <Text style={styles.filterSectionLabel}>Ubicación</Text>
          <TextInput
            style={styles.miniInput}
            value={location}
            onChangeText={setLocation}
            placeholder="Ciudad o zona"
            placeholderTextColor="#98a2b3"
            accessibilityLabel="Filtrar por ubicación"
          />
          <Text style={styles.filterSectionLabel}>Precio máximo</Text>
          <TextInput
            style={styles.miniInput}
            value={maxPrice}
            onChangeText={setMaxPrice}
            placeholder="Ej. 500"
            keyboardType="numeric"
            placeholderTextColor="#98a2b3"
            accessibilityLabel="Filtrar por precio máximo"
          />
          <Text style={styles.filterSectionLabel}>Disponibilidad</Text>
          <View style={styles.filtersRow}>
            {availabilityOptions.map((option) => {
              const active = availability === option;
              return (
                <Pressable key={option} style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => setAvailability(option)} accessibilityRole="button" accessibilityState={{ selected: active }}>
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{option}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.filterSectionLabel}>Orden</Text>
          <View style={styles.filtersRow}>
            {SORT_OPTIONS.map((option) => {
              const active = sort === option.value;
              return (
                <Pressable key={option.value} style={[styles.filterChip, active && styles.filterChipActive]} onPress={() => setSort(option.value)} accessibilityRole="button" accessibilityState={{ selected: active }}>
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {hasActiveFilters ? (
        <View style={styles.activeFiltersRow}>
          {query ? <View style={styles.activeFilterChip}><Text style={styles.activeFilterText}>Búsqueda</Text></View> : null}
          {selectedCategory !== 'Todas' ? <View style={styles.activeFilterChip}><Text style={styles.activeFilterText}>{selectedCategory}</Text></View> : null}
          {location ? <View style={styles.activeFilterChip}><Text style={styles.activeFilterText}>Ubicación</Text></View> : null}
          {maxPrice ? <View style={styles.activeFilterChip}><Text style={styles.activeFilterText}>Hasta {formatServicePrice({ precio: maxPrice })}</Text></View> : null}
          {availability !== 'Todas' ? <View style={styles.activeFilterChip}><Text style={styles.activeFilterText}>{availability}</Text></View> : null}
          <Pressable style={styles.activeFilterChip} onPress={clearFilters} accessibilityRole="button" accessibilityLabel="Limpiar filtros">
            <Text style={styles.activeFilterText}>Limpiar</Text>
          </Pressable>
        </View>
      ) : null}

      {loading && !filteredPublications.length ? <SkeletonList /> : null}

      {error ? (
        <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
          <EmptyState title="No pudimos cargar los servicios" text="Revisa tu conexión e inténtalo nuevamente." />
          <GhostButton title="Reintentar" onPress={onRefresh} disabled={loading} />
        </View>
      ) : null}
    </View>
  );

  return (
    <FlatList
      style={styles.marketplaceList}
      contentContainerStyle={[styles.marketplaceContent, { paddingBottom: Math.max(insets.bottom + 120, 136) }]}
      data={error || (loading && !filteredPublications.length) ? [] : filteredPublications}
      keyExtractor={publicationKey}
      renderItem={({ item }) => <ProfessionalCard publication={item} apiUrl={apiUrl} onPress={() => onOpenPublication(item)} />}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={!loading && !error ? (
        <View style={{ gap: spacing.md }}>
          <EmptyState
            title={publications.length ? 'No encontramos servicios' : 'Aún no hay servicios disponibles'}
            text={publications.length ? 'Prueba con otra búsqueda o explora todas las categorías.' : 'Vuelve pronto para descubrir nuevos profesionales.'}
          />
          {hasActiveFilters ? <GhostButton title="Limpiar filtros" onPress={clearFilters} /> : null}
        </View>
      ) : null}
      ListFooterComponent={<View style={{ height: spacing.md }} />}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} tintColor={palette.primary} />}
      keyboardShouldPersistTaps="handled"
      initialNumToRender={6}
      windowSize={7}
    />
  );
}
