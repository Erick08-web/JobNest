import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScreenFrame } from '../components/ScreenFrame';
import { LoadingPill } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { ResetPasswordScreen } from '../screens/auth/ResetPasswordScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { ClientDashboardScreen } from '../screens/client/ClientDashboardScreen';
import { ProviderDashboardScreen } from '../screens/provider/ProviderDashboardScreen';
import { CreatePublicationScreen } from '../screens/provider/CreatePublicationScreen';
import { DetailScreen } from '../screens/shared/DetailScreen';
import { ExploreScreen } from '../screens/shared/ExploreScreen';
import { HomeScreen } from '../screens/shared/HomeScreen';
import { ProfileScreen } from '../screens/shared/ProfileScreen';
import { RequestsScreen } from '../screens/shared/RequestsScreen';
import { SettingsScreen } from '../screens/shared/SettingsScreen';
import { fetchPublications } from '../services/publicationService';
import { fetchRequests } from '../services/requestService';
import { fetchCategories } from '../services/categoryService';
import type { Category, Publication, RequestItem } from '../types/domain';
import type {
  AuthenticatedStackParamList,
  ClientTabParamList,
  ProviderTabParamList,
  PublicStackParamList,
} from '../types/navigation';
import { normalizePublication } from '../utils/formatters';
import { styles } from '../styles/theme';

const PublicStack = createNativeStackNavigator<PublicStackParamList>();
const AuthStack = createNativeStackNavigator<AuthenticatedStackParamList>();
const ClientTabs = createBottomTabNavigator<ClientTabParamList>();
const ProviderTabs = createBottomTabNavigator<ProviderTabParamList>();

const linking: LinkingOptions<PublicStackParamList> = {
  prefixes: ['jobnest://'],
  config: {
    screens: {
      Home: '',
      Login: 'login',
      Register: 'registro',
      ForgotPassword: 'recuperar-password',
      ResetPassword: 'restablecer-password',
      Explore: 'buscar',
      Detail: 'servicios/:publication',
      Settings: 'configuracion',
    },
  },
};

type PublicProps<RouteName extends keyof PublicStackParamList> = NativeStackScreenProps<PublicStackParamList, RouteName>;
type AuthProps<RouteName extends keyof AuthenticatedStackParamList> = NativeStackScreenProps<AuthenticatedStackParamList, RouteName>;
type MobileDataValue = ReturnType<typeof useCreateMobileData>;

const MobileDataContext = createContext<MobileDataValue | null>(null);

export function AppNavigator() {
  const { isLoggedIn, isRestoring } = useAuth();
  const data = useCreateMobileData();

  if (isRestoring) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
        <LoadingPill />
      </View>
    );
  }

  return (
    <MobileDataContext.Provider value={data}>
      <NavigationContainer linking={linking}>
      {isLoggedIn ? <AuthenticatedNavigator /> : <PublicNavigator />}
      </NavigationContainer>
    </MobileDataContext.Provider>
  );
}

function PublicNavigator() {
  return (
    <PublicStack.Navigator screenOptions={{ headerShown: false }}>
      <PublicStack.Screen name="Home" component={PublicHomeRoute} />
      <PublicStack.Screen name="Login" component={LoginRoute} />
      <PublicStack.Screen name="ForgotPassword" component={ForgotPasswordRoute} />
      <PublicStack.Screen name="ResetPassword" component={ResetPasswordRoute} />
      <PublicStack.Screen name="Register" component={RegisterRoute} />
      <PublicStack.Screen name="Explore" component={PublicExploreRoute} />
      <PublicStack.Screen name="Detail" component={PublicDetailRoute} />
      <PublicStack.Screen name="Settings" component={SettingsRoute} />
    </PublicStack.Navigator>
  );
}

function AuthenticatedNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="MainTabs" component={RoleTabsRoute} />
      <AuthStack.Screen name="Detail" component={AuthenticatedDetailRoute} />
      <AuthStack.Screen name="Settings" component={AuthenticatedSettingsRoute} />
      <AuthStack.Screen name="ForgotPassword" component={AuthenticatedForgotPasswordRoute} />
    </AuthStack.Navigator>
  );
}

