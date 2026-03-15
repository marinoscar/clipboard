export interface User {
  id: string;
  email: string;
  displayName: string | null;
  profileImageUrl: string | null;
  isActive: boolean;
  isAdmin: boolean;
}

export interface AuthProvider {
  name: string;
  enabled: boolean;
}
