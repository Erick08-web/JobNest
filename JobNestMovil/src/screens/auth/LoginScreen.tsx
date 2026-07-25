import React, { useState } from 'react';
import { Alert } from 'react-native';
import { AuthCard, Field, GhostButton, PrimaryButton } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import type { FieldErrors } from '../../types/forms';
import { cleanText, isEmail, mergeServerErrors } from '../../utils/validation';

type LoginField = 'email' | 'password';

export function LoginScreen({
  initialEmail,
  onRegister,
  onForgotPassword,
}: {
  initialEmail?: string;
  onRegister: () => void;
  onForgotPassword: () => void;
}) {
  const { login, loading } = useAuth();
  const [loginEmail, setLoginEmail] = useState(initialEmail ?? '');
  const [loginPassword, setLoginPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<LoginField>>({});

  const handleLogin = async () => {
    const nextErrors: FieldErrors<LoginField> = {};
    const email = cleanText(loginEmail).toLowerCase();
    if (!email) nextErrors.email = 'El correo es obligatorio.';
    else if (!isEmail(email)) nextErrors.email = 'Ingresa un correo válido.';
    if (!loginPassword) nextErrors.password = 'La contraseña es obligatoria.';

    setLoginEmail(email);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      return;
    }

    try {
      await login(email, loginPassword);
    } catch (error) {
      const parsed = mergeServerErrors<LoginField>(error, 'Revisa tu API y tus datos.');
      setErrors(parsed.errors);
      Alert.alert('No se pudo iniciar sesion', parsed.message);
    }
  };

  return (
    <AuthCard title="Inicia sesion" subtitle="Entra a tu cuenta para contratar o publicar servicios.">
      <Field label="Correo" value={loginEmail} onChangeText={(value) => { setLoginEmail(value); setErrors((current) => ({ ...current, email: undefined })); }} keyboardType="email-address" error={errors.email} />
      <Field label="Contrasena" value={loginPassword} onChangeText={(value) => { setLoginPassword(value); setErrors((current) => ({ ...current, password: undefined })); }} secureTextEntry error={errors.password} />
      <PrimaryButton title="Entrar a JobNest" onPress={handleLogin} disabled={loading} />
      <GhostButton title="Olvidé mi contraseña" onPress={onForgotPassword} />
      <GhostButton title="Crear cuenta nueva" onPress={onRegister} />
    </AuthCard>
  );
}