function PublicHomeRoute({ navigation }: PublicProps<'Home'>) {
  const { apiUrl, categories, publications, openPublication, loadPublications } = useMobileData();

  return (
    <ScreenFrame onHome={() => navigation.navigate('Home')} onSettings={() => navigation.navigate('Settings')} scroll={false}>
      <HomeScreen
        onLogin={() => navigation.navigate('Login')}
        onRegister={() => navigation.navigate('Register')}
        onExplore={() => {
          navigation.navigate('Explore');
          void loadPublications();
        }}
        publications={publications.map(normalizePublication).slice(0, 3)}
        categories={categories}
        apiUrl={apiUrl}
        onOpenPublication={(publication) => openPublication(publication, (item) => navigation.navigate('Detail', { publication: item }))}
      />
    </ScreenFrame>
  );
}

function LoginRoute({ navigation, route }: PublicProps<'Login'>) {
  return (
    <ScreenFrame onHome={() => navigation.navigate('Home')} onSettings={() => navigation.navigate('Settings')}>
      <LoginScreen
        initialEmail={route.params?.email}
        onRegister={() => navigation.navigate('Register')}
        onForgotPassword={() => navigation.navigate('ForgotPassword')}
      />
    </ScreenFrame>
  );
}

function ForgotPasswordRoute({ navigation }: PublicProps<'ForgotPassword'>) {
  return (
    <ScreenFrame onHome={() => navigation.navigate('Home')} onSettings={() => navigation.navigate('Settings')}>
      <ForgotPasswordScreen onBack={() => navigation.navigate('Login')} />
    </ScreenFrame>
  );
}

function ResetPasswordRoute({ navigation, route }: PublicProps<'ResetPassword'>) {
  return (
    <ScreenFrame onHome={() => navigation.navigate('Home')} onSettings={() => navigation.navigate('Settings')}>
      <ResetPasswordScreen
        token={route.params?.token}
        onBack={() => navigation.navigate('Login')}
        onRequestNew={() => navigation.navigate('ForgotPassword')}
      />
    </ScreenFrame>
  );
}

function RegisterRoute({ navigation }: PublicProps<'Register'>) {
  return (
    <ScreenFrame onHome={() => navigation.navigate('Home')} onSettings={() => navigation.navigate('Settings')}>
      <RegisterScreen onRegistered={(credentials) => navigation.navigate('Login', credentials)} />
    </ScreenFrame>
  );
}

function PublicExploreRoute({ navigation }: PublicProps<'Explore'>) {
  const {
    apiUrl,
    categories,
    search,
    setSearch,
    filteredPublications,
    loadPublications,
    openPublication,
    publicationsLoading,
    publicationsError,
  } = useMobileData();

  return (
    <ScreenFrame onHome={() => navigation.navigate('Home')} onSettings={() => navigation.navigate('Settings')} scroll={false}>
      <ExploreScreen
        search={search}
        onSearch={setSearch}
        publications={filteredPublications}
        categories={categories}
        apiUrl={apiUrl}
        loading={publicationsLoading}
        error={publicationsError}
        onRefresh={loadPublications}
        onOpenPublication={(publication) => openPublication(publication, (item) => navigation.navigate('Detail', { publication: item }))}
      />
    </ScreenFrame>
  );
}

function PublicDetailRoute({ navigation, route }: PublicProps<'Detail'>) {
  return (
    <ScreenFrame onHome={() => navigation.navigate('Home')} onSettings={() => navigation.navigate('Settings')}>
      <DetailScreen
        publication={route.params.publication}
        onLoginRequired={() => navigation.navigate('Login')}
        onRequestSent={() => navigation.navigate('Home')}
      />
    </ScreenFrame>
  );
}

function SettingsRoute({ navigation }: PublicProps<'Settings'>) {
  return (
    <ScreenFrame onHome={() => navigation.navigate('Home')} onSettings={() => navigation.navigate('Settings')}>
      <SettingsScreen />
    </ScreenFrame>
  );
}

