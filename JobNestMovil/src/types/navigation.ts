import type { Publication, RequestItem } from './domain';

export type PublicStackParamList = {
  Home: undefined;
  Login: { email?: string } | undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string } | undefined;
  Register: undefined;
  Explore: undefined;
  Detail: { publication: Publication };
  Settings: undefined;
};

export type ClientTabParamList = {
  ClientHome: undefined;
  ExploreTab: undefined;
  Requests: undefined;
  Profile: undefined;
};

export type ProviderTabParamList = {
  ProviderHome: undefined;
  ExploreTab: undefined;
  Requests: undefined;
  Profile: undefined;
};

export type AuthenticatedStackParamList = {
  MainTabs: { screen?: keyof ClientTabParamList | keyof ProviderTabParamList } | undefined;
  Detail: { publication: Publication };
  Chat: { request: RequestItem };
  Publish: undefined;
  Settings: undefined;
  ForgotPassword: undefined;
};
