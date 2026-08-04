import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { AuthCard, Field, GhostButton, PrimaryButton } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { resetPassword } from '../../services/authService';
import { styles } from '../../styles/theme';
import type { FieldErrors } from '../../types/forms';
import { mergeServerErrors, validatePassword } from '../../utils/validation';

type ResetField = 'token' | 'password' | 'password_confirmation';

export function ResetPasswordScreen({ token: initialToken, onBack, onRequestNew }: { token?: string; onBack: () => void; onRequestNew: () => void }) {
  const { apiFetch, loading } = useAuth();
  const [token, setToken] = useState(initialToken ?? '');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<FieldErrors<ResetField>>({});

  const handleSubmit = async () => {
    const nextErrors: FieldErrors<ResetField> = {};
    if (!token) nextErrors.token = 'El enlace es inválido o ha expirado.';
    else if (token.length > 256 || !/^[A-Za-z0-9_-]+$/.test(token)) nextErrors.token = 'El enlace es inválido o ha expirado.';
    const passwordError = validatePassword(password);
    if (passwordError) nextErrors.password = passwordError;
    if (!confirmation) nextErrors.password_confirmation = 'Confirma tu contraseña.';
    else if (password !== confirmation) nextErrors.password_confirmation = 'Las contraseñas no coinciden.';
    setErrors(nextErrors);
    setMessage('');
    if (Object.keys(nextErrors).length) return;

    try {
      const response = await resetPassword(apiFetch, token, password, confirmation);
      setPassword('');
      setConfirmation('');
      setToken('');
      setMessage(response.message);
      Alert.alert('Contraseña actualizada', response.message, [{ text: 'Iniciar sesión', onPress: onBack }]);
    } catch (error) {
      const parsed = mergeServerErrors<ResetField>(error, 'No fue posible restablecer la contraseña.');
      setErrors(parsed.errors);
      setMessage(parsed.message);
    }
  };

  return (
    <AuthCard title="Nueva contraseña" subtitle="Usa el código del enlace que recibiste.">
      <Field label="Código del enlace" value={token} onChangeText={(value) => { setToken(value); setErrors((current) => ({ ...current, token: undefined })); }} autoCapitalize="none" error={errors.token} />
      <Field label="Nueva contraseña" value={password} onChangeText={(value) => { setPassword(value); setErrors((current) => ({ ...current, password: undefined })); }} secureTextEntry error={errors.password} />
      <Field label="Confirmar contraseña" value={confirmation} onChangeText={(value) => { setConfirmation(value); setErrors((current) => ({ ...current, password_confirmation: undefined })); }} secureTextEntry error={errors.password_confirmation} />
      <PrimaryButton title={loading ? 'Guardando...' : 'Guardar contraseña'} onPress={handleSubmit} disabled={loading} />
      <GhostButton title="Solicitar un nuevo enlace" onPress={onRequestNew} />
      <GhostButton title="Volver al inicio de sesión" onPress={onBack} />
      {message ? (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>{message}</Text>
        </View>
      ) : null}
    </AuthCard>
  );
}