function AuthenticatedSettingsRoute({ navigation }: AuthProps<'Settings'>) {
  return (
    <ScreenFrame onHome={() => navigation.navigate('MainTabs')} onSettings={() => navigation.navigate('Settings')}>
      <SettingsScreen />
    </ScreenFrame>
  );
}

function AuthenticatedForgotPasswordRoute({ navigation }: AuthProps<'ForgotPassword'>) {
  const { user } = useAuth();

  return (
    <ScreenFrame onHome={() => navigation.navigate('MainTabs')} onSettings={() => navigation.navigate('Settings')}>
      <ForgotPasswordScreen initialEmail={user?.email} onBack={() => navigation.navigate('MainTabs')} />
    </ScreenFrame>
  );
}

function AuthenticatedDetailRoute({ navigation, route }: AuthProps<'Detail'>) {
  return (
    <ScreenFrame onHome={() => navigation.navigate('MainTabs')} onSettings={() => navigation.navigate('Settings')}>
      <DetailScreen
        publication={route.params.publication}
        onLoginRequired={() => navigation.navigate('MainTabs')}
        onRequestSent={() => navigation.navigate('MainTabs')}
      />
    </ScreenFrame>
  );
}

function RoleTabsRoute({ navigation }: AuthProps<'MainTabs'>) {
  const { currentUserType } = useAuth();
  const data = useMobileData();

  if (currentUserType === 'Prestador') {
    return <ProviderTabsNavigator rootNavigation={navigation} data={data} />;
  }

  return <ClientTabsNavigator rootNavigation={navigation} data={data} />;
}

function ClientTabsNavigator({
  rootNavigation,
  data,
}: {
  rootNavigation: AuthProps<'MainTabs'>['navigation'];
  data: ReturnType<typeof useMobileData>;
}) {
  const commonScreenOptions = {
    headerShown: false,
    tabBar: (props: BottomTabBarProps) => <PremiumTabBar {...props} />,
  };

  return (
    <ClientTabs.Navigator screenOptions={commonScreenOptions}>
      <ClientTabs.Screen name="ClientHome" options={{ title: 'Inicio' }}>
        {() => (
          <ScreenFrame onHome={() => rootNavigation.navigate('MainTabs')} onSettings={() => rootNavigation.navigate('Settings')}>
            <ClientDashboardScreen
              requests={data.requests}
              publications={data.publications}
              loading={data.requestsLoading || data.publicationsLoading}
              onExplore={() => {
                rootNavigation.navigate('MainTabs', { screen: 'ExploreTab' });
                void data.loadPublications();
              }}
              onRequests={() => {
                rootNavigation.navigate('MainTabs', { screen: 'Requests' });
                void data.loadRequests();
              }}
              onProfile={() => rootNavigation.navigate('MainTabs', { screen: 'Profile' })}
            />
          </ScreenFrame>
        )}
      </ClientTabs.Screen>
      <ClientTabs.Screen name="ExploreTab" options={{ title: 'Explorar' }}>
        {() => <ExploreTabContent rootNavigation={rootNavigation} data={data} />}
      </ClientTabs.Screen>
      <ClientTabs.Screen name="Requests" options={{ title: 'Solicitudes' }}>
        {() => <RequestsTabContent rootNavigation={rootNavigation} data={data} />}
      </ClientTabs.Screen>
      <ClientTabs.Screen name="Profile" options={{ title: 'Perfil' }}>
        {() => <ProfileTabContent rootNavigation={rootNavigation} data={data} />}
      </ClientTabs.Screen>
    </ClientTabs.Navigator>
  );
}

