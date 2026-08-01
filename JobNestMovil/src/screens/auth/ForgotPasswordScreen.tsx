import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { AuthCard, Field, GhostButton, PrimaryButton } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { requestPasswordReset } from '../../services/authService';
import { styles } from '../../styles/theme';
import type { FieldErrors } from '../../types/forms';
import { cleanText, isEmail, mergeServerErrors } from '../../utils/validation';

type ForgotField = 'correo';

export function ForgotPasswordScreen({ onBack, initialEmail }: { onBack: () => void; initialEmail?: string }) {
  const { apiFetch, loading } = useAuth();
  const [correo, setCorreo] = useState(initialEmail ?? '');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<FieldErrors<ForgotField>>({});

  const handleSubmit = async () => {
    const email = cleanText(correo).toLowerCase();
    const nextErrors: FieldErrors<ForgotField> = {};
    if (!email) nextErrors.correo = 'El correo es obligatorio.';
    else if (!isEmail(email)) nextErrors.correo = 'Ingresa un correo válido.';
    setCorreo(email);
    setErrors(nextErrors);
    setMessage('');
    if (Object.keys(nextErrors).length) return;

    try {
      const response = await requestPasswordReset(apiFetch, email);
      setMessage(response.message);
      Alert.alert('Revisa tu correo', response.message);
    } catch (error) {
      const parsed = mergeServerErrors<ForgotField>(error, 'No fue posible procesar la solicitud.');
      setErrors(parsed.errors);
      setMessage(parsed.message);
    }
  };

  return (
    <AuthCard title="Recuperar contraseña" subtitle="Te enviaremos un enlace temporal si el correo está registrado.">
      <Field label="Correo" value={correo} onChangeText={(value) => { setCorreo(value); setErrors({}); }} keyboardType="email-address" error={errors.correo} />
      <PrimaryButton title={loading ? 'Enviando...' : 'Enviar instrucciones'} onPress={handleSubmit} disabled={loading} />
      <GhostButton title="Volver al inicio de sesión" onPress={onBack} />
      {message ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{message}</Text>
        </View>
      ) : null}
    </AuthCard>
  );
}
