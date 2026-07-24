import React from 'react';
import { Text, View } from 'react-native';
import { ProfessionalCard, publicationKey } from '../../components/ProfessionalCard';
import { GhostButton, PrimaryButton } from '../../components/ui';
import { categories } from '../../constants/categories';
import { styles } from '../../styles/theme';
import type { Publication } from '../../types/domain';
import { normalizePublication } from '../../utils/formatters';

export function HomeScreen({
  onLogin,
  onRegister,
  onExplore,
  publications,
  onOpenPublication,
}: {
  onLogin: () => void;
  onRegister: () => void;
  onExplore: () => void;
  publications: Publication[];
  onOpenPublication: (publication: Publication) => void;
}) {
  return (
    <View>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>JOBNEST MOVIL</Text>
        <Text style={styles.heroTitle}>Encuentra profesionales listos para resolver tu siguiente proyecto.</Text>
        <Text style={styles.heroText}>
          Contrata servicios locales, revisa solicitudes y publica tu trabajo desde el telefono.
        </Text>
        <View style={styles.heroActions}>
          <PrimaryButton title="Explorar servicios" onPress={onExplore} />
          <GhostButton title="Iniciar sesion" onPress={onLogin} />
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Categorias principales</Text>
        <Text style={styles.sectionSubtitle}>Busca por oficio, especialidad o necesidad.</Text>
      </View>
      <View style={styles.categoryGrid}>
        {categories.map((category) => (
          <View key={category} style={styles.categoryCard}>
            <Text style={styles.categoryTitle}>{category}</Text>
            <Text style={styles.categoryText}>Profesionales verificados</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Profesionales destacados</Text>
        <Text style={styles.sectionSubtitle}>Primer vistazo al marketplace movil.</Text>
      </View>
      {publications.map((publication) => {
        const item = normalizePublication(publication);
        return <ProfessionalCard key={publicationKey(item)} publication={item} onPress={() => onOpenPublication(item)} />;
      })}

      <View style={styles.ctaCard}>
        <Text style={styles.ctaTitle}>Tambien puedes publicar tu servicio.</Text>
        <Text style={styles.ctaText}>Crea una cuenta como prestador y empieza a recibir solicitudes desde JobNestMovil.</Text>
        <PrimaryButton title="Crear cuenta" onPress={onRegister} />
      </View>
    </View>
  );
}
