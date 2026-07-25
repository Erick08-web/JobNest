import React, { useState } from 'react';
import { Alert } from 'react-native';
import { AuthCard, Field, PrimaryButton, Segmented } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { createPublication } from '../../services/publicationService';
import type { Category } from '../../types/domain';

export function CreatePublicationScreen({ categories, onPublished }: { categories: Category[]; onPublished: () => void }) {
  const { apiFetch, setLoading } = useAuth();
  const [postTitle, setPostTitle] = useState('');
  const [postCategory, setPostCategory] = useState('');
  const [postPrice, setPostPrice] = useState('');
  const [postLocation, setPostLocation] = useState('');
  const [postDescription, setPostDescription] = useState('');
  const [postSkills, setPostSkills] = useState('');
  const [postExperience, setPostExperience] = useState('');
  const [postAvailability, setPostAvailability] = useState('');
  const [postPriceType, setPostPriceType] = useState('');

  const handlePublish = async () => {
    if (!postTitle || !postDescription || !postCategory || !postLocation || !postExperience) {
      Alert.alert('Faltan datos', 'Agrega titulo, categoria, ubicacion, experiencia y descripcion del servicio.');
      return;
    }

    setLoading(true);
    try {
      await createPublication(apiFetch, {
        postTitle,
        postDescription,
        postCategory,
        postPrice,
        postLocation,
        postSkills,
        postExperience,
        postAvailability,
        postPriceType,
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
      onPublished();
    } catch (error) {
      Alert.alert('No se pudo publicar', error instanceof Error ? error.message : 'Revisa tu sesion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Publica tu servicio" subtitle="Muestra que haces, cuanto cobras y donde puedes atender.">
      <Field label="Titulo del servicio" value={postTitle} onChangeText={setPostTitle} />
      <Segmented value={postCategory} options={categories.map((category) => category.nombre)} onChange={setPostCategory} />
      <Field label="Precio" value={postPrice} onChangeText={setPostPrice} keyboardType="numeric" />
      <Field label="Ubicacion" value={postLocation} onChangeText={setPostLocation} />
      <Field label="Habilidades" value={postSkills} onChangeText={setPostSkills} placeholder="Ej. React, branding, instalaciones" />
      <Field label="Experiencia" value={postExperience} onChangeText={setPostExperience} />
      <Field label="Disponibilidad" value={postAvailability} onChangeText={setPostAvailability} />
      <Field label="Tipo de precio" value={postPriceType} onChangeText={setPostPriceType} placeholder="hora, servicio, dia o proyecto" />
      <Field label="Descripcion" value={postDescription} onChangeText={setPostDescription} multiline />
      <PrimaryButton title="Publicar servicio" onPress={handlePublish} />
    </AuthCard>
  );
}
