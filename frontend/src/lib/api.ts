const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface UsuarioSesion {
  id: string;
  email: string;
  nombre: string | null;
  roles: string[];
  permisos: string[];
  debeCambiarContrasena: boolean;
}

export interface SesionResponse {
  accessToken: string;
  expiresIn: number;
  usuario: UsuarioSesion;
}

interface ApiErrorResponse {
  message?: string;
}

async function parseError(response: Response): Promise<Error> {
  try {
    const body = (await response.json()) as ApiErrorResponse;
    return new Error(body.message || `Solicitud fallida (${response.status})`);
  } catch {
    return new Error(`Solicitud fallida (${response.status})`);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function iniciarSesion(email: string, password: string): Promise<SesionResponse> {
  return request<SesionResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function renovarSesion(): Promise<SesionResponse> {
  return request<SesionResponse>('/auth/refresh', {
    method: 'POST',
  });
}

export function obtenerUsuario(accessToken: string): Promise<{ usuario: UsuarioSesion }> {
  return request<{ usuario: UsuarioSesion }>('/auth/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function cambiarContrasena(
  accessToken: string,
  contrasenaActual: string,
  contrasenaNueva: string,
): Promise<void> {
  return request<void>('/auth/cambiar-contrasena', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ contrasenaActual, contrasenaNueva }),
  });
}

export function cerrarSesion(): Promise<void> {
  return request<void>('/auth/logout', {
    method: 'POST',
  });
}
