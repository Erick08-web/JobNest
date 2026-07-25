import React, { useState } from 'react';
import { Alert } from 'react-native';
import { AuthCard, Field, GhostButton, PrimaryButton } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';

export function LoginScreen({
  initialEmail,
  onRegister,
}: {
  initialEmail?: string;
  onRegister: () => void;
}) {
  const { login, loading } = useAuth();
  const [loginEmail, setLoginEmail] = useState(initialEmail ?? '');
  const [loginPassword, setLoginPassword] = useState('');

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) {
      Alert.alert('Faltan datos', 'Escribe tu correo y contrasena.');
      return;
    }

    try {
      await login(loginEmail, loginPassword);
    } catch (error) {
      Alert.alert('No se pudo iniciar sesion', error instanceof Error ? error.message : 'Revisa tu API y tus datos.');
    }
  };

  return (
    <AuthCard title="Inicia sesion" subtitle="Entra a tu cuenta para contratar o publicar servicios.">
      <Field label="Correo" value={loginEmail} onChangeText={setLoginEmail} keyboardType="email-address" />
      <Field label="Contrasena" value={loginPassword} onChangeText={setLoginPassword} secureTextEntry />
      <PrimaryButton title="Entrar a JobNest" onPress={handleLogin} disabled={loading} />
      <GhostButton title="Crear cuenta nueva" onPress={onRegister} />
    </AuthCard>
  );
}
