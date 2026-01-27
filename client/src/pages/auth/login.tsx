import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useLogin } from "@/lib/hooks";
import { useToast } from "@/hooks/use-toast";

// @ts-ignore
import heroBgPng from "@assets/generated_images/professional_modern_city_skyline_at_dusk_with_subtle_mystery_vibes.png";
// @ts-ignore
import heroBgWebp from "@assets/generated_images/professional_modern_city_skyline_at_dusk_with_subtle_mystery_vibes.webp";

export default function Login() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const loginMutation = useLogin();
  const { toast } = useToast();

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
      const result = await loginMutation.mutateAsync({ email: email.trim().toLowerCase(), password: password });
      if (result.applicant) {
        setLocation("/application-under-review");
        return;
      }
      const user = result.user;
      if (user) {
        toast({ title: "Welcome back!", description: `Logged in as ${user.name}` });
        if (user.role === "admin") {
          setLocation("/admin/dashboard");
        } else if (user.role === "detective") {
          setLocation("/detective/dashboard");
        } else {
          setLocation("/");
        }
      }
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Side - Image */}
      <div className="hidden lg:flex flex-1 bg-gray-900 relative items-center justify-center overflow-hidden">
         <picture>
           <source srcSet={heroBgWebp} type="image/webp" />
           <img
            src={heroBgPng}
            alt=""
            fetchpriority="low"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 z-0 opacity-60 object-cover w-full h-full"
          />
         </picture>
          <div className="relative z-10 p-12 text-white max-w-xl">
            <h1 className="text-5xl font-bold font-heading mb-6">Welcome Back.</h1>
            <p className="text-xl text-gray-200">Log in to access your dashboard, manage investigations, or find the perfect detective for your case.</p>
          </div>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 md:p-16 lg:p-24">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold text-gray-900 font-heading">Sign in to FindDetectives</h2>
            <p className="mt-2 text-gray-600">Don't have an account? <Link href="/signup" className="text-green-600 font-semibold hover:underline">Join here</Link></p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email or Username</Label>
              <Input 
                id="email" 
                placeholder="name@example.com" 
                className="h-12 bg-gray-50 border-gray-200"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <a href="#" className="text-sm text-green-600 hover:underline">Forgot password?</a>
              </div>
              <Input 
                id="password" 
                type="password" 
                className="h-12 bg-gray-50 border-gray-200"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 bg-green-600 hover:bg-green-700 text-lg font-bold"
              disabled={loginMutation.isPending}
              data-testid="button-login"
            >
              {loginMutation.isPending ? "Signing in..." : "Continue"}
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-200"></span></div>
              <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-500">OR</span></div>
            </div>
            
             <div className="grid grid-cols-2 gap-4">
              <Button type="button" variant="outline" className="h-12">Google</Button>
              <Button type="button" variant="outline" className="h-12">Apple</Button>
            </div>
          </form>
          
          <div className="text-xs text-gray-500 text-center mt-8">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </div>
        </div>
      </div>
    </div>
  );
}
