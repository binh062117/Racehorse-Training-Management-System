import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface GoogleCredentialResponse {
  credential: string;
}

interface GoogleAccountsId {
  initialize(config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
  }): void;
  renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleAccountsId } };
  }
}

/** Renders the official Google "Sign in with Google" button via GSI. */
export function GoogleSignInButton({
  onToken,
}: {
  onToken: (idToken: string) => void;
}) {
  const { i18n } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as
    | string
    | undefined;

  useEffect(() => {
    if (!clientId || !ref.current) return;
    let cancelled = false;

    const render = () => {
      if (cancelled || !window.google || !ref.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => onToken(response.credential),
      });
      window.google.accounts.id.renderButton(ref.current, {
        theme: 'outline',
        size: 'large',
        width: 320,
        locale: i18n.language,
      });
    };

    if (window.google) {
      render();
    } else {
      const timer = window.setInterval(() => {
        if (window.google) {
          window.clearInterval(timer);
          render();
        }
      }, 100);
      return () => {
        cancelled = true;
        window.clearInterval(timer);
      };
    }
    return () => {
      cancelled = true;
    };
  }, [clientId, onToken, i18n.language]);

  if (!clientId) return null;
  return <div ref={ref} />;
}
