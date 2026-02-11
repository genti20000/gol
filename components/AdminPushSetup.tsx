"use client";

import React, { useMemo, useState } from 'react';

type OneSignalPushSubscription = {
  optedIn?: boolean;
  optIn?: () => Promise<void>;
};

type OneSignalUser = {
  addTag?: (key: string, value: string) => Promise<void> | void;
};

type OneSignalSdk = {
  initialize?: (config: Record<string, unknown>) => Promise<void>;
  Notifications?: {
    requestPermission?: () => Promise<void>;
  };
  login?: (externalId: string) => Promise<void>;
  User?: OneSignalUser;
  pushSubscription?: OneSignalPushSubscription;
};

declare global {
  interface Window {
    OneSignalDeferred?: Array<(oneSignal: OneSignalSdk) => void>;
  }
}

export default function AdminPushSetup({ adminEmail }: { adminEmail?: string | null }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const appId = useMemo(() => process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '', []);

  const enableNotifications = async () => {
    if (!appId) {
      setMessage('OneSignal is not configured.');
      return;
    }
    setBusy(true);
    setMessage(null);

    try {
      await new Promise<void>((resolve, reject) => {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async (OneSignal: OneSignalSdk) => {
          try {
            await OneSignal.initialize?.({
              appId,
              serviceWorkerPath: '/OneSignalSDKWorker.js',
              serviceWorkerUpdaterPath: '/OneSignalSDKUpdaterWorker.js',
              allowLocalhostAsSecureOrigin: true
            });
            if (adminEmail) {
              await OneSignal.login?.(adminEmail);
            }
            await OneSignal.User?.addTag?.('role', 'admin');
            await OneSignal.Notifications?.requestPermission?.();
            if (OneSignal.pushSubscription && !OneSignal.pushSubscription.optedIn) {
              await OneSignal.pushSubscription.optIn?.();
            }
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
      setMessage('Notifications enabled for this admin device.');
    } catch (error) {
      console.warn('[ADMIN PUSH] Enable notifications failed.', error);
      setMessage('Unable to enable notifications on this device.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <button
        onClick={enableNotifications}
        disabled={busy}
        className="bg-zinc-900 border border-zinc-800 py-2 px-4 rounded-full text-[9px] font-bold uppercase tracking-widest text-zinc-300 hover:text-white transition-colors disabled:opacity-60"
      >
        {busy ? 'Enabling…' : 'Enable Notifications'}
      </button>
      {message && <span className="text-[9px] uppercase tracking-widest text-zinc-500">{message}</span>}
    </div>
  );
}
