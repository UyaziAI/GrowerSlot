export type Role = 'admin' | 'grower';

const STORAGE_KEY = 'auth';

export function getAuth(): { token?: string; role?: Role } {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}

export function isAuthenticated(): boolean {
  return !!getAuth().token;
}

export function role(): Role | null {
  return (getAuth().role ?? null) as Role | null;
}

export function login(token: string, r: Role) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, role: r }));
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY);
}

// Backward compatibility layer for existing imports
export const authService = {
  isAuthenticated,
  isAdmin: () => role() === 'admin',
  getUser: () => {
    const auth = getAuth();
    return auth.token ? { role: auth.role } : null;
  },
  getToken: () => getAuth().token || null,
  login: (email: string, password: string) => {
    // For compatibility - determine role from email pattern
    const r = email.includes('admin') ? 'admin' : 'grower';
    login('dev-token', r);
    return Promise.resolve({ token: 'dev-token', role: r });
  },
  logout
};