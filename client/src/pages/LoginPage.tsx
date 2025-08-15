import React, { useState } from 'react';
import { login } from '../lib/auth';

export default function LoginPage() {
  const [r, setR] = useState<'admin'|'grower'>('grower');
  const [t, setT] = useState('');

  return (
    <div className="min-h-[60vh] grid place-items-center">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          login(t || 'dev', r);
          window.location.href = r === 'admin' ? '/admin' : '/grower';
        }}
        className="w-full max-w-sm bg-white border rounded-xl p-4 space-y-3"
      >
        <h1 className="text-lg font-semibold">Sign in</h1>

        <label className="block text-sm">Role</label>
        <select className="w-full border rounded p-2" value={r} onChange={e => setR(e.target.value as any)}>
          <option value="grower">Grower</option>
          <option value="admin">Admin</option>
        </select>

        <label className="block text-sm">Token</label>
        <input className="w-full border rounded p-2" value={t} onChange={e => setT(e.target.value)} placeholder="(dev token)"/>

        <button className="w-full bg-black text-white rounded p-2">Continue</button>
      </form>
    </div>
  );
}