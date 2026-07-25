import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { View } from 'react-native';
import { ScreenFrame } from '../components/ScreenFrame';
import { LoadingPill } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/auth/LoginScreen';
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

const PublicStack = createNativeStackNavigator<PublicStackParamList>();
const AuthStack = createNativeStackNavigator<AuthenticatedStackParamList>();
const ClientTabs = createBottomTabNavigator<ClientTabParamList>();
const ProviderTabs = createBottomTabNavigator<ProviderTabParamList>();

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
      <NavigationContainer>
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
    </AuthStack.Navigator>
  );
}

function PublicHomeRoute({ navigation }: PublicProps<'Home'>) {
  const { apiUrl, categories, publications, openPublication, loadPublications } = useMobileData();

  return (
    <ScreenFrame onHome={() => navigation.navigate('Home')} onSettings={() => navigation.navigate('Settings')}>
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
    <ScreenFrame onHome={() => navigation.navigate('Home')} onSettings={() => navigation.navigate('Settings')}>
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
  const commonScreenOptions = { headerShown: false };

  return (
    <ClientTabs.Navigator screenOptions={commonScreenOptions}>
      <ClientTabs.Screen name="ClientHome" options={{ title: 'Inicio' }}>
        {() => (
          <ScreenFrame onHome={() => rootNavigation.navigate('MainTabs')} onSettings={() => rootNavigation.navigate('Settings')}>
            <ClientDashboardScreen
              onExplore={() => {
                rootNavigation.navigate('MainTabs', { screen: 'ExploreTab' });
                void data.loadPublications();
              }}
              onRequests={() => {
                rootNavigation.navigate('MainTabs', { screen: 'Requests' });
                void data.loadRequests();
              }}
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
        {() => <ProfileTabContent rootNavigation={rootNavigation} />}
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
  const commonScreenOptions = { headerShown: false };

  return (
    <ProviderTabs.Navigator screenOptions={commonScreenOptions}>
      <ProviderTabs.Screen name="ProviderHome" options={{ title: 'Inicio' }}>
        {() => (
          <ScreenFrame onHome={() => rootNavigation.navigate('MainTabs')} onSettings={() => rootNavigation.navigate('Settings')}>
            <ProviderDashboardScreen
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
        {() => <ProfileTabContent rootNavigation={rootNavigation} />}
      </ProviderTabs.Screen>
    </ProviderTabs.Navigator>
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
    <ScreenFrame onHome={() => rootNavigation.navigate('MainTabs')} onSettings={() => rootNavigation.navigate('Settings')}>
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
    <ScreenFrame onHome={() => rootNavigation.navigate('MainTabs')} onSettings={() => rootNavigation.navigate('Settings')}>
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

function ProfileTabContent({ rootNavigation }: { rootNavigation: AuthProps<'MainTabs'>['navigation'] }) {
  return (
    <ScreenFrame onHome={() => rootNavigation.navigate('MainTabs')} onSettings={() => rootNavigation.navigate('Settings')}>
      <ProfileScreen onSettings={() => rootNavigation.navigate('Settings')} />
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
