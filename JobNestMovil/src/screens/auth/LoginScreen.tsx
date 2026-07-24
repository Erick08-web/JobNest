import React, { useState } from 'react';
import { Alert } from 'react-native';
import { AuthCard, Field, GhostButton, PrimaryButton } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { fetchCurrentUser, login } from '../../services/authService';

export function LoginScreen({
  initialEmail,
  initialPassword,
  onRegister,
}: {
  initialEmail?: string;
  initialPassword?: string;
  onRegister: () => void;
}) {
  const { apiFetch, setUser, setLoading, setApiMessage } = useAuth();
  const [loginEmail, setLoginEmail] = useState(initialEmail ?? '');
  const [loginPassword, setLoginPassword] = useState(initialPassword ?? '');

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) {
      Alert.alert('Faltan datos', 'Escribe tu correo y contrasena.');
      return;
    }

    setLoading(true);
    setApiMessage('');
    try {
      await login(apiFetch, loginEmail, loginPassword);
      const nextUser = await fetchCurrentUser(apiFetch);
      setUser(nextUser);
    } catch (error) {
      Alert.alert('No se pudo iniciar sesion', error instanceof Error ? error.message : 'Revisa tu API y tus datos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Inicia sesion" subtitle="Entra a tu cuenta para contratar o publicar servicios.">
      <Field label="Correo" value={loginEmail} onChangeText={setLoginEmail} keyboardType="email-address" />
      <Field label="Contrasena" value={loginPassword} onChangeText={setLoginPassword} secureTextEntry />
      <PrimaryButton title="Entrar a JobNest" onPress={handleLogin} />
      <GhostButton title="Crear cuenta nueva" onPress={onRegister} />
    </AuthCard>
  );
}
