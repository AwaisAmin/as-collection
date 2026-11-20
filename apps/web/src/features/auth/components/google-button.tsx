'use client';

import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';

/** The parts of Google Identity Services we use (https://developers.google.com/identity/gsi/web). */
interface GoogleIdentity {
  initialize(config: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    ux_mode?: 'popup';
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: 'signin' | 'signup' | 'use';
  }): void;
  renderButton(
    parent: HTMLElement,
    options: {
      type?: 'standard';
      theme?: 'outline' | 'filled_black';
      size?: 'large';
      shape?: 'pill';
      text?: 'continue_with';
      logo_alignment?: 'center';
      width?: number;
    },
  ): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}

interface GoogleButtonProps {
  clientId: string;
  /** Receives Google's ID token; the server sends it to the API, which verifies it. */
  onCredential: (credential: string) => void;
}

/**
 * Google's own "Continue with Google" button (Google requires its rendered button; it opens a
 * popup, so the shopper never leaves the page). The ID token never touches storage here.
 */
export function GoogleButton({ clientId, onCredential }: GoogleButtonProps) {
  const container = useRef<HTMLDivElement>(null);
  const callback = useRef(onCredential);
  const [loaded, setLoaded] = useState(() => typeof window !== 'undefined' && !!window.google);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    callback.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    const google = window.google?.accounts.id;
    const parent = container.current;
    if (!loaded || !google || !parent) return;
    google.initialize({
      client_id: clientId,
      callback: ({ credential }) => callback.current(credential),
      ux_mode: 'popup',
      auto_select: false,
      context: 'signin',
    });
    google.renderButton(parent, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      logo_alignment: 'center',
      width: Math.min(400, Math.max(200, parent.offsetWidth)),
    });
  }, [loaded, clientId]);

  if (failed) {
    return (
      <p className="text-center text-[15px] text-muted">
        Google sign-in couldn&apos;t load. Please use your mobile number instead.
      </p>
    );
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onReady={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
      <div ref={container} className="flex min-h-11 w-full justify-center" />
    </>
  );
}
