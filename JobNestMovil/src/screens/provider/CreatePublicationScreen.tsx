import React, { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, Pressable, Text, View } from 'react-native';
import { AuthCard, Field, GhostButton, PrimaryButton, Segmented } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { createPublication } from '../../services/publicationService';
import type { Category } from '../../types/domain';
import type { FieldErrors } from '../../types/forms';
import { palette, styles } from '../../styles/theme';
import { cleanText, mergeServerErrors } from '../../utils/validation';

type PublicationField = 'titulo' | 'descripcion' | 'categoria' | 'salario' | 'ubicacion' | 'experiencia' | 'habilidades' | 'disponibilidad' | 'tipo_precio';

export function CreatePublicationScreen({ categories, onPublished }: { categories: Category[]; onPublished: () => void }) {
  const { apiFetch, loading, setLoading } = useAuth();
  const [postTitle, setPostTitle] = useState('');
  const [postCategory, setPostCategory] = useState('');
  const [postPrice, setPostPrice] = useState('');
  const [postLocation, setPostLocation] = useState('');
  const [postDescription, setPostDescription] = useState('');
  const [postSkills, setPostSkills] = useState('');
  const [postExperience, setPostExperience] = useState('');
  const [postAvailability, setPostAvailability] = useState('');
  const [postPriceType, setPostPriceType] = useState('');
  const [selectedImages, setSelectedImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [errors, setErrors] = useState<FieldErrors<PublicationField>>({});

  const pickImages = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permiso necesario', 'Permite acceder a tus fotos para agregar imágenes del servicio.');
      return;
    }

    const remaining = 8 - selectedImages.length;
    if (remaining <= 0) {
      Alert.alert('Límite alcanzado', 'Puedes agregar hasta 8 imágenes por publicación.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.82,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
    });
    if (result.canceled) return;

    const validImages = result.assets.filter((asset) => !asset.fileSize || asset.fileSize <= 5 * 1024 * 1024);
    const rejected = result.assets.length - validImages.length;
    if (rejected > 0) {
      Alert.alert('Algunas fotos no se agregaron', 'Cada imagen debe pesar máximo 5 MB.');
    }
    setSelectedImages((current) => [...current, ...validImages].slice(0, 8));
  };

  const removeImage = (uri: string) => {
    setSelectedImages((current) => current.filter((image) => image.uri !== uri));
  };

  const handlePublish = async () => {
    const nextErrors: FieldErrors<PublicationField> = {};
    const title = cleanText(postTitle);
    const description = cleanText(postDescription);
    const category = cleanText(postCategory);
    const price = cleanText(postPrice);
    const location = cleanText(postLocation);
    const experience = cleanText(postExperience);
    const skills = cleanText(postSkills);
    const availability = cleanText(postAvailability);
    const priceType = cleanText(postPriceType || 'hora');
    const numericPrice = Number(price);
    const numericExperience = Number(experience);

    if (!title) nextErrors.titulo = 'El título es obligatorio.';
    else if (title.length < 5) nextErrors.titulo = 'El título debe tener al menos 5 caracteres.';
    else if (title.length > 255) nextErrors.titulo = 'El título debe tener máximo 255 caracteres.';
    if (!description) nextErrors.descripcion = 'La descripción es obligatoria.';
    else if (description.length < 20) nextErrors.descripcion = 'La descripción debe tener al menos 20 caracteres.';
    else if (description.length > 4000) nextErrors.descripcion = 'La descripción debe tener máximo 4000 caracteres.';
    if (!category) nextErrors.categoria = 'La categoría es obligatoria.';
    if (!price) nextErrors.salario = 'El precio es obligatorio.';
    else if (!Number.isFinite(numericPrice)) nextErrors.salario = 'El precio debe ser numérico.';
    else if (numericPrice <= 0) nextErrors.salario = 'El precio debe ser mayor que cero.';
    else if (numericPrice > 1000000) nextErrors.salario = 'El precio no debe superar $1,000,000.';
    if (!location) nextErrors.ubicacion = 'La ubicación es obligatoria.';
    else if (location.length > 255) nextErrors.ubicacion = 'La ubicación debe tener máximo 255 caracteres.';
    if (!experience) nextErrors.experiencia = 'La experiencia es obligatoria.';
    else if (!Number.isInteger(numericExperience) || numericExperience < 0 || numericExperience > 80) nextErrors.experiencia = 'La experiencia debe estar entre 0 y 80 años.';
    if (skills.length > 500) nextErrors.habilidades = 'Las habilidades deben tener máximo 500 caracteres.';
    if (availability.length > 100) nextErrors.disponibilidad = 'La disponibilidad debe tener máximo 100 caracteres.';
    if (!['hora', 'servicio', 'dia', 'proyecto'].includes(priceType)) nextErrors.tipo_precio = 'Usa hora, servicio, dia o proyecto.';

    setPostTitle(title);
    setPostDescription(description);
    setPostCategory(category);
    setPostPrice(price);
    setPostLocation(location);
    setPostExperience(experience);
    setPostSkills(skills);
    setPostAvailability(availability);
    setPostPriceType(priceType);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      return;
    }

    setLoading(true);
    try {
      await createPublication(apiFetch, {
        postTitle: title,
        postDescription: description,
        postCategory: category,
        postPrice: price,
        postLocation: location,
        postSkills: skills,
        postExperience: experience,
        postAvailability: availability,
        postPriceType: priceType,
        images: selectedImages.map((image, index) => ({
          uri: image.uri,
          fileName: image.fileName || `servicio-${Date.now()}-${index}.jpg`,
          mimeType: image.mimeType || 'image/jpeg',
        })),
      });
      Alert.alert('Servicio publicado', 'Tu servicio ya puede aparecer para clientes.');
      setPostTitle('');
      setPostCategory('');
      setPostPrice('');
      setPostLocation('');
      setPostDescription('');
      setPostSkills('');
      setPostExperience('');
      setPostAvailability('');
      setPostPriceType('');
      setSelectedImages([]);
      onPublished();
    } catch (error) {
      const parsed = mergeServerErrors<PublicationField>(error, 'Revisa los datos de la publicación.');
      setErrors(parsed.errors);
      Alert.alert('No se pudo publicar', parsed.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Publica tu servicio" subtitle="Muestra que haces, cuanto cobras y donde puedes atender.">
      <Field label="Titulo del servicio" value={postTitle} onChangeText={(value) => { setPostTitle(value); setErrors((current) => ({ ...current, titulo: undefined })); }} error={errors.titulo} />
      <Segmented value={postCategory} options={categories.map((category) => category.nombre)} onChange={(value) => { setPostCategory(value); setErrors((current) => ({ ...current, categoria: undefined })); }} />
      {errors.categoria ? <Field label="Categoria" value={postCategory} onChangeText={setPostCategory} error={errors.categoria} /> : null}
      <Field label="Precio" value={postPrice} onChangeText={(value) => { setPostPrice(value); setErrors((current) => ({ ...current, salario: undefined })); }} keyboardType="numeric" error={errors.salario} />
      <Field label="Ubicacion" value={postLocation} onChangeText={(value) => { setPostLocation(value); setErrors((current) => ({ ...current, ubicacion: undefined })); }} error={errors.ubicacion} />
      <Field label="Habilidades" value={postSkills} onChangeText={(value) => { setPostSkills(value); setErrors((current) => ({ ...current, habilidades: undefined })); }} placeholder="Ej. React, branding, instalaciones" error={errors.habilidades} />
      <Field label="Experiencia" value={postExperience} onChangeText={(value) => { setPostExperience(value); setErrors((current) => ({ ...current, experiencia: undefined })); }} keyboardType="numeric" error={errors.experiencia} />
      <Field label="Disponibilidad" value={postAvailability} onChangeText={(value) => { setPostAvailability(value); setErrors((current) => ({ ...current, disponibilidad: undefined })); }} error={errors.disponibilidad} />
      <Field label="Tipo de precio" value={postPriceType} onChangeText={(value) => { setPostPriceType(value); setErrors((current) => ({ ...current, tipo_precio: undefined })); }} placeholder="hora, servicio, dia o proyecto" error={errors.tipo_precio} />
      <Field label="Descripcion" value={postDescription} onChangeText={(value) => { setPostDescription(value); setErrors((current) => ({ ...current, descripcion: undefined })); }} multiline error={errors.descripcion} />
      <View style={styles.photoPickerBlock}>
        <View style={styles.photoPickerHeader}>
          <View>
            <Text style={styles.photoPickerTitle}>Fotos del servicio</Text>
            <Text style={styles.photoPickerCaption}>{selectedImages.length ? `${selectedImages.length} de 8 seleccionadas` : 'Agrega imágenes reales de tu trabajo.'}</Text>
          </View>
          <GhostButton title="Agregar" onPress={pickImages} disabled={loading || selectedImages.length >= 8} />
        </View>
        {selectedImages.length ? (
          <View style={styles.photoPreviewGrid}>
            {selectedImages.map((image, index) => (
              <View key={`${image.uri}-${index}`} style={styles.photoPreviewItem}>
                <Image source={{ uri: image.uri }} style={styles.photoPreviewImage} resizeMode="cover" />
                {index === 0 ? (
                  <View style={styles.photoPrimaryBadge}>
                    <Text style={styles.photoPrimaryText}>Principal</Text>
                  </View>
                ) : null}
                <Pressable
                  style={({ pressed }) => [styles.photoRemoveButton, pressed && styles.pressed]}
                  onPress={() => removeImage(image.uri)}
                  accessibilityRole="button"
                  accessibilityLabel="Quitar foto"
                  hitSlop={8}
                >
                  <Ionicons name="close" size={16} color={palette.white} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.photoEmptyBox}>
            <Ionicons name="images-outline" size={22} color={palette.primary} />
            <Text style={styles.photoEmptyText}>Las fotos ayudan a que los clientes entiendan mejor tu servicio.</Text>
          </View>
        )}
      </View>
      <PrimaryButton title="Publicar servicio" onPress={handlePublish} disabled={loading} />
    </AuthCard>
  );
}
