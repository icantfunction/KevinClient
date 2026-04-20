// Stage 10 Auth Provider Purpose
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { studioOsCognitoRegion, studioOsRuntimeConfig } from "@/lib/studio-os-config";
import { resolveDemoPayload } from "@/lib/studio-os-demo-data";

type AuthStatus = "booting" | "signed_out" | "challenge" | "authenticated";

type AuthSession = {
  readonly phoneNumber: string;
  readonly accessToken: string;
  readonly idToken: string;
  readonly refreshToken: string;
  readonly expiresAt: number;
  readonly demoMode?: boolean;
};

const demoStorageKey = "studio-os-admin-demo-mode-v1";

const isDemoModeActive = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  const urlFlag = new URLSearchParams(window.location.search).get("demo");
  if (urlFlag === "1" || urlFlag === "true") {
    window.localStorage.setItem(demoStorageKey, "1");
    return true;
  }

  if (urlFlag === "0" || urlFlag === "false") {
    window.localStorage.removeItem(demoStorageKey);
    return false;
  }

  return window.localStorage.getItem(demoStorageKey) === "1";
};

const makeDemoSession = (): AuthSession => ({
  phoneNumber: "+1 (954) 854-1484",
  accessToken: "demo.accessToken",
  idToken: "demo.idToken",
  refreshToken: "demo.refreshToken",
  expiresAt: Date.now() + 86400000,
  demoMode: true,
});

const demoResponse = (path: string): Response => {
  const payload = resolveDemoPayload(path) ?? {};
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

type ChallengeState = {
  readonly phoneNumber: string;
  readonly session: string | null;
};

type StudioOsAuthContextValue = {
  readonly status: AuthStatus;
  readonly session: AuthSession | null;
  readonly challengePhoneNumber: string | null;
  readonly isWorking: boolean;
  readonly errorMessage: string | null;
  readonly requestCode: (phoneNumber: string) => Promise<void>;
  readonly verifyCode: (otpCode: string) => Promise<void>;
  readonly logout: () => void;
  readonly authorizedFetch: (path: string, init?: RequestInit) => Promise<Response>;
};

const storageKey = "studio-os-admin-session-v1";
const cognitoEndpoint = `https://cognito-idp.${studioOsCognitoRegion}.amazonaws.com/`;

const StudioOsAuthContext = createContext<StudioOsAuthContextValue | null>(null);

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const segment = token.split(".")[1];
    if (!segment) {
      return null;
    }

    const normalized = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
    return JSON.parse(window.atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
};

const isSessionExpired = (session: AuthSession | null, skewSeconds = 60) =>
  !session || Date.now() >= session.expiresAt - skewSeconds * 1000;

const persistSession = (session: AuthSession | null) => {
  if (typeof window === "undefined") {
    return;
  }

  if (!session) {
    window.localStorage.removeItem(storageKey);
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(session));
};

const loadSession = (): AuthSession | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AuthSession;
    return parsed?.accessToken ? parsed : null;
  } catch {
    return null;
  }
};

const toSession = (phoneNumber: string, authenticationResult: Record<string, unknown>): AuthSession => {
  const accessToken = String(authenticationResult.AccessToken ?? "");
  const idToken = String(authenticationResult.IdToken ?? "");
  const refreshToken = String(authenticationResult.RefreshToken ?? "");
  const payload = decodeJwtPayload(accessToken);
  const exp = typeof payload?.exp === "number" ? payload.exp : Math.floor(Date.now() / 1000) + 900;

  return {
    phoneNumber,
    accessToken,
    idToken,
    refreshToken,
    expiresAt: exp * 1000,
  };
};

