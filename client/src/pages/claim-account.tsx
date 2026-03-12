import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { api } from "@/lib/api";
import { Footer } from "@/components/layout/footer";
import { SEO } from "@/components/seo";

interface VerificationResponse {
  valid: boolean;
  detective: {
    id: string;
    businessName: string;
    contactEmail: string;
  };
}

export default function ClaimAccount() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const token = new URLSearchParams(search).get("token");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationStatus, setVerificationStatus] = useState<"loading" | "valid" | "invalid">("loading");
  const [detectiveInfo, setDetectiveInfo] = useState<VerificationResponse["detective"] | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  // Verify token on mount
  useEffect(() => {
    if (!token) {
      setVerificationStatus("invalid");
      setErrorMessage("No claim token provided");
      return;
    }

    const verifyToken = async () => {
      try {
        const data = await api.post<VerificationResponse>("/api/claim-account/verify", { token });
        setVerificationStatus("valid");
        setDetectiveInfo(data.detective);
        // Pre-fill email if available
        if (data.detective.contactEmail) {
          setEmail(data.detective.contactEmail);
        }
      } catch (error: any) {
        setVerificationStatus("invalid");
        setErrorMessage(error.message || "Invalid or expired claim link");
      }
    };

    verifyToken();
  }, [token]);

  const claimAccount = useMutation({
    mutationFn: async (claimData: { token: string; email: string; password: string }) => {
      return api.post("/api/claim-account", claimData);
    },
    onSuccess: () => {
      setTimeout(() => {
        setLocation("/login");
      }, 3000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      return;
    }

    if (!email || !email.includes("@")) {
      setErrorMessage("Please enter a valid email address");
      return;
    }

    if (!password || password.length < 8) {
      setErrorMessage("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match");
      return;
    }

    claimAccount.mutate({ token, email, password });
  };

  // Loading state while verifying token
  if (verificationStatus === "loading") {
    return (
      <>
        <SEO 
          title="Claim Your Detective Account | Ask Detectives"
          description="Claim ownership of your detective profile to manage your business and access premium features."
          robots="noindex, follow"
        />
        <Navbar />
        <div className="min-h-screen bg-gray-50 py-16">
          <div className="container max-w-md mx-auto px-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Verifying Claim Link
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">Please wait while we verify your claim link...</p>
              </CardContent>
            </Card>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // Invalid token state
  if (verificationStatus === "invalid") {
    return (
      <>
        <SEO 
          title="Claim Your Detective Account | Ask Detectives"
          description="Claim ownership of your detective profile to manage your business and access premium features."
          robots="noindex, follow"
        />
        <Navbar />
        <div className="min-h-screen bg-gray-50 py-16">
          <div className="container max-w-md mx-auto px-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                  Invalid Claim Link
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert variant="destructive">
                  <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
                <p className="text-sm text-gray-600">
                  This claim link may be invalid, expired, or already used. 
                  Please check your email for the original claim link or contact support for assistance.
                </p>
                <Button onClick={() => setLocation("/")} className="w-full">
                  Return to Home
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // Success state after claiming
  if (claimAccount.isSuccess) {
    return (
      <>
        <SEO 
          title="Claim Your Detective Account | Ask Detectives"
          description="Claim ownership of your detective profile to manage your business and access premium features."
          robots="noindex, follow"
        />
        <Navbar />
        <div className="min-h-screen bg-gray-50 py-16">
          <div className="container max-w-md mx-auto px-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  Account Claimed Successfully!
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="border-green-200 bg-green-50">
                  <AlertDescription className="text-green-800">
                    Your account has been claimed successfully! You can now log in with your email and password.
                  </AlertDescription>
                </Alert>
                <p className="text-sm text-gray-600">
                  You will be redirected to the login page shortly. Use your email and the password you just set to sign in.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // Valid token - show claim form
  return (
    <>
      <SEO 
        title="Claim Your Detective Account | Ask Detectives"
        description="Claim ownership of your detective profile to manage your business and access premium features."
        robots="noindex, follow"
      />
      <Navbar />
      <div className="min-h-screen bg-gray-50 py-16">
        <div className="container max-w-md mx-auto px-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                Claim Your Account
              </CardTitle>
              <CardDescription>
                {detectiveInfo?.businessName && (
                  <span className="font-medium text-gray-900">
                    Account: {detectiveInfo.businessName}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {claimAccount.isError && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {claimAccount.error?.message || "Failed to claim account. Please try again."}
                    </AlertDescription>
                  </Alert>
                )}

                {errorMessage && (
                  <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your.email@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrorMessage("");
                    }}
                    required
                    disabled={claimAccount.isPending}
                  />
                  <p className="text-xs text-gray-500">
                    This email will be used to log in to your account.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter a secure password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setErrorMessage("");
                    }}
                    required
                    disabled={claimAccount.isPending}
                    minLength={8}
                  />
                  <p className="text-xs text-gray-500">
                    Minimum 8 characters. Use a strong password with letters, numbers, and symbols.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setErrorMessage("");
                    }}
                    required
                    disabled={claimAccount.isPending}
                    minLength={8}
                  />
                  <p className="text-xs text-gray-500">
                    Must match the password above.
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={claimAccount.isPending}
                >
                  {claimAccount.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Claiming Account...
                    </>
                  ) : (
                    "Claim Account"
                  )}
                </Button>

                <p className="text-xs text-gray-500 text-center">
                  By claiming this account, you confirm that you are authorized to access it.
                  You will receive further instructions via email.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </>
  );
}
