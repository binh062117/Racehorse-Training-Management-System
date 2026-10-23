import { useEffect, useRef } from 'react';

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
        shape: 'rectangular',
        // GSI draws at a fixed pixel width (max 400): match the form column so it lines up with the inputs.
        width: Math.min(400, Math.max(200, ref.current.offsetWidth)),
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
  }, [clientId, onToken]);

  if (!clientId) return null;
  return <div ref={ref} className="w-full flex justify-center min-h-[44px]" />;
}
