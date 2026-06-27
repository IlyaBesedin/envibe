import React from 'react';
import Head from 'next/head';

export default function SignInForm({
  email,
  onEmailChange,
  password,
  onPasswordChange,
  isPasswordVisible,
  onTogglePasswordVisibility,
  authError,
  onSubmit,
}) {
  return (
    <>
      <Head>
        <title>Envibe Sign In</title>
        <meta name="description" content="Envibe Sign In" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          paddingTop: 'calc(2rem + env(safe-area-inset-top))',
          paddingBottom: 'calc(2rem + env(safe-area-inset-bottom))',
          paddingLeft: 'calc(2rem + env(safe-area-inset-left))',
          paddingRight: 'calc(2rem + env(safe-area-inset-right))',
          background: 'var(--page-bg)',
          color: 'var(--text-primary)',
          boxSizing: 'border-box',
        }}
      >
        <form
          onSubmit={onSubmit}
          data-testid="sign-in-form"
          style={{ width: 'min(380px, 95vw)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1rem', boxShadow: 'var(--shadow-elevated)', background: 'var(--surface)', color: 'var(--text-primary)' }}
        >
          <h1 style={{ margin: 0, marginBottom: '0.5rem', fontSize: '1.15rem', textAlign: 'center' }}>Envibe</h1>
          <label style={{ display: 'grid', gap: '0.25rem', marginBottom: '0.75rem', textAlign: 'left' }}>
            <span style={{ fontSize: '0.85rem' }}>Email</span>
            <input
              data-testid="sign-in-email-input"
              type="email"
              required
              value={email}
              onChange={(e) => onEmailChange(e.target.value)}
              style={{ padding: '0.5rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: '0.4rem', fontSize: '16px', boxSizing: 'border-box', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
            />
          </label>
          <label style={{ display: 'grid', gap: '0.25rem', marginBottom: '0.75rem', textAlign: 'left' }}>
            <span style={{ fontSize: '0.85rem' }}>Password</span>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                data-testid="sign-in-password-input"
                type={isPasswordVisible ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                style={{ padding: '0.5rem 2.4rem 0.5rem 0.6rem', border: '1px solid var(--border-color)', borderRadius: '0.4rem', fontSize: '16px', boxSizing: 'border-box', width: '100%', background: 'var(--input-bg)', color: 'var(--text-primary)' }}
              />
              <button
                type="button"
                onClick={onTogglePasswordVisibility}
                style={{
                  position: 'absolute',
                  right: '0.4rem',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.2rem',
                  fontSize: '1rem',
                  lineHeight: 1,
                  color: 'var(--text-secondary)',
                  WebkitAppearance: 'none',
                  appearance: 'none',
                }}
                aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
              >
                {isPasswordVisible ? 'H' : 'S'}
              </button>
            </div>
          </label>
          {authError && (
            <div data-testid="sign-in-error" style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{authError}</div>
          )}
          <button
            type="submit"
            data-testid="sign-in-submit"
            style={{ marginTop: '1rem', width: '100%', padding: '0.6rem 0.8rem', borderRadius: '0.5rem', border: '1px solid var(--accent-strong)', background: 'var(--accent-strong)', color: 'var(--text-on-accent)', cursor: 'pointer', fontSize: '16px', WebkitAppearance: 'none', appearance: 'none' }}
          >
            Sign In
          </button>
        </form>
      </div>
    </>
  );
}
