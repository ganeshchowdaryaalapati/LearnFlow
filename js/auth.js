/**
 * Authentication & Account Sharing Manager
 */

const AUTH_KEY = 'skill_roadmap_user_auth';
const DEFAULT_SYNC_CODE = 'LEARNFLOW-SHARED-FAMILY-SYNC-2026';

export class AuthManager {
  constructor() {
    this.user = this.getSavedUser();
  }

  getSavedUser() {
    const saved = localStorage.getItem(AUTH_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
    // Default demo user account with shared sync code
    return {
      id: 'shared_family_account',
      name: 'Shared Family Account',
      email: 'family@learnflow.app',
      sharedCode: DEFAULT_SYNC_CODE,
      isLoggedIn: true
    };
  }

  saveUser(userData) {
    this.user = { ...userData, isLoggedIn: true };
    localStorage.setItem(AUTH_KEY, JSON.stringify(this.user));
    window.dispatchEvent(new Event('auth_state_changed'));
  }

  login(emailOrId, password, syncCode) {
    const userObj = {
      id: emailOrId.toLowerCase().trim(),
      name: emailOrId.split('@')[0] || emailOrId,
      email: emailOrId.includes('@') ? emailOrId : `${emailOrId}@shared.app`,
      sharedCode: syncCode || DEFAULT_SYNC_CODE,
      isLoggedIn: true
    };
    this.saveUser(userObj);
    return userObj;
  }

  logout() {
    localStorage.removeItem(AUTH_KEY);
    this.user = null;
    window.dispatchEvent(new Event('auth_state_changed'));
  }

  getCurrentUser() {
    return this.user;
  }
}

export const auth = new AuthManager();