const callCognito = async (target: string, body: Record<string, unknown>) => {
  const response = await fetch(cognitoEndpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-amz-json-1.1",
      "x-amz-target": `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const message =
      String(payload.message ?? payload.Message ?? payload.__type ?? "Unable to complete authentication.");
    throw new Error(message);
  }

  return payload;
};

export function StudioOsAuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>("booting");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [challenge, setChallenge] = useState<ChallengeState | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoModeActive()) {
      const nextSession = makeDemoSession();
      setSession(nextSession);
      setStatus("authenticated");
      return;
    }

    const storedSession = loadSession();
    setSession(storedSession);
    setStatus(storedSession ? "authenticated" : "signed_out");
  }, []);

  const refreshSession = useEffectEvent(async () => {
    if (!session?.refreshToken) {
      throw new Error("Refresh token is missing.");
    }

    const payload = await callCognito("InitiateAuth", {
      AuthFlow: "REFRESH_TOKEN_AUTH",
      ClientId: studioOsRuntimeConfig.userPoolClientId,
      AuthParameters: {
        REFRESH_TOKEN: session.refreshToken,
      },
    });

    const authenticationResult = payload.AuthenticationResult as Record<string, unknown> | undefined;
    if (!authenticationResult) {
      throw new Error("Refresh did not return a new access token.");
    }

    const refreshedSession = {
      ...toSession(session.phoneNumber, {
        ...authenticationResult,
        RefreshToken: session.refreshToken,
      }),
      refreshToken: session.refreshToken,
    };

    setSession(refreshedSession);
    persistSession(refreshedSession);
    setStatus("authenticated");
    return refreshedSession;
  });

  const requestCode = useEffectEvent(async (phoneNumber: string) => {
    setIsWorking(true);
    setErrorMessage(null);

    try {
      const normalized = phoneNumber.trim();
      const payload = await callCognito("InitiateAuth", {
        AuthFlow: "CUSTOM_AUTH",
        ClientId: studioOsRuntimeConfig.userPoolClientId,
        AuthParameters: {
          USERNAME: normalized,
        },
      });

      setChallenge({
        phoneNumber: normalized,
        session: typeof payload.Session === "string" ? payload.Session : null,
      });
      setStatus("challenge");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to send the code.");
      throw error;
    } finally {
      setIsWorking(false);
    }
  });

  const verifyCode = useEffectEvent(async (otpCode: string) => {
    if (!challenge) {
      throw new Error("Request a code before verifying.");
    }

    setIsWorking(true);
    setErrorMessage(null);

    try {
      const payload = await callCognito("RespondToAuthChallenge", {
        ClientId: studioOsRuntimeConfig.userPoolClientId,
        ChallengeName: "CUSTOM_CHALLENGE",
        Session: challenge.session,
        ChallengeResponses: {
          USERNAME: challenge.phoneNumber,
          ANSWER: otpCode.trim(),
        },
      });

      const authenticationResult = payload.AuthenticationResult as Record<string, unknown> | undefined;
      if (!authenticationResult) {
        throw new Error("Verification did not return tokens.");
      }

      const nextSession = toSession(challenge.phoneNumber, authenticationResult);
      setSession(nextSession);
      persistSession(nextSession);
      setChallenge(null);
      setStatus("authenticated");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to verify the code.");
      throw error;
    } finally {
      setIsWorking(false);
    }
  });

  const logout = useEffectEvent(() => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(demoStorageKey);
    }

    setSession(null);
    setChallenge(null);
    setStatus("signed_out");
    setErrorMessage(null);
    persistSession(null);
  });

  const authorizedFetch = useEffectEvent(async (path: string, init: RequestInit = {}) => {
    if (session?.demoMode) {
      return demoResponse(path);
    }

    let activeSession = session;

    if (isSessionExpired(activeSession) && activeSession?.refreshToken) {
      activeSession = await refreshSession();
    }

    if (!activeSession || isSessionExpired(activeSession, 0)) {
      logout();
      throw new Error("Session expired. Sign in again.");
    }

    const execute = async (accessToken: string) =>
      fetch(`${studioOsRuntimeConfig.apiUrl}${path.startsWith("/") ? path : `/${path}`}`, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          authorization: `Bearer ${accessToken}`,
        },
      });

    let response = await execute(activeSession.accessToken);
    if (response.status === 401 && activeSession.refreshToken) {
      const refreshedSession = await refreshSession();
      response = await execute(refreshedSession.accessToken);
    }

    if (response.status === 401) {
      logout();
      throw new Error("Unauthorized. Sign in again.");
    }

    return response;
  });

  const contextValue = useMemo<StudioOsAuthContextValue>(
    () => ({
      status,
      session,
      challengePhoneNumber: challenge?.phoneNumber ?? null,
      isWorking,
      errorMessage,
      requestCode,
      verifyCode,
      logout,
      authorizedFetch,
    }),
    [authorizedFetch, challenge?.phoneNumber, errorMessage, isWorking, logout, requestCode, session, status, verifyCode],
  );

  return <StudioOsAuthContext.Provider value={contextValue}>{children}</StudioOsAuthContext.Provider>;
}

export const useStudioOsAuth = () => {
  const context = useContext(StudioOsAuthContext);
  if (!context) {
    throw new Error("useStudioOsAuth must be used inside StudioOsAuthProvider.");
  }

  return context;
};
