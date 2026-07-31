import React, { useState } from 'react';
import { Alert } from 'react-native';
import { AuthCard, Field, PrimaryButton, Segmented } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { registerUser } from '../../services/authService';
import type { UserType } from '../../types/domain';
import type { FieldErrors } from '../../types/forms';
import { cleanText, isEmail, isPhone, mergeServerErrors } from '../../utils/validation';

type RegisterField = 'firstName' | 'lastNameP' | 'lastNameM' | 'candidatePhone' | 'email' | 'password' | 'confirmPassword' | 'userType';

export function RegisterScreen({
  onRegistered,
}: {
  onRegistered: (credentials: { email: string }) => void;
}) {
  const { apiFetch, loading, setLoading, setApiMessage } = useAuth();
  const [registerType, setRegisterType] = useState<UserType>('Cliente');
  const [firstName, setFirstName] = useState('');
  const [lastNameP, setLastNameP] = useState('');
  const [lastNameM, setLastNameM] = useState('');
  const [phone, setPhone] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors<RegisterField>>({});

  const handleRegister = async () => {
    const nextErrors: FieldErrors<RegisterField> = {};
    const cleanFirstName = cleanText(firstName);
    const cleanLastNameP = cleanText(lastNameP);
    const cleanLastNameM = cleanText(lastNameM);
    const cleanPhone = cleanText(phone);
    const email = cleanText(registerEmail).toLowerCase();

    if (!cleanFirstName) nextErrors.firstName = 'El nombre es obligatorio.';
    else if (cleanFirstName.length > 100) nextErrors.firstName = 'El nombre debe tener máximo 100 caracteres.';
    if (!cleanLastNameP) nextErrors.lastNameP = 'El apellido paterno es obligatorio.';
    else if (cleanLastNameP.length > 100) nextErrors.lastNameP = 'El apellido paterno debe tener máximo 100 caracteres.';
    if (!cleanLastNameM) nextErrors.lastNameM = 'El apellido materno es obligatorio.';
    else if (cleanLastNameM.length > 100) nextErrors.lastNameM = 'El apellido materno debe tener máximo 100 caracteres.';
    if (cleanPhone && !isPhone(cleanPhone)) nextErrors.candidatePhone = 'El teléfono debe contener entre 10 y 20 dígitos.';
    if (!email) nextErrors.email = 'El correo es obligatorio.';
    else if (!isEmail(email) || email.length > 150) nextErrors.email = 'Ingresa un correo válido.';
    if (!registerPassword) nextErrors.password = 'La contraseña es obligatoria.';
    else if (registerPassword.length < 8) nextErrors.password = 'La contraseña debe tener al menos 8 caracteres.';
    if (!confirmPassword) nextErrors.confirmPassword = 'Confirma tu contraseña.';
    else if (registerPassword !== confirmPassword) nextErrors.confirmPassword = 'Las contraseñas no coinciden.';

    setFirstName(cleanFirstName);
    setLastNameP(cleanLastNameP);
    setLastNameM(cleanLastNameM);
    setPhone(cleanPhone);
    setRegisterEmail(email);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
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
        registerEmail: email,
        registerPassword,
        confirmPassword,
      });
      Alert.alert('Cuenta creada', 'Ahora puedes iniciar sesion en JobNestMovil.');
      onRegistered({ email });
    } catch (error) {
      const parsed = mergeServerErrors<RegisterField>(error, 'No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.');
      setErrors(parsed.errors);
      Alert.alert('No se pudo registrar', parsed.message);
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
      <Field label="Nombre" value={firstName} onChangeText={(value) => { setFirstName(value); setErrors((current) => ({ ...current, firstName: undefined })); }} error={errors.firstName} />
      <Field label="Apellido paterno" value={lastNameP} onChangeText={(value) => { setLastNameP(value); setErrors((current) => ({ ...current, lastNameP: undefined })); }} error={errors.lastNameP} />
      <Field label="Apellido materno" value={lastNameM} onChangeText={(value) => { setLastNameM(value); setErrors((current) => ({ ...current, lastNameM: undefined })); }} error={errors.lastNameM} />
      <Field label="Telefono" value={phone} onChangeText={(value) => { setPhone(value); setErrors((current) => ({ ...current, candidatePhone: undefined })); }} keyboardType="phone-pad" error={errors.candidatePhone} />
      <Field label="Correo" value={registerEmail} onChangeText={(value) => { setRegisterEmail(value); setErrors((current) => ({ ...current, email: undefined })); }} keyboardType="email-address" error={errors.email} />
      <Field label="Contrasena" value={registerPassword} onChangeText={(value) => { setRegisterPassword(value); setErrors((current) => ({ ...current, password: undefined })); }} secureTextEntry error={errors.password} />
      <Field label="Confirmar contrasena" value={confirmPassword} onChangeText={(value) => { setConfirmPassword(value); setErrors((current) => ({ ...current, confirmPassword: undefined })); }} secureTextEntry error={errors.confirmPassword} />
      <PrimaryButton title="Registrarme" onPress={handleRegister} disabled={loading} />
    </AuthCard>
  );
}
