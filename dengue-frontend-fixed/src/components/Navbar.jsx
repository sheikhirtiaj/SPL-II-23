import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ShieldMark = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const Navbar = ({ pendingVerificationCount = 0, theme = 'default' }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isLandingTheme = theme === 'landing';

  const handleBack = () => navigate('/');

  return (
    <header className={isLandingTheme ? 'da-dashboard-navbar' : 'bg-gradient-to-r from-red-700 to-red-600 text-white shadow-lg'}>
      <div className={isLandingTheme ? 'da-dashboard-navbar__inner' : 'max-w-4xl mx-auto px-4 py-3 flex items-center justify-between'}>
        <button
          type="button"
          onClick={handleBack}
          className={isLandingTheme ? 'da-dashboard-navbar__brand' : 'flex items-center gap-2 hover:opacity-90 transition-opacity'}
        >
          <span className={isLandingTheme ? 'da-dashboard-navbar__brand-icon' : 'w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center'}>
            {isLandingTheme ? <ShieldMark /> : <span className="text-lg">🦟</span>}
          </span>
          <span className={isLandingTheme ? 'da-dashboard-navbar__brand-copy' : 'text-left'}>
            <span className={isLandingTheme ? 'da-dashboard-navbar__title' : 'block font-bold text-sm leading-tight'}>Dengue Alert</span>
            <span className={isLandingTheme ? 'da-dashboard-navbar__subtitle' : 'block text-xs text-red-200 leading-tight'}>Ward Management</span>
          </span>
        </button>

        <div className={isLandingTheme ? 'da-dashboard-navbar__actions' : 'flex items-center gap-3'}>
          {user?.role === 'Councillor' && pendingVerificationCount > 0 && (
            <button
              type="button"
              onClick={() => navigate('/councillor?filter=Pending+Verification')}
              className={isLandingTheme ? 'da-dashboard-navbar__notification' : 'relative w-9 h-9 flex items-center justify-center rounded-full bg-white bg-opacity-15 hover:bg-opacity-25 transition-colors'}
              title={`${pendingVerificationCount} pending verification${pendingVerificationCount > 1 ? 's' : ''}`}
              aria-label={`${pendingVerificationCount} pending verifications`}
            >
              <span aria-hidden="true">🔔</span>
              <span className={isLandingTheme ? 'da-dashboard-navbar__notification-count' : 'absolute -top-1 -right-1 bg-amber-400 text-gray-900 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center'}>
                {pendingVerificationCount > 9 ? '9+' : pendingVerificationCount}
              </span>
            </button>
          )}

          {user && (
            <div className={isLandingTheme ? 'da-dashboard-navbar__user' : 'hidden sm:block text-right'}>
              <span className={isLandingTheme ? 'da-dashboard-navbar__user-name' : 'block text-sm font-semibold leading-tight'}>{user.full_name}</span>
              <span className={isLandingTheme ? 'da-dashboard-navbar__user-role' : 'block text-xs text-red-200 leading-tight'}>
                {user.role}{user.ward_id ? ` · Ward ${user.ward_id}` : ''}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={logout}
            className={isLandingTheme ? 'da-dashboard-navbar__logout' : 'bg-white bg-opacity-15 hover:bg-opacity-25 text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors'}
          >
            Log out
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
