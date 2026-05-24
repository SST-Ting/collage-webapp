import { Link } from 'react-router-dom';
import Icon from './Icon';
import type React from 'react';

type AppShellProps = {
  title?: string;
  backTo?: string;
  dark?: boolean;
  rightAction?: React.ReactNode;
  children: React.ReactNode;
};

export function AppShell({ title, backTo, dark, rightAction, children }: AppShellProps) {
  return (
    <main className={dark ? 'app-shell app-shell-dark' : 'app-shell'}>
      {(title || backTo) && (
        <header className={dark ? 'app-bar app-bar-dark' : 'app-bar'}>
          <div className="app-bar-side">
            {backTo && (
              <Link className="icon-button" to={backTo} aria-label="Back">
                <Icon name="chevronLeft" />
              </Link>
            )}
          </div>
          <div className="app-bar-title">{title}</div>
          <div className="app-bar-side app-bar-side-right">{rightAction}</div>
        </header>
      )}
      {children}
    </main>
  );
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'brand' | 'ghost' | 'sun';
  fullWidth?: boolean;
  icon?: React.ReactNode;
};

export function Button({ variant = 'primary', fullWidth, icon, children, className = '', ...props }: ButtonProps) {
  return (
    <button className={`sb-button sb-button-${variant} ${fullWidth ? 'sb-button-full' : ''} ${className}`} {...props}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

export function LoadingCard({ message = '整緊…' }: { message?: string }) {
  return (
    <div className="state-card">
      <div className="loader-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p>{message}</p>
    </div>
  );
}

export function ErrorCard({ title = '咦？再試一次睇下', message }: { title?: string; message?: string }) {
  return (
    <div className="state-card state-card-error">
      <h2>{title}</h2>
      {message && <p>{message}</p>}
    </div>
  );
}
