import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  NativeModules,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Screen =
  | 'inicio'
  | 'login'
  | 'registro'
  | 'explorar'
  | 'detalle'
  | 'cliente'
  | 'profesional'
  | 'publicar'
  | 'solicitudes'
  | 'ajustes';

type UserType = 'Cliente' | 'Prestador';

type SessionUser = {
  id?: number;
  nombre?: string;
  apellido?: string;
  email?: string;
  tipo_usuario?: UserType | string;
  foto_perfil?: string;
};

type Publication = {
  id?: number;
  Id?: number;
  PublicacionId?: number;
  titulo?: string;
  Titulo?: string;
  descripcion?: string;
  Descripcion?: string;
  categoria?: string;
  Categoria?: string;
  ubicacion?: string;
  Ubicacion?: string;
  salario?: number | string;
  Salario?: number | string;
  precio?: number | string;
  nombre_prestador?: string;
  NombrePrestador?: string;
  calificacion?: number | string;
  promedio_calificacion?: number | string;
  disponibilidad?: string;
  Disponibilidad?: string;
  experiencia?: string;
  habilidades?: string;
};

type RequestItem = {
  id?: number;
  SolicitudId?: number;
  titulo?: string;
  Titulo?: string;
  estado?: string;
  Estado?: string;
  fecha_servicio?: string;
  FechaServicio?: string;
  cliente?: string;
  prestador?: string;
  mensaje?: string;
  Mensaje?: string;
};

type ApiOptions = RequestInit & { skipJson?: boolean };

const DEFAULT_API_URL = getDefaultApiUrl();
const PRIMARY = '#2563eb';
const INK = '#101828';
const MUTED = '#667085';
const SURFACE = '#ffffff';
const SOFT = '#f5f7fb';
const BORDER = '#e4e7ec';

const categories = ['Diseño', 'Arquitectura', 'Electricidad', 'Programación', 'Fotografía', 'Legal'];

function getDefaultApiUrl() {
  const scriptUrl = NativeModules.SourceCode?.scriptURL;

  if (typeof scriptUrl === 'string') {
    try {
      const { hostname } = new URL(scriptUrl);

      if (hostname) {
        return `http://${hostname}:5001`;
      }
    } catch {
      const host = scriptUrl.match(/\/\/([^/:]+)/)?.[1];

      if (host) {
        return `http://${host}:5001`;
      }
    }
  }

  return 'http://localhost:5001';
}

const mockProfessionals: Publication[] = [
  {
    id: 1,
    titulo: 'Diseño de identidad visual premium',
    categoria: 'Diseño',
    descripcion: 'Branding, logotipos, manual de marca y piezas para redes sociales.',
    ubicacion: 'Queretaro',
    salario: '450',
    nombre_prestador: 'Ana Morales',
    promedio_calificacion: '4.9',
    disponibilidad: 'Disponible esta semana',
  },
  {
    id: 2,
    titulo: 'Instalaciones electricas residenciales',
    categoria: 'Electricidad',
    descripcion: 'Diagnostico, reparacion e instalacion segura para casa y oficina.',
    ubicacion: 'El Marques',
    salario: '320',
    nombre_prestador: 'Luis Herrera',
    promedio_calificacion: '4.8',
    disponibilidad: 'Respuesta en 1 hora',
  },
  {
    id: 3,
    titulo: 'Landing pages y sistemas web',
    categoria: 'Programación',
    descripcion: 'Sitios modernos, paneles administrativos y automatizaciones para negocios.',
    ubicacion: 'Remoto',
    salario: '650',
    nombre_prestador: 'Mariana Rios',
    promedio_calificacion: '5.0',
    disponibilidad: 'Agenda abierta',
  },
];

function normalizePublication(item: Publication): Publication {
  return {
    ...item,
    id: item.id ?? item.Id ?? item.PublicacionId,
    titulo: item.titulo ?? item.Titulo ?? 'Servicio profesional',
    descripcion: item.descripcion ?? item.Descripcion ?? 'Servicio disponible en JobNest.',
    categoria: item.categoria ?? item.Categoria ?? 'Servicio',
    ubicacion: item.ubicacion ?? item.Ubicacion ?? 'Ubicacion no especificada',
    salario: item.salario ?? item.Salario ?? item.precio ?? 'A convenir',
    disponibilidad: item.disponibilidad ?? item.Disponibilidad ?? 'Consultar disponibilidad',
    nombre_prestador: item.nombre_prestador ?? item.NombrePrestador ?? 'Profesional JobNest',
    promedio_calificacion: item.promedio_calificacion ?? item.calificacion ?? 'Nuevo',
  };
}

