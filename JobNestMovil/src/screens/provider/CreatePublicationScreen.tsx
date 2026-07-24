import React, { useState } from 'react';
import { Alert } from 'react-native';
import { AuthCard, Field, PrimaryButton, Segmented } from '../../components/ui';
import { categories } from '../../constants/categories';
import { useAuth } from '../../context/AuthContext';
import { createPublication } from '../../services/publicationService';

export function CreatePublicationScreen({ onPublished }: { onPublished: () => void }) {
  const { apiFetch, setLoading } = useAuth();
  const [postTitle, setPostTitle] = useState('');
  const [postCategory, setPostCategory] = useState('Diseño');
  const [postPrice, setPostPrice] = useState('350');
  const [postLocation, setPostLocation] = useState('Queretaro');
  const [postDescription, setPostDescription] = useState('');
  const [postSkills, setPostSkills] = useState('');

  const handlePublish = async () => {
    if (!postTitle || !postDescription) {
      Alert.alert('Faltan datos', 'Agrega titulo y descripcion del servicio.');
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
      });
      Alert.alert('Servicio publicado', 'Tu servicio ya puede aparecer para clientes.');
      setPostTitle('');
      setPostDescription('');
      setPostSkills('');
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
      <Segmented value={postCategory} options={categories} onChange={setPostCategory} />
      <Field label="Precio por hora" value={postPrice} onChangeText={setPostPrice} keyboardType="numeric" />
      <Field label="Ubicacion" value={postLocation} onChangeText={setPostLocation} />
      <Field label="Habilidades" value={postSkills} onChangeText={setPostSkills} placeholder="Ej. React, branding, instalaciones" />
      <Field label="Descripcion" value={postDescription} onChangeText={setPostDescription} multiline />
      <PrimaryButton title="Publicar servicio" onPress={handlePublish} />
    </AuthCard>
  );
}
