import { useState } from 'react';
import { enterGuest, supabase } from '../lib/db';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) setError(error.message);
    setBusy(false);
  }

  return (
    <div className="center">
      <form className="login" onSubmit={submit}>
        <div>
          <h1>Fee Register</h1>
          <p className="muted">Sign in to see who has paid.</p>
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="err" role="alert">{error}</p>}
        <button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <div className="or"><span>or just looking around?</span></div>
        <button type="button" className="btn secondary" onClick={enterGuest}>Try the demo</button>
        <p className="hint" style={{ textAlign: 'center' }}>Sample students, kept only on this device. Nothing touches a real register.</p>
      </form>
    </div>
  );
}