function getPublicationId(item: Publication) {
  return item.id ?? item.Id ?? item.PublicacionId;
}

function getTitle(item: Publication) {
  return item.titulo ?? item.Titulo ?? 'Servicio profesional';
}

function getRequestTitle(item: RequestItem) {
  return item.titulo ?? item.Titulo ?? 'Solicitud de servicio';
}

function getRequestStatus(item: RequestItem) {
  return item.estado ?? item.Estado ?? 'Pendiente';
}

function money(value?: number | string) {
  if (value === undefined || value === null || value === '') return 'A convenir';
  const number = Number(value);
  if (Number.isFinite(number)) return `$${number.toLocaleString('es-MX')}`;
  return String(value);
}

function normalizeUserType(value?: string): UserType {
  return value?.toLowerCase() === 'prestador' ? 'Prestador' : 'Cliente';
}

function userTypeForApi(value: UserType) {
  return value === 'Prestador' ? 'prestador' : 'cliente';
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('inicio');
  const [previousScreen, setPreviousScreen] = useState<Screen>('inicio');
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [sessionCookie, setSessionCookie] = useState('');
  const [user, setUser] = useState<SessionUser | null>(null);
  const [publications, setPublications] = useState<Publication[]>(mockProfessionals);
  const [selectedPublication, setSelectedPublication] = useState<Publication | null>(null);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiMessage, setApiMessage] = useState('');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [registerType, setRegisterType] = useState<UserType>('Cliente');
  const [firstName, setFirstName] = useState('');
  const [lastNameP, setLastNameP] = useState('');
  const [lastNameM, setLastNameM] = useState('');
  const [phone, setPhone] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');

  const [search, setSearch] = useState('');
  const [serviceDate, setServiceDate] = useState('2026-07-10');
  const [serviceTime, setServiceTime] = useState('10:00');
  const [serviceMessage, setServiceMessage] = useState('Hola, me interesa contratar este servicio.');

  const [postTitle, setPostTitle] = useState('');
  const [postCategory, setPostCategory] = useState('Diseño');
  const [postPrice, setPostPrice] = useState('350');
  const [postLocation, setPostLocation] = useState('Queretaro');
  const [postDescription, setPostDescription] = useState('');
  const [postSkills, setPostSkills] = useState('');

  const currentUserType = normalizeUserType(user?.tipo_usuario ?? registerType);
  const isLoggedIn = Boolean(user);

  const filteredPublications = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return publications.map(normalizePublication);
    return publications
      .map(normalizePublication)
      .filter((item) => {
        const haystack = `${item.titulo} ${item.categoria} ${item.descripcion} ${item.ubicacion}`.toLowerCase();
        return haystack.includes(q);
      });
  }, [publications, search]);

  const go = (next: Screen) => {
    setPreviousScreen(screen);
    setScreen(next);
  };

  const apiFetch = useCallback(
    async (path: string, options: ApiOptions = {}) => {
      const normalizedBase = apiUrl.replace(/\/$/, '');
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      const headers: Record<string, string> = {
        Accept: 'application/json',
        ...(options.headers as Record<string, string> | undefined),
      };

      if (sessionCookie) headers.Cookie = sessionCookie;

      const response = await fetch(`${normalizedBase}${normalizedPath}`, {
        ...options,
        headers,
      });

      const cookie = response.headers.get('set-cookie');
      if (cookie) setSessionCookie(cookie.split(';')[0]);

      if (options.skipJson) return null;

      const text = await response.text();
      let data: any = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: text };
        }
      }

      if (!response.ok) {
        throw new Error(data?.message || data?.error || `Error ${response.status}`);
      }

      return data;
    },
    [apiUrl, sessionCookie],
  );

  const refreshUser = async () => {
    const data = await apiFetch('/get_user_data');
    const nextUser: SessionUser = data?.user ?? data ?? {};
    setUser(nextUser);
    return nextUser;
  };

  const loadPublications = async () => {
    setLoading(true);
    setApiMessage('');
    try {
      const data = await apiFetch('/publicaciones_activas');
      const list = Array.isArray(data) ? data : data?.publicaciones ?? data?.data ?? [];
      if (list.length) setPublications(list);
      setApiMessage('Servicios actualizados desde JobNest.');
    } catch (error) {
      setApiMessage(error instanceof Error ? error.message : 'No se pudo consultar la API.');
    } finally {
      setLoading(false);
    }
  };

  const loadRequests = async () => {
    setLoading(true);
    setApiMessage('');
    try {
      const endpoint = currentUserType === 'Prestador' ? '/mis_solicitudes_prestador' : '/mis_solicitudes_cliente';
      const data = await apiFetch(endpoint);
      const list = Array.isArray(data) ? data : data?.solicitudes ?? data?.data ?? [];
      setRequests(list);
      setApiMessage('Solicitudes actualizadas.');
    } catch (error) {
      setApiMessage(error instanceof Error ? error.message : 'No se pudieron cargar las solicitudes.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) {
      Alert.alert('Faltan datos', 'Escribe tu correo y contrasena.');
      return;
    }

    setLoading(true);
    setApiMessage('');
    try {
      const form = new FormData();
      form.append('email', loginEmail);
      form.append('password', loginPassword);
      await apiFetch('/login', { method: 'POST', body: form });
      const nextUser = await refreshUser();
      await loadPublications();
      setScreen(normalizeUserType(nextUser?.tipo_usuario) === 'Prestador' ? 'profesional' : 'cliente');
    } catch (error) {
      Alert.alert('No se pudo iniciar sesion', error instanceof Error ? error.message : 'Revisa tu API y tus datos.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!firstName || !lastNameP || !registerEmail || !registerPassword) {
      Alert.alert('Faltan datos', 'Completa nombre, apellido, correo y contrasena.');
      return;
    }

    setLoading(true);
    setApiMessage('');
    try {
      await apiFetch('/registrar_usuario_web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastNameP,
          lastNameM,
          candidatePhone: phone,
          email: registerEmail,
          password: registerPassword,
          confirmPassword: registerPassword,
          userType: userTypeForApi(registerType),
          termsCheck: 'on',
        }),
      });
      Alert.alert('Cuenta creada', 'Ahora puedes iniciar sesion en JobNestMovil.');
      setLoginEmail(registerEmail);
      setLoginPassword(registerPassword);
      setScreen('login');
    } catch (error) {
      Alert.alert('No se pudo registrar', error instanceof Error ? error.message : 'Revisa la conexion con la API.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestService = async () => {
    const id = selectedPublication ? getPublicationId(selectedPublication) : null;
    if (!id) {
      Alert.alert('Servicio no valido', 'Selecciona un servicio publicado.');
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append('publicacion_id', String(id));
      form.append('fecha_servicio', serviceDate);
      form.append('hora_servicio', serviceTime);
      form.append('mensaje', serviceMessage);
      await apiFetch('/enviar_solicitud', { method: 'POST', body: form });
      Alert.alert('Solicitud enviada', 'El profesional podra revisar tu solicitud.');
      setScreen('cliente');
    } catch (error) {
      Alert.alert('No se pudo enviar', error instanceof Error ? error.message : 'Intentalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!postTitle || !postDescription) {
      Alert.alert('Faltan datos', 'Agrega titulo y descripcion del servicio.');
      return;
    }

    setLoading(true);
    try {
      const form = new FormData();
      form.append('titulo', postTitle);
      form.append('descripcion', postDescription);
      form.append('categoria', postCategory);
      form.append('salario', postPrice);
      form.append('ubicacion', postLocation);
      form.append('experiencia', '1');
      form.append('habilidades', postSkills);
      form.append('disponibilidad', 'Disponible esta semana');
      form.append('tipo_precio', 'hora');
      await apiFetch('/crear_publicacion', { method: 'POST', body: form });
      Alert.alert('Servicio publicado', 'Tu servicio ya puede aparecer para clientes.');
      setPostTitle('');
      setPostDescription('');
      setPostSkills('');
      await loadPublications();
      setScreen('profesional');
    } catch (error) {
      Alert.alert('No se pudo publicar', error instanceof Error ? error.message : 'Revisa tu sesion.');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setSessionCookie('');
    setScreen('inicio');
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
      >
        <TopBar
          isLoggedIn={isLoggedIn}
          user={user}
          onHome={() => setScreen('inicio')}
          onSettings={() => go('ajustes')}
          onLogout={logout}
        />

        {screen !== 'inicio' && (
          <Pressable style={styles.backButton} onPress={() => setScreen(previousScreen === screen ? 'inicio' : previousScreen)}>
            <Text style={styles.backText}>Volver</Text>
          </Pressable>
        )}

        {apiMessage ? <Notice text={apiMessage} /> : null}
        {loading ? <LoadingPill /> : null}

        {screen === 'inicio' && (
          <HomeScreen
            onLogin={() => go('login')}
            onRegister={() => go('registro')}
            onExplore={() => {
              go('explorar');
              loadPublications();
            }}
            publications={publications.map(normalizePublication).slice(0, 3)}
            onOpenPublication={(publication) => {
              setSelectedPublication(publication);
              go('detalle');
            }}
          />
        )}

        {screen === 'login' && (
          <AuthCard title="Inicia sesion" subtitle="Entra a tu cuenta para contratar o publicar servicios.">
            <Field label="Correo" value={loginEmail} onChangeText={setLoginEmail} keyboardType="email-address" />
            <Field label="Contrasena" value={loginPassword} onChangeText={setLoginPassword} secureTextEntry />
            <PrimaryButton title="Entrar a JobNest" onPress={handleLogin} disabled={loading} />
            <GhostButton title="Crear cuenta nueva" onPress={() => setScreen('registro')} />
          </AuthCard>
        )}

        {screen === 'registro' && (
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
            <PrimaryButton title="Registrarme" onPress={handleRegister} disabled={loading} />
          </AuthCard>
        )}

        {screen === 'explorar' && (
          <ExploreScreen
            search={search}
            onSearch={setSearch}
            publications={filteredPublications}
            onRefresh={loadPublications}
            onOpenPublication={(publication) => {
              setSelectedPublication(publication);
              go('detalle');
            }}
          />
        )}

        {screen === 'detalle' && selectedPublication && (
          <DetailScreen
            publication={normalizePublication(selectedPublication)}
            serviceDate={serviceDate}
            setServiceDate={setServiceDate}
            serviceTime={serviceTime}
            setServiceTime={setServiceTime}
            serviceMessage={serviceMessage}
            setServiceMessage={setServiceMessage}
            onRequest={isLoggedIn ? handleRequestService : () => setScreen('login')}
          />
        )}

        {screen === 'cliente' && (
          <DashboardScreen
            role="Cliente"
            user={user}
            onExplore={() => {
              go('explorar');
              loadPublications();
            }}
            onRequests={() => {
              go('solicitudes');
              loadRequests();
            }}
            onPublish={() => setScreen('publicar')}
          />
        )}

        {screen === 'profesional' && (
          <DashboardScreen
            role="Prestador"
            user={user}
            onExplore={() => {
              go('explorar');
              loadPublications();
            }}
            onRequests={() => {
              go('solicitudes');
              loadRequests();
            }}
            onPublish={() => go('publicar')}
          />
        )}

        {screen === 'publicar' && (
          <AuthCard title="Publica tu servicio" subtitle="Muestra que haces, cuanto cobras y donde puedes atender.">
            <Field label="Titulo del servicio" value={postTitle} onChangeText={setPostTitle} />
            <Segmented value={postCategory} options={categories} onChange={setPostCategory} />
            <Field label="Precio por hora" value={postPrice} onChangeText={setPostPrice} keyboardType="numeric" />
            <Field label="Ubicacion" value={postLocation} onChangeText={setPostLocation} />
            <Field label="Habilidades" value={postSkills} onChangeText={setPostSkills} placeholder="Ej. React, branding, instalaciones" />
            <Field label="Descripcion" value={postDescription} onChangeText={setPostDescription} multiline />
            <PrimaryButton title="Publicar servicio" onPress={handlePublish} disabled={loading} />
          </AuthCard>
        )}

        {screen === 'solicitudes' && (
          <RequestsScreen requests={requests} onRefresh={loadRequests} role={currentUserType} />
        )}

        {screen === 'ajustes' && (
          <SettingsScreen apiUrl={apiUrl} setApiUrl={setApiUrl} sessionCookie={sessionCookie} />
        )}
      </ScrollView>
    </View>
  );
}

function TopBar({
  isLoggedIn,
  user,
  onHome,
  onSettings,
  onLogout,
}: {
  isLoggedIn: boolean;
  user: SessionUser | null;
  onHome: () => void;
  onSettings: () => void;
  onLogout: () => void;
}) {
  return (
    <View style={styles.topBar}>
      <Pressable style={styles.brand} onPress={onHome}>
        <View style={styles.logoMark}>
          <Text style={styles.logoText}>JN</Text>
        </View>
        <View>
          <Text style={styles.brandTitle}>JobNest</Text>
          <Text style={styles.brandSub}>Servicios confiables</Text>
        </View>
      </Pressable>
      <View style={styles.topActions}>
        <Pressable style={styles.iconButton} onPress={onSettings}>
          <Text style={styles.iconButtonText}>API</Text>
        </Pressable>
        {isLoggedIn ? (
          <Pressable style={styles.iconButton} onPress={onLogout}>
            <Text style={styles.iconButtonText}>Salir</Text>
          </Pressable>
        ) : null}
      </View>
      {user?.nombre ? <Text style={styles.welcome}>Hola, {user.nombre}</Text> : null}
    </View>
  );
}

function HomeScreen({
  onLogin,
  onRegister,
  onExplore,
  publications,
  onOpenPublication,
}: {
  onLogin: () => void;
  onRegister: () => void;
  onExplore: () => void;
  publications: Publication[];
  onOpenPublication: (publication: Publication) => void;
}) {
  return (
    <View>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>JOBNEST MOVIL</Text>
        <Text style={styles.heroTitle}>Encuentra profesionales listos para resolver tu siguiente proyecto.</Text>
        <Text style={styles.heroText}>
          Contrata servicios locales, revisa solicitudes y publica tu trabajo desde el telefono.
        </Text>
        <View style={styles.heroActions}>
          <PrimaryButton title="Explorar servicios" onPress={onExplore} />
          <GhostButton title="Iniciar sesion" onPress={onLogin} />
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Categorias principales</Text>
        <Text style={styles.sectionSubtitle}>Busca por oficio, especialidad o necesidad.</Text>
      </View>
      <View style={styles.categoryGrid}>
        {categories.map((category) => (
          <View key={category} style={styles.categoryCard}>
            <Text style={styles.categoryTitle}>{category}</Text>
            <Text style={styles.categoryText}>Profesionales verificados</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Profesionales destacados</Text>
        <Text style={styles.sectionSubtitle}>Primer vistazo al marketplace movil.</Text>
      </View>
      {publications.map((publication) => (
        <ProfessionalCard key={`${getPublicationId(publication)}-${getTitle(publication)}`} publication={publication} onPress={() => onOpenPublication(publication)} />
      ))}

      <View style={styles.ctaCard}>
        <Text style={styles.ctaTitle}>Tambien puedes publicar tu servicio.</Text>
        <Text style={styles.ctaText}>Crea una cuenta como prestador y empieza a recibir solicitudes desde JobNestMovil.</Text>
        <PrimaryButton title="Crear cuenta" onPress={onRegister} />
      </View>
    </View>
  );
}

function ExploreScreen({
  search,
  onSearch,
  publications,
  onRefresh,
  onOpenPublication,
}: {
  search: string;
  onSearch: (value: string) => void;
  publications: Publication[];
  onRefresh: () => void;
  onOpenPublication: (publication: Publication) => void;
}) {
  return (
    <View>
      <View style={styles.pageIntro}>
        <Text style={styles.eyebrow}>EXPLORAR</Text>
        <Text style={styles.pageTitle}>Servicios cerca de ti</Text>
        <Text style={styles.pageText}>Filtra por palabra clave y abre el perfil de cada servicio.</Text>
      </View>
      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={onSearch}
        placeholder="Busca arquitectos, fotografos, electricistas..."
        placeholderTextColor="#98a2b3"
      />
      <View style={styles.filtersRow}>
        {categories.slice(0, 4).map((category) => (
          <Pressable key={category} style={styles.filterChip} onPress={() => onSearch(category)}>
            <Text style={styles.filterChipText}>{category}</Text>
          </Pressable>
        ))}
      </View>
      <GhostButton title="Actualizar desde API" onPress={onRefresh} />
      {publications.length ? (
        publications.map((publication) => (
          <ProfessionalCard key={`${getPublicationId(publication)}-${getTitle(publication)}`} publication={publication} onPress={() => onOpenPublication(publication)} />
        ))
      ) : (
        <EmptyState title="No encontramos servicios" text="Prueba otra busqueda o actualiza desde la API." />
      )}
    </View>
  );
}

function DetailScreen({
  publication,
  serviceDate,
  setServiceDate,
  serviceTime,
  setServiceTime,
  serviceMessage,
  setServiceMessage,
  onRequest,
}: {
  publication: Publication;
  serviceDate: string;
  setServiceDate: (value: string) => void;
  serviceTime: string;
  setServiceTime: (value: string) => void;
  serviceMessage: string;
  setServiceMessage: (value: string) => void;
  onRequest: () => void;
}) {
  return (
    <View>
      <View style={styles.profileHero}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarText}>{String(publication.nombre_prestador ?? 'JN').slice(0, 2).toUpperCase()}</Text>
        </View>
        <Text style={styles.profileName}>{publication.nombre_prestador}</Text>
        <Text style={styles.profileRole}>{publication.titulo}</Text>
        <View style={styles.metaRow}>
          <Badge text={`${publication.promedio_calificacion} rating`} />
          <Badge text={publication.ubicacion ?? 'Ubicacion'} />
          <Badge text={publication.disponibilidad ?? 'Disponible'} />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sobre el servicio</Text>
        <Text style={styles.bodyText}>{publication.descripcion}</Text>
        <View style={styles.pricePanel}>
          <Text style={styles.priceLabel}>Tarifa estimada</Text>
          <Text style={styles.priceText}>{money(publication.salario)} / hora</Text>
        </View>
      </View>

      <AuthCard title="Solicitar servicio" subtitle="El profesional recibira fecha, hora y mensaje.">
        <Field label="Fecha" value={serviceDate} onChangeText={setServiceDate} placeholder="YYYY-MM-DD" />
        <Field label="Hora" value={serviceTime} onChangeText={setServiceTime} placeholder="HH:MM" />
        <Field label="Mensaje" value={serviceMessage} onChangeText={setServiceMessage} multiline />
        <PrimaryButton title="Enviar solicitud" onPress={onRequest} />
      </AuthCard>
    </View>
  );
}

function DashboardScreen({
  role,
  user,
  onExplore,
  onRequests,
  onPublish,
}: {
  role: UserType;
  user: SessionUser | null;
  onExplore: () => void;
  onRequests: () => void;
  onPublish: () => void;
}) {
  const isProvider = role === 'Prestador';
  return (
    <View>
      <View style={styles.dashboardHero}>
        <Text style={styles.eyebrow}>DASHBOARD {role.toUpperCase()}</Text>
        <Text style={styles.pageTitle}>{user?.nombre ? `Hola, ${user.nombre}` : 'Tu espacio JobNest'}</Text>
        <Text style={styles.pageText}>
          {isProvider
            ? 'Gestiona solicitudes, publica servicios y da seguimiento a tus clientes.'
            : 'Encuentra profesionales, revisa tus solicitudes y administra tus contrataciones.'}
        </Text>
      </View>

      <View style={styles.statsGrid}>
        <StatCard label={isProvider ? 'Solicitudes' : 'Contrataciones'} value="0" />
        <StatCard label={isProvider ? 'Ingresos' : 'Favoritos'} value="0" />
        <StatCard label="Mensajes" value="0" />
      </View>

      <View style={styles.actionGrid}>
        <ActionCard title="Explorar servicios" text="Revisa el marketplace movil." onPress={onExplore} />
        <ActionCard title="Solicitudes" text="Consulta el estado de tus procesos." onPress={onRequests} />
        <ActionCard
          title={isProvider ? 'Publicar servicio' : 'Convertirme en profesional'}
          text={isProvider ? 'Crea una nueva oferta.' : 'Prepara tu perfil para vender servicios.'}
          onPress={onPublish}
        />
      </View>
    </View>
  );
}

function RequestsScreen({ requests, onRefresh, role }: { requests: RequestItem[]; onRefresh: () => void; role: UserType }) {
  return (
    <View>
      <View style={styles.pageIntro}>
        <Text style={styles.eyebrow}>SOLICITUDES</Text>
        <Text style={styles.pageTitle}>{role === 'Prestador' ? 'Clientes interesados' : 'Servicios solicitados'}</Text>
        <Text style={styles.pageText}>Seguimiento rapido de solicitudes desde la app movil.</Text>
      </View>
      <GhostButton title="Actualizar solicitudes" onPress={onRefresh} />
      {requests.length ? (
        requests.map((request, index) => (
          <View key={`${request.id ?? request.SolicitudId ?? index}`} style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>{getRequestTitle(request)}</Text>
              <Badge text={getRequestStatus(request)} />
            </View>
            <Text style={styles.bodyText}>{request.mensaje ?? request.Mensaje ?? 'Sin mensaje adicional.'}</Text>
            <Text style={styles.metaText}>{request.fecha_servicio ?? request.FechaServicio ?? 'Fecha por confirmar'}</Text>
          </View>
        ))
      ) : (
        <EmptyState title="Sin solicitudes" text="Cuando existan solicitudes apareceran aqui." />
      )}
    </View>
  );
}

function SettingsScreen({
  apiUrl,
  setApiUrl,
  sessionCookie,
}: {
  apiUrl: string;
  setApiUrl: (value: string) => void;
  sessionCookie: string;
}) {
  return (
    <AuthCard title="Conexion con API" subtitle="En Expo Go usa la IP local de tu Mac, no localhost.">
      <Field label="URL del backend Flask" value={apiUrl} onChangeText={setApiUrl} autoCapitalize="none" />
      <View style={styles.tipBox}>
        <Text style={styles.tipTitle}>Detectada</Text>
        <Text style={styles.tipText}>{DEFAULT_API_URL}</Text>
        <Text style={styles.tipText}>El backend debe correr con host 0.0.0.0 para que tu telefono lo vea.</Text>
      </View>
      <View style={styles.tipBoxMuted}>
        <Text style={styles.tipTitle}>Sesion</Text>
        <Text style={styles.tipText}>{sessionCookie ? 'Cookie de sesion capturada.' : 'Aun no hay sesion iniciada.'}</Text>
      </View>
    </AuthCard>
  );
}

function ProfessionalCard({ publication, onPress }: { publication: Publication; onPress: () => void }) {
  const item = normalizePublication(publication);
  return (
    <Pressable style={({ pressed }) => [styles.professionalCard, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.cardImage}>
        <Text style={styles.cardImageText}>{String(item.categoria ?? 'JN').slice(0, 2).toUpperCase()}</Text>
      </View>
      <View style={styles.cardContent}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.professionalName}>{item.nombre_prestador}</Text>
          <Badge text={`${item.promedio_calificacion}`} />
        </View>
        <Text style={styles.professionalRole}>{item.titulo}</Text>
        <Text style={styles.bodyText} numberOfLines={2}>{item.descripcion}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>{item.ubicacion}</Text>
          <Text style={styles.metaText}>{money(item.salario)} / hora</Text>
        </View>
        <Text style={styles.availability}>{item.disponibilidad}</Text>
      </View>
    </Pressable>
  );
}

function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <View style={styles.authCard}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardSubtitle}>{subtitle}</Text>
      <View style={styles.formStack}>{children}</View>
    </View>
  );
}

function Field({ label, multiline, style, ...props }: { label: string; multiline?: boolean } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        multiline={multiline}
        placeholderTextColor="#98a2b3"
        style={[styles.input, multiline && styles.textArea, style]}
      />
    </View>
  );
}

function PrimaryButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, disabled && styles.disabled]} onPress={onPress} disabled={disabled}>
      <Text style={styles.primaryButtonText}>{title}</Text>
    </Pressable>
  );
}

function GhostButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]} onPress={onPress}>
      <Text style={styles.ghostButtonText}>{title}</Text>
    </Pressable>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable key={option} style={[styles.segment, active && styles.segmentActive]} onPress={() => onChange(option)}>
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Badge({ text }: { text: string }) {
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{text}</Text>
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function ActionCard({ title, text, onPress }: { title: string; text: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]} onPress={onPress}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.bodyText}>{text}</Text>
      <Text style={styles.linkText}>Abrir</Text>
    </Pressable>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <View style={styles.notice}>
      <Text style={styles.noticeText}>{text}</Text>
    </View>
  );
}

function LoadingPill() {
  return (
    <View style={styles.loadingPill}>
      <ActivityIndicator color={PRIMARY} />
      <Text style={styles.loadingText}>Conectando con JobNest...</Text>
    </View>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SOFT,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingTop: 58,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  topBar: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 26,
    padding: 14,
    marginBottom: 16,
    boxShadow: '0 18px 45px rgba(16,24,40,0.08)',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoMark: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: INK,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  brandTitle: {
    color: INK,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
  },
  brandSub: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
  },
  topActions: {
    position: 'absolute',
    right: 12,
    top: 14,
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    minWidth: 52,
    height: 38,
    borderRadius: 14,
    backgroundColor: '#eef4ff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  iconButtonText: {
    color: PRIMARY,
    fontWeight: '800',
    fontSize: 12,
  },
  welcome: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 12,
  },
  backText: {
    color: INK,
    fontWeight: '800',
  },
  hero: {
    backgroundColor: INK,
    borderRadius: 32,
    padding: 26,
    minHeight: 360,
    justifyContent: 'flex-end',
    marginBottom: 28,
    boxShadow: '0 24px 60px rgba(16,24,40,0.18)',
  },
  eyebrow: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '900',
    letterSpacing: 0,
    marginBottom: 14,
  },
  heroText: {
    color: '#d0d5dd',
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '600',
    marginBottom: 22,
  },
  heroActions: {
    gap: 10,
  },
  sectionHeader: {
    marginBottom: 14,
    marginTop: 6,
  },
  sectionTitle: {
    color: INK,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
  },
  sectionSubtitle: {
    color: MUTED,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 26,
  },
  categoryCard: {
    width: '47%',
    backgroundColor: SURFACE,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    minHeight: 108,
    justifyContent: 'space-between',
  },
  categoryTitle: {
    color: INK,
    fontSize: 17,
    fontWeight: '900',
  },
  categoryText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
  },
  ctaCard: {
    backgroundColor: '#eef4ff',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#c7d7fe',
    padding: 22,
    marginTop: 14,
  },
  ctaTitle: {
    color: INK,
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 8,
  },
  ctaText: {
    color: MUTED,
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 16,
  },
  pageIntro: {
    marginBottom: 16,
  },
  pageTitle: {
    color: INK,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '900',
    letterSpacing: 0,
  },
  pageText: {
    color: MUTED,
    fontSize: 16,
    lineHeight: 24,
    marginTop: 8,
    fontWeight: '600',
  },
  searchInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 15,
    fontSize: 16,
    color: INK,
    marginBottom: 12,
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterChipText: {
    color: INK,
    fontWeight: '800',
    fontSize: 13,
  },
  professionalCard: {
    backgroundColor: SURFACE,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 16,
    overflow: 'hidden',
    boxShadow: '0 16px 38px rgba(16,24,40,0.08)',
  },
  cardImage: {
    height: 150,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardImageText: {
    color: PRIMARY,
    fontSize: 46,
    fontWeight: '900',
  },
  cardContent: {
    padding: 18,
    gap: 9,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  professionalName: {
    color: INK,
    fontSize: 18,
    fontWeight: '900',
    flex: 1,
  },
  professionalRole: {
    color: PRIMARY,
    fontSize: 16,
    fontWeight: '900',
  },
  bodyText: {
    color: MUTED,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  metaText: {
    color: '#475467',
    fontSize: 13,
    fontWeight: '800',
  },
  availability: {
    color: '#067647',
    fontSize: 13,
    fontWeight: '900',
  },
  authCard: {
    backgroundColor: SURFACE,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 22,
    boxShadow: '0 18px 45px rgba(16,24,40,0.08)',
  },
  card: {
    backgroundColor: SURFACE,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
    marginBottom: 14,
  },
  cardTitle: {
    color: INK,
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 0,
  },
  cardSubtitle: {
    color: MUTED,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 8,
  },
  formStack: {
    marginTop: 18,
    gap: 14,
  },
  fieldGroup: {
    gap: 7,
  },
  label: {
    color: INK,
    fontSize: 13,
    fontWeight: '900',
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 14,
    color: INK,
    fontSize: 16,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  primaryButton: {
    backgroundColor: PRIMARY,
    borderRadius: 18,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    boxShadow: '0 14px 30px rgba(37,99,235,0.25)',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  ghostButton: {
    backgroundColor: '#fff',
    borderRadius: 18,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: BORDER,
  },
  ghostButtonText: {
    color: INK,
    fontSize: 16,
    fontWeight: '900',
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  segmented: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  segment: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#f2f4f7',
    borderWidth: 1,
    borderColor: BORDER,
  },
  segmentActive: {
    backgroundColor: INK,
    borderColor: INK,
  },
  segmentText: {
    color: MUTED,
    fontWeight: '900',
    fontSize: 13,
  },
  segmentTextActive: {
    color: '#fff',
  },
  badge: {
    backgroundColor: '#eef4ff',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    color: PRIMARY,
    fontSize: 12,
    fontWeight: '900',
  },
  profileHero: {
    backgroundColor: INK,
    borderRadius: 32,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarLarge: {
    width: 96,
    height: 96,
    borderRadius: 34,
    backgroundColor: '#eef4ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    color: PRIMARY,
    fontSize: 30,
    fontWeight: '900',
  },
  profileName: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  profileRole: {
    color: '#d0d5dd',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 14,
  },
  pricePanel: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 20,
    padding: 16,
    marginTop: 14,
  },
  priceLabel: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '800',
  },
  priceText: {
    color: INK,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },
  dashboardHero: {
    backgroundColor: '#fff',
    borderRadius: 30,
    padding: 22,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 14,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: INK,
    borderRadius: 22,
    padding: 16,
    minHeight: 104,
    justifyContent: 'space-between',
  },
  statValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
  },
  statLabel: {
    color: '#d0d5dd',
    fontSize: 12,
    fontWeight: '800',
  },
  actionGrid: {
    gap: 12,
  },
  actionCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 24,
    padding: 18,
    gap: 8,
  },
  linkText: {
    color: PRIMARY,
    fontSize: 14,
    fontWeight: '900',
  },
  notice: {
    backgroundColor: '#fffaeb',
    borderWidth: 1,
    borderColor: '#fedf89',
    borderRadius: 18,
    padding: 13,
    marginBottom: 12,
  },
  noticeText: {
    color: '#93370d',
    fontWeight: '800',
    lineHeight: 20,
  },
  loadingPill: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: MUTED,
    fontWeight: '800',
  },
  emptyState: {
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 22,
    alignItems: 'center',
  },
  emptyTitle: {
    color: INK,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 6,
  },
  emptyText: {
    color: MUTED,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  tipBox: {
    backgroundColor: '#eef4ff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#c7d7fe',
  },
  tipBoxMuted: {
    backgroundColor: '#f9fafb',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  tipTitle: {
    color: INK,
    fontSize: 14,
    fontWeight: '900',
    marginBottom: 4,
  },
  tipText: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '700',
  },
});
