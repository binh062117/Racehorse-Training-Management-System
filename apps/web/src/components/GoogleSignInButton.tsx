import { useEffect, useRef, useState } from 'react';
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
  const onTokenRef = useRef(onToken);
  const initializedRef = useRef(false);
  const [googleReady, setGoogleReady] = useState(false);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as
    | string
    | undefined;
  const language = i18n.resolvedLanguage === 'en' ? 'en' : 'vi';

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!clientId || !ref.current) return;
    let cancelled = false;

    if (window.google) {
      setGoogleReady(true);
    } else {
      const timer = window.setInterval(() => {
        if (window.google) {
          window.clearInterval(timer);
          if (!cancelled) setGoogleReady(true);
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
  }, [clientId]);

  useEffect(() => {
    if (!clientId || !googleReady || !window.google || initializedRef.current) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => onTokenRef.current(response.credential),
    });
    initializedRef.current = true;
  }, [clientId, googleReady]);

  useEffect(() => {
    if (!clientId || !googleReady || !window.google || !ref.current) return;
    ref.current.replaceChildren();
    window.google.accounts.id.renderButton(ref.current, {
      theme: 'outline',
      size: 'large',
      width: 320,
      locale: language,
    });
    return () => ref.current?.replaceChildren();
  }, [clientId, googleReady, language]);

  if (!clientId) return null;
  return <div ref={ref} />;
}