function ProviderTabsNavigator({
  rootNavigation,
  data,
}: {
  rootNavigation: AuthProps<'MainTabs'>['navigation'];
  data: ReturnType<typeof useMobileData>;
}) {
  const commonScreenOptions = {
    headerShown: false,
    tabBar: (props: BottomTabBarProps) => <PremiumTabBar {...props} />,
  };

  return (
    <ProviderTabs.Navigator screenOptions={commonScreenOptions}>
      <ProviderTabs.Screen name="ProviderHome" options={{ title: 'Inicio' }}>
        {() => (
          <ScreenFrame onHome={() => rootNavigation.navigate('MainTabs')} onSettings={() => rootNavigation.navigate('Settings')}>
            <ProviderDashboardScreen
              requests={data.requests}
              publications={data.publications}
              loading={data.requestsLoading || data.publicationsLoading}
              onExplore={() => {
                rootNavigation.navigate('MainTabs', { screen: 'ExploreTab' });
                void data.loadPublications();
              }}
              onRequests={() => {
                rootNavigation.navigate('MainTabs', { screen: 'Requests' });
                void data.loadRequests();
              }}
              onPublish={() => rootNavigation.navigate('MainTabs', { screen: 'Publish' })}
            />
          </ScreenFrame>
        )}
      </ProviderTabs.Screen>
      <ProviderTabs.Screen name="ExploreTab" options={{ title: 'Explorar' }}>
        {() => <ExploreTabContent rootNavigation={rootNavigation} data={data} />}
      </ProviderTabs.Screen>
      <ProviderTabs.Screen name="Requests" options={{ title: 'Solicitudes' }}>
        {() => <RequestsTabContent rootNavigation={rootNavigation} data={data} />}
      </ProviderTabs.Screen>
      <ProviderTabs.Screen name="Publish" options={{ title: 'Publicar' }}>
        {() => (
          <ScreenFrame onHome={() => rootNavigation.navigate('MainTabs')} onSettings={() => rootNavigation.navigate('Settings')}>
            <CreatePublicationScreen
              categories={data.categories}
              onPublished={() => {
                void data.loadPublications();
                rootNavigation.navigate('MainTabs');
              }}
            />
          </ScreenFrame>
        )}
      </ProviderTabs.Screen>
      <ProviderTabs.Screen name="Profile" options={{ title: 'Perfil' }}>
        {() => <ProfileTabContent rootNavigation={rootNavigation} data={data} />}
      </ProviderTabs.Screen>
    </ProviderTabs.Navigator>
  );
}

const tabIcons: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
  ClientHome: { active: 'home', inactive: 'home-outline' },
  ProviderHome: { active: 'home', inactive: 'home-outline' },
  ExploreTab: { active: 'search', inactive: 'search-outline' },
  Requests: { active: 'calendar', inactive: 'calendar-outline' },
  Publish: { active: 'add-circle', inactive: 'add-circle-outline' },
  Profile: { active: 'person-circle', inactive: 'person-circle-outline' },
};

function PremiumTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBarShell, { bottom: Math.max(insets.bottom, 10), height: 72 + Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const { options } = descriptors[route.key];
        const label = typeof options.title === 'string' ? options.title : route.name;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
            style={({ pressed }) => [
              styles.tabButton,
              focused && styles.tabButtonActive,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={(focused ? tabIcons[route.name]?.active : tabIcons[route.name]?.inactive) ?? 'ellipse-outline'}
              size={20}
              style={[styles.tabIcon, focused && styles.tabIconActive]}
            />
            <Text style={[styles.tabLabel, focused && styles.tabLabelActive]} numberOfLines={1}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ExploreTabContent({
  rootNavigation,
  data,
}: {
  rootNavigation: AuthProps<'MainTabs'>['navigation'];
  data: ReturnType<typeof useMobileData>;
}) {
  return (
    <ScreenFrame onHome={() => rootNavigation.navigate('MainTabs')} onSettings={() => rootNavigation.navigate('Settings')} scroll={false}>
      <ExploreScreen
        search={data.search}
        onSearch={data.setSearch}
        publications={data.filteredPublications}
        categories={data.categories}
        apiUrl={data.apiUrl}
        loading={data.publicationsLoading}
        error={data.publicationsError}
        onRefresh={data.loadPublications}
        onOpenPublication={(publication) => data.openPublication(publication, (item) => rootNavigation.navigate('Detail', { publication: item }))}
      />
    </ScreenFrame>
  );
}

function RequestsTabContent({
  rootNavigation,
  data,
}: {
  rootNavigation: AuthProps<'MainTabs'>['navigation'];
  data: ReturnType<typeof useMobileData>;
}) {
  const { currentUserType } = useAuth();

  return (
    <ScreenFrame onHome={() => rootNavigation.navigate('MainTabs')} onSettings={() => rootNavigation.navigate('Settings')} scroll={false}>
      <RequestsScreen
        requests={data.requests}
        onRefresh={data.loadRequests}
        role={currentUserType}
        loading={data.requestsLoading}
        error={data.requestsError}
      />
    </ScreenFrame>
  );
}

function ProfileTabContent({
  rootNavigation,
  data,
}: {
  rootNavigation: AuthProps<'MainTabs'>['navigation'];
  data: ReturnType<typeof useMobileData>;
}) {
  const { currentUserType } = useAuth();

  return (
    <ScreenFrame onHome={() => rootNavigation.navigate('MainTabs')} onSettings={() => rootNavigation.navigate('Settings')} scroll={false}>
      <ProfileScreen
        publications={data.publications}
        requests={data.requests}
        apiUrl={data.apiUrl}
        onSettings={() => rootNavigation.navigate('Settings')}
        onExplore={() => {
          rootNavigation.navigate('MainTabs', { screen: 'ExploreTab' });
          void data.loadPublications();
        }}
        onRequests={() => {
          rootNavigation.navigate('MainTabs', { screen: 'Requests' });
          void data.loadRequests();
        }}
        onPublish={currentUserType === 'Prestador' ? () => rootNavigation.navigate('MainTabs', { screen: 'Publish' }) : undefined}
      />
    </ScreenFrame>
  );
}

function useMobileData() {
  const value = useContext(MobileDataContext);

  if (!value) {
    throw new Error('useMobileData must be used inside MobileDataContext');
  }

  return value;
}

function useCreateMobileData() {
  const { apiFetch, apiUrl, currentUserType, setApiMessage } = useAuth();
  const [publications, setPublications] = useState<Publication[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [publicationsLoading, setPublicationsLoading] = useState(false);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [publicationsError, setPublicationsError] = useState('');
  const [requestsError, setRequestsError] = useState('');
  const [categoriesError, setCategoriesError] = useState('');

  useEffect(() => {
    void loadPublications();
    void loadCategories();
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [currentUserType]);

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

  const loadPublications = async () => {
    setPublicationsLoading(true);
    setPublicationsError('');
    setApiMessage('');
    try {
      const list = await fetchPublications(apiFetch);
      setPublications(list);
    } catch (error) {
      setPublications([]);
      setPublicationsError(error instanceof Error ? error.message : 'No fue posible conectar con JobNest.');
    } finally {
      setPublicationsLoading(false);
    }
  };

  const loadCategories = async () => {
    setCategoriesLoading(true);
    setCategoriesError('');
    try {
      const list = await fetchCategories(apiFetch);
      setCategories(list);
    } catch (error) {
      setCategories([]);
      setCategoriesError(error instanceof Error ? error.message : 'No fue posible cargar las categorías.');
    } finally {
      setCategoriesLoading(false);
    }
  };

  const loadRequests = async () => {
    setRequestsLoading(true);
    setRequestsError('');
    setApiMessage('');
    try {
      const list = await fetchRequests(apiFetch, currentUserType);
      setRequests(list);
    } catch (error) {
      setRequests([]);
      setRequestsError(error instanceof Error ? error.message : 'No se pudieron cargar las solicitudes.');
    } finally {
      setRequestsLoading(false);
    }
  };

  const openPublication = (publication: Publication, navigate: (publication: Publication) => void) => {
    navigate(normalizePublication(publication));
  };

  return {
    publications,
    requests,
    categories,
    search,
    apiUrl,
    setSearch,
    filteredPublications,
    loadPublications,
    loadCategories,
    loadRequests,
    publicationsLoading,
    requestsLoading,
    categoriesLoading,
    publicationsError,
    requestsError,
    categoriesError,
    openPublication,
  };
}
