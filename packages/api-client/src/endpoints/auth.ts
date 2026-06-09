import { getClient } from '../client';

export interface LoginPayload   { email: string; password: string }
export interface LoginResponse  { accessToken: string; refreshToken: string; user: any }
export interface RefreshResponse{ accessToken: string; refreshToken: string }

export const authApi = {
  login:   (data: LoginPayload, tenantId?: string): Promise<LoginResponse>   =>
    getClient().post('/auth/login', data, tenantId ? { headers: { 'x-tenant-id': tenantId } } : undefined).then(r => r.data),
  refresh: (token: string): Promise<RefreshResponse>       => getClient().post('/auth/refresh', { refreshToken: token }).then(r => r.data),
  logout:  (token: string): Promise<void>                  => getClient().post('/auth/logout', { refreshToken: token }).then(() => undefined),
  me:      (): Promise<any>                                 => getClient().get('/auth/me').then(r => r.data),
forgotPassword: (email: string, tenantId?: string): Promise<void> =>
    getClient()
      .post(
        '/auth/forgot-password',
        { email, tenantId },
        tenantId ? { headers: { 'x-tenant-id': tenantId } } : undefined
      )
      .then(() => undefined),

  //resetPassword: (data: any): Promise<void> =>
    //getClient()
      //.post('/auth/reset-password', data)
      //.then(() => undefined),

resetPassword: (data: {
  email: string;
  tenantId?: string;
  otp: string;
  newPassword: string;
}): Promise<any> =>
  getClient()
    .post(
      '/auth/reset-password',
      {
        email: data.email,
        otp: data.otp,
        newPassword: data.newPassword,
      },
      data.tenantId
        ? {
            headers: {
              'x-tenant-id': data.tenantId,
            },
          }
        : undefined,
    )
    .then(r => r.data),	      
	      
};
