import useAuthStore from "@/store/auth/authStore";
import useClusterStore from "@/store/cluster/clusterStore";
import useContainerStore from "@/store/container/containerStore";
import { resetAllStores } from "@/utils";
import { LoaderFunctionArgs, redirect } from "react-router-dom";

type AuthProvider = "hanzo" | "github" | "gitlab" | "bitbucket";
type GitProvider = "github" | "gitlab" | "bitbucket";

const IAM_ORIGIN = import.meta.env.VITE_IAM_ORIGIN || "https://hanzo.id";
const IAM_CLIENT_ID =
  import.meta.env.VITE_IAM_CLIENT_ID || "hanzo-platform-client-id";

function isGitProvider(provider: string | null): provider is GitProvider {
  return (
    provider === "github" || provider === "gitlab" || provider === "bitbucket"
  );
}

function getAuthProvider(provider: string | null): AuthProvider {
  if (provider === "hanzo" || isGitProvider(provider)) {
    return provider;
  }

  return "hanzo";
}

/**
 * Build the hanzo.id OAuth authorize URL.
 * The IAM login page handles all auth methods (email, GitHub, Google, wallet).
 */
function buildIamLoginUrl(callbackUrl: string): string {
  const state = btoa(JSON.stringify({ redirect: callbackUrl }));
  const params = new URLSearchParams({
    client_id: IAM_CLIENT_ID,
    redirect_uri: `${IAM_ORIGIN}/callback/platform/hanzo`,
    response_type: "code",
    scope: "openid profile email",
    state,
  });
  return `${IAM_ORIGIN}/login/oauth/authorize?${params.toString()}`;
}

async function registerLoader({ request }: LoaderFunctionArgs) {
  const requestUrl = new URL(request.url);
  const accessToken = requestUrl.searchParams.get("access_token");
  const status = requestUrl.searchParams.get("status");
  const error = requestUrl.searchParams.get("error");
  const provider = requestUrl.searchParams.get("provider");

  // OAuth callback with tokens → process the registration
  if (status === "200" && accessToken && !error) {
    const authProvider = getAuthProvider(provider);
    try {
      await useClusterStore.getState().initializeClusterSetup({
        accessToken,
        provider: authProvider,
        expiresAt: requestUrl.searchParams.get("expires_at") as string,
        refreshToken: requestUrl.searchParams.get("refresh_token") as string,
      });
      return redirect("/register/setup");
    } catch (error) {
      return error;
    }
  }

  // No tokens → redirect to hanzo.id for authentication
  const callbackUrl = new URL("/register", requestUrl.origin);
  window.location.href = buildIamLoginUrl(callbackUrl.toString());
  return null;
}

async function loginLoader({ request }: LoaderFunctionArgs) {
  const requestUrl = new URL(request.url);
  const accessToken = requestUrl.searchParams.get("access_token");
  const status = requestUrl.searchParams.get("status");
  const error = requestUrl.searchParams.get("error");
  const provider = getAuthProvider(requestUrl.searchParams.get("provider"));

  // OAuth callback with tokens → process the login
  if (status === "200" && accessToken && !error) {
    resetAllStores();
    try {
      await useAuthStore.getState().login({
        accessToken,
        provider,
        expiresAt: requestUrl.searchParams.get("expires_at") as string,
        refreshToken: requestUrl.searchParams.get("refresh_token") as string,
      });

      if (isGitProvider(provider)) {
        await useContainerStore.getState().addGitProvider({
          accessToken,
          provider,
          expiresAt: requestUrl.searchParams.get("expires_at") as string,
          refreshToken: requestUrl.searchParams.get("refresh_token") as string,
        });
      }

      return redirect("/organization");
    } catch (error) {
      return error;
    }
  }

  // No tokens → redirect to hanzo.id for authentication
  const callbackUrl = new URL("/login", requestUrl.origin);
  window.location.href = buildIamLoginUrl(callbackUrl.toString());
  return null;
}
async function orgAcceptInvitation({ request }: LoaderFunctionArgs) {
  const requestUrl = new URL(request.url);
  const accessToken = requestUrl.searchParams.get("access_token");
  const status = requestUrl.searchParams.get("status");
  const error = requestUrl.searchParams.get("error");
  const token = requestUrl.searchParams.get("token");
  const isAuthenticated = useAuthStore.getState().isAuthenticated();
  const provider = localStorage.getItem("provider");

  if (isAuthenticated) {
    useAuthStore.getState().orgAcceptInviteWithSession(token as string);
    return redirect("/organization");
  }

  if (status === "200" && accessToken && !error && isGitProvider(provider)) {
    try {
      await useAuthStore.getState().orgAcceptInvite({
        token: token as string,
        accessToken,
        provider,
        expiresAt: requestUrl.searchParams.get("expires_at") as string,
        refreshToken: requestUrl.searchParams.get("refresh_token") as string,
      });
      localStorage.removeItem("provider");
      return redirect("/organization");
    } catch (error) {
      return error;
    }
  }
  return token;
}
async function projectAcceptInvite({ request }: LoaderFunctionArgs) {
  const requestUrl = new URL(request.url);
  const accessToken = requestUrl.searchParams.get("access_token");
  const status = requestUrl.searchParams.get("status");
  const error = requestUrl.searchParams.get("error");
  const token = requestUrl.searchParams.get("token");
  const isAuthenticated = useAuthStore.getState().isAuthenticated();
  const provider = localStorage.getItem("provider");

  if (isAuthenticated) {
    useAuthStore.getState().projectAcceptInviteWithSession(token as string);
    return redirect("/organization");
  }

  if (status === "200" && accessToken && !error && isGitProvider(provider)) {
    try {
      await useAuthStore.getState().projectAcceptInvite({
        token: token as string,
        accessToken,
        provider,
        expiresAt: requestUrl.searchParams.get("expires_at") as string,
        refreshToken: requestUrl.searchParams.get("refresh_token") as string,
      });
      localStorage.removeItem("provider");
      return redirect("/organization");
    } catch (error) {
      return error;
    }
  }
  return token;
}

export default {
  registerLoader,
  loginLoader,
  orgAcceptInvitation,
  projectAcceptInvite,
};
