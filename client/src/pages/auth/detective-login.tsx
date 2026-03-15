import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { useLogin } from "@/lib/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/seo";
import { api, getOrFetchCsrfToken } from "@/lib/api";

// @ts-ignore
import heroBgPng from "@assets/generated_images/professional_modern_city_skyline_at_dusk_with_subtle_mystery_vibes.png";
// @ts-ignore
import heroBgWebp from "@assets/generated_images/professional_modern_city_skyline_at_dusk_with_subtle_mystery_vibes.webp";

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_detective_blocked: "Google sign-in is not available for detective accounts. Please use email/password to sign in.",
  google_not_configured: "Google sign-in is not configured.",
  google_no_code: "Google did not return a code. Please try again.",
  google_token_failed: "Could not verify with Google. Please try again.",
  google_no_token: "Could not get access from Google. Please try again.",
  google_userinfo_failed: "Could not load your Google profile. Please try again.",
  google_no_email: "Your Google account has no email we can use.",
  google_login_failed: "Sign-in with Google failed. Please try again.",
  session_failed: "Session error. Please try again.",
};

export default function DetectiveLogin() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSendingReset, setIsSendingReset] = useState(false);
  const loginMutation = useLogin();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch CSRF token on page load to establish session
  useEffect(() => {
    getOrFetchCsrfToken().catch((err) => {
      console.error("[DetectiveLogin] Failed to fetch CSRF token:", err);
      toast({
        title: "Session error",
        description: "Could not establish a secure session. Please refresh the page.",
        variant: "destructive",
      });
    });
  }, [toast]);

  // Show error from URL (e.g. after Google callback redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error && GOOGLE_ERROR_MESSAGES[error]) {
      toast({
        title: "Sign-in issue",
        description: GOOGLE_ERROR_MESSAGES[error],
        variant: "destructive",
      });
      // Clear ?error= from URL without full reload
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [toast]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please enter both email and password",
        variant: "destructive",
      });
      return;
    }
    try {
      console.log("[DetectiveLogin] Starting mutateAsync");
      const result = await loginMutation.mutateAsync({ email: email.trim().toLowerCase(), password });
      console.log("[DetectiveLogin] mutateAsync resolved", { hasUser: !!result?.user, role: result?.user?.role });
      if (result.applicant) {
        console.log("[DetectiveLogin] applicant detected, redirecting to application-under-review");
        setLocation("/application-under-review");
        return;
      }
      console.log("[DetectiveLogin] refetchQueries start", { key: ["auth", "me"] });
      await queryClient.refetchQueries({ queryKey: ["auth", "me"] });
      console.log("[DetectiveLogin] refetchQueries done", { key: ["auth", "me"] });
      console.log("[DetectiveLogin] cache after refetch", queryClient.getQueryData(["auth", "me"]));
      const user = result.user;
      if (user) {
        toast({ title: "Welcome back!", description: `Logged in as ${user.name}` });
        if (user.role === "admin") {
          console.log("[DetectiveLogin] navigate -> /admin/dashboard");
          setLocation("/admin/dashboard");
        } else if (user.role === "employee") {
          console.log("[DetectiveLogin] navigate -> /employee/dashboard");
          setLocation("/employee/dashboard");
        } else if (user.role === "detective") {
          console.log("[DetectiveLogin] navigate -> /detective/dashboard");
          setLocation("/detective/dashboard");
        } else {
          // General user trying to use detective login - redirect to detective signup
          console.log("[DetectiveLogin] non-detective user, redirecting to detective-signup");
          toast({
            title: "Detective account required",
            description: "Please apply to become a detective first.",
            variant: "default",
          });
          setLocation("/detective-signup");
        }
      }
    } catch (error: any) {
      console.error("[DetectiveLogin] mutateAsync failed", error);
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    }
  };

  const handleForgotPassword = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      toast({
        title: "Email required",
        description: "Enter your email first, then click Forgot password.",
        variant: "destructive",
      });
      return;
    }

    setIsSendingReset(true);
    try {
      await api.auth.forgotPassword(normalizedEmail);
      toast({
        title: "Reset link sent",
        description: "If this email exists, password reset instructions were sent.",
      });
    } catch (error: any) {
      toast({
        title: "Request failed",
        description: error?.message || "Could not send reset email. Try again.",
        variant: "destructive",
      });
    } finally {
      setIsSendingReset(false);
    }
  };

  return (
    <>
      <SEO 
        title="Detective Sign In | Ask Detectives"
        description="Sign in to your Ask Detectives detective account to manage your profile, cases, and client communications."
        robots="noindex, follow"
      />
      <div className="min-h-screen flex bg-white">
      {/* Left Side - Image */}
      <div className="hidden lg:flex flex-1 bg-gray-900 relative items-center justify-center overflow-hidden">
        <picture>
          <source srcSet={heroBgWebp} type="image/webp" />
          <img
            src={heroBgPng}
            alt=""
            className="absolute inset-0 z-0 opacity-60 object-cover w-full h-full"
            {...({
              fetchpriority: "low",
              loading: "lazy",
              decoding: "async",
            } as React.ImgHTMLAttributes<HTMLImageElement>)}
          />
        </picture>
        <div className="relative z-10 p-12 text-white max-w-xl">
          <h1 className="text-5xl font-bold font-heading mb-6">
            Detective Portal.
          </h1>
          <p className="text-xl text-gray-200">
            Sign in to access your detective dashboard, manage cases, and communicate with clients.
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 md:p-16 lg:p-24">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-gray-900 font-heading">
              Detective Sign In
            </h2>
            <p className="mt-2 text-gray-600">
              Not a detective yet? <Link href="/detective-signup" className="text-green-600 font-semibold hover:underline">Apply here</Link>
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Looking for a detective? <Link href="/login" className="text-green-600 hover:underline">User login</Link>
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="name@example.com"
                className="h-12 bg-gray-50 border-gray-200"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  className="text-sm text-green-600 hover:underline bg-transparent border-0 p-0 cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    if (!isSendingReset) {
                      handleForgotPassword();
                    }
                  }}
                  disabled={isSendingReset}
                  title={isSendingReset ? "Sending reset link..." : "Send password reset email"}
                >
                  {isSendingReset ? "Sending..." : "Forgot password?"}
                </button>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                className="h-12 bg-gray-50 border-gray-200"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-lg font-bold"
              disabled={loginMutation.isPending}
              data-testid="button-detective-login"
            >
              {loginMutation.isPending ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <div className="text-xs text-gray-500 text-center mt-8">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
