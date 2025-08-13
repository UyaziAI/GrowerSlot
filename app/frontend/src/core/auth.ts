/**
 * Authentication service for unified blueprint
 */

interface User {
  id: string;
  email: string;
  role: string;
  tenant_id: string;
  grower_id?: string;
  grower_name?: string;
}

class AuthService {
  private readonly TOKEN_KEY = 'grower_slot_token';
  private readonly USER_KEY = 'grower_slot_user';

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  getUser(): User | null {
    const userStr = localStorage.getItem(this.USER_KEY);
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  setUser(user: User): void {
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  hasRole(role: string): boolean {
    const user = this.getUser();
    return user?.role === role;
  }

  isAdmin(): boolean {
    return this.hasRole('admin');
  }

  isGrowerUser(): boolean {
    return this.hasRole('grower');
  }
}

export const authService = new AuthService();