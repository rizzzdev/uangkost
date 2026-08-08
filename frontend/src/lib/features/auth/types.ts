export interface LoginResponse {
  token: string;
  admin: {
    id: string;
    name: string;
    phone: string;
  };
}
