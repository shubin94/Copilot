import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useLocation, useRoute } from "wouter";
import { useState, useEffect } from "react";
import { useLogin, useRegister } from "@/lib/hooks";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/seo";
import { getOrFetchCsrfToken } from "@/lib/api";

// @ts-ignore
import heroBgPng from "@assets/generated_images/professional_modern_city_skyline_at_dusk_with_subtle_mystery_vibes.png";
// @ts-ignore
import heroBgWebp from "@assets/generated_images/professional_modern_city_skyline_at_dusk_with_subtle_mystery_vibes.webp";

const GOOGLE_ERROR_MESSAGES: Record<string, string> = {
  google_not_configured: "Google sign-in is not configured.",
  google_no_code: "Google did not return a code. Please try again.",
  google_token_failed: "Could not verify with Google. Please try again.",
  google_no_token: "Could not get access from Google. Please try again.",
  google_userinfo_failed: "Could not load your Google profile. Please try again.",
  google_no_email: "Your Google account has no email we can use.",
  google_login_failed: "Sign-in with Google failed. Please try again.",
  session_failed: "Session error. Please try again.",
};

export default function Login() {
  const [, setLocation] = useLocation();
  const [matchSignup] = useRoute("/signup");
  const isSignup = !!matchSignup;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const loginMutation = useLogin();
  const registerMutation = useRegister();
  const { toast } = useToast();

  // Fetch CSRF token on page load to establish session
  useEffect(() => {
    getOrFetchCsrfToken().catch((err) => {
      console.error("[Login] Failed to fetch CSRF token:", err);
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
      const result = await loginMutation.mutateAsync({ email: email.trim().toLowerCase(), password });
      if (result.applicant) {
        setLocation("/application-under-review");
        return;
      }
      const user = result.user;
      if (user) {
        toast({ title: "Welcome back!", description: `Logged in as ${user.name}` });
        if (user.role === "admin") setLocation("/admin/dashboard");
        else if (user.role === "employee") setLocation("/admin/dashboard");
        else if (user.role === "detective") setLocation("/detective/dashboard");
        else setLocation("/");
      }
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email || !password) {
      toast({
        title: "Error",
        description: "Please enter name, email, and password",
        variant: "destructive",
      });
      return;
    }
    if (password.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }
    try {
      await registerMutation.mutateAsync({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      toast({ title: "Account created", description: "Welcome! You are now signed in." });
      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Sign up failed",
        description: error.message || "Could not create account",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = isSignup ? handleSignup : handleLogin;
  const isPending = isSignup ? registerMutation.isPending : loginMutation.isPending;

  return (
    <>
      <SEO 
        title={isSignup ? "Sign Up | FindDetectives" : "Sign In | FindDetectives"}
        description={isSignup ? "Create a free FindDetectives account to find private investigators and manage your cases." : "Sign in to your FindDetectives account to access your dashboard and manage investigations."}
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
            fetchPriority="low"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 z-0 opacity-60 object-cover w-full h-full"
          />
        </picture>
        <div className="relative z-10 p-12 text-white max-w-xl">
          <h1 className="text-5xl font-bold font-heading mb-6">
            {isSignup ? "Join FindDetectives." : "Welcome Back."}
          </h1>
          <p className="text-xl text-gray-200">
            {isSignup
              ? "Create an account to find detectives, save favorites, and manage your cases."
              : "Log in to access your dashboard, manage investigations, or find the perfect detective for your case."}
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 md:p-16 lg:p-24">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-gray-900 font-heading">
              {isSignup ? "Create your account" : "Sign in to FindDetectives"}
            </h2>
            <p className="mt-2 text-gray-600">
              {isSignup ? (
                <>Already have an account? <Link href="/login" className="text-green-600 font-semibold hover:underline">Sign in</Link></>
              ) : (
                <>Don&apos;t have an account? <Link href="/signup" className="text-green-600 font-semibold hover:underline">Join here</Link></>
              )}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {isSignup && (
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Your name"
                  className="h-12 bg-gray-50 border-gray-200"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  required
                />
              </div>
            )}
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
                {!isSignup && (
                  <button
                    type="button"
                    className="text-sm text-green-600 hover:underline bg-transparent border-0 p-0 cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      toast({ title: "Not available yet", description: "This feature is not available yet." });
                    }}
                    title="Not available yet"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                className="h-12 bg-gray-50 border-gray-200"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isSignup ? "new-password" : "current-password"}
                required
                minLength={isSignup ? 8 : undefined}
              />
              {isSignup && (
                <p className="text-xs text-gray-500">At least 8 characters</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-lg font-bold"
              disabled={isPending}
              data-testid={isSignup ? "button-signup" : "button-login"}
            >
              {isPending ? (isSignup ? "Creating account..." : "Signing in...") : (isSignup ? "Create account" : "Continue")}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200" /></div>
              <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">OR</span></div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full"
                onClick={() => { window.location.href = "/api/auth/google"; }}
              >
                Continue with Google
              </Button>
            </div>
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
