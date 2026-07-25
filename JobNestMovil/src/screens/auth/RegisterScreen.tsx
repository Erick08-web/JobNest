import React, { useState } from 'react';
import { Alert } from 'react-native';
import { AuthCard, Field, PrimaryButton, Segmented } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { registerUser } from '../../services/authService';
import type { UserType } from '../../types/domain';

export function RegisterScreen({
  onRegistered,
}: {
  onRegistered: (credentials: { email: string }) => void;
}) {
  const { apiFetch, setLoading, setApiMessage } = useAuth();
  const [registerType, setRegisterType] = useState<UserType>('Cliente');
  const [firstName, setFirstName] = useState('');
  const [lastNameP, setLastNameP] = useState('');
  const [lastNameM, setLastNameM] = useState('');
  const [phone, setPhone] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');

  const handleRegister = async () => {
    if (!firstName || !lastNameP || !registerEmail || !registerPassword) {
      Alert.alert('Faltan datos', 'Completa nombre, apellido, correo y contrasena.');
      return;
    }

    setLoading(true);
    setApiMessage('');
    try {
      await registerUser(apiFetch, {
        registerType,
        firstName,
        lastNameP,
        lastNameM,
        phone,
        registerEmail,
        registerPassword,
      });
      Alert.alert('Cuenta creada', 'Ahora puedes iniciar sesion en JobNestMovil.');
      onRegistered({ email: registerEmail });
    } catch (error) {
      Alert.alert('No se pudo registrar', error instanceof Error ? error.message : 'Revisa la conexion con la API.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Crea tu cuenta" subtitle="Elige si entraras como cliente o como profesional.">
      <Segmented
        value={registerType}
        options={['Cliente', 'Prestador']}
        onChange={(value) => setRegisterType(value as UserType)}
      />
      <Field label="Nombre" value={firstName} onChangeText={setFirstName} />
      <Field label="Apellido paterno" value={lastNameP} onChangeText={setLastNameP} />
      <Field label="Apellido materno" value={lastNameM} onChangeText={setLastNameM} />
      <Field label="Telefono" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field label="Correo" value={registerEmail} onChangeText={setRegisterEmail} keyboardType="email-address" />
      <Field label="Contrasena" value={registerPassword} onChangeText={setRegisterPassword} secureTextEntry />
      <PrimaryButton title="Registrarme" onPress={handleRegister} />
    </AuthCard>
  );
}
