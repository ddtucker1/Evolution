import { useState } from 'react';

export default function Auth({ onLogin, isOnline }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin(username, password, mode);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOnline) {
    return (
      <div className="auth-form">
        <h1>Card Fusion Battle</h1>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6 }}>
          You are offline. You can play against CPU opponents, but multiplayer requires an internet connection.
        </p>
        <button className="btn-primary" onClick={() => onLogin(null, null, 'offline')}>
          Play Offline
        </button>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h1>Card Fusion Battle</h1>
      <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
        {mode === 'login' ? 'Sign in to play online' : 'Create your account'}
      </p>

      <div className="form-group">
        <label>Username</label>
        <input value={username} onChange={e => setUsername(e.target.value)} required minLength={3} />
      </div>

      <div className="form-group">
        <label>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={4} />
      </div>

      {error && <p style={{ color: 'var(--accent-red)', fontSize: 13, textAlign: 'center' }}>{error}</p>}

      <button className="btn-primary" type="submit" disabled={loading}>
        {loading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Register'}
      </button>

      <button
        type="button"
        className="btn-secondary"
        onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
      >
        {mode === 'login' ? 'Need an account? Register' : 'Have an account? Sign In'}
      </button>
    </form>
  );
}
