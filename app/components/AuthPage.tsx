"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import MelangeApp from "./MelangeApp";

export default function AuthPage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("login");
  const [signupError, setSignupError] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });

  const [signupForm, setSignupForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "",
    skills: "",
    bio: "",
    currentProject: "",
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({
      email: loginForm.email,
      password: loginForm.password,
    });
    if (error) alert(error.message);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError(null);

    if (signupForm.password !== signupForm.confirmPassword) {
      setSignupError("Passwords do not match");
      return;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: signupForm.email,
        password: signupForm.password,
      });

      if (error) {
        setSignupError(error.message);
        return;
      }

      const userId = data.user?.id;
      if (!userId) {
        setSignupError("Signup succeeded but no user ID returned. Check your email for a confirmation link.");
        return;
      }

      const skillsArray = signupForm.skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const { error: profileErr } = await supabase.from("profiles").insert({
        user_id: userId,
        name: signupForm.name,
        role: signupForm.role || null,
        bio: signupForm.bio || null,
        current_project: signupForm.currentProject || null,
        skills: skillsArray.length ? skillsArray : null,
        avatar_url: null,
      });

      if (profileErr) {
        setSignupError(`Profile insert failed: ${profileErr.message}`);
      }
    } catch (err: any) {
      setSignupError(`Unexpected error: ${err.message}`);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  const Logo = () => (
    <svg className="h-16 w-16" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="48" fill="#E0F2FE" stroke="#7C3AED" strokeWidth="2" />
      <path
        d="M50 10C55 25 75 40 90 50C75 60 55 75 50 90C45 75 25 60 10 50C25 40 45 25 50 10Z"
        fill="#BFDBFE"
        stroke="#7C3AED"
        strokeWidth="2"
      />
      <circle cx="50" cy="50" r="10" fill="#7C3AED" />
    </svg>
  );

  if (loading) return null;

  if (session) {
    return <MelangeApp onSignOut={handleSignOut} />;
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-[500px] bg-white shadow-lg rounded-xl overflow-hidden">
        <CardHeader className="bg-blue-900 text-white p-4 flex items-center">
          <Logo />
          <div className="ml-4">
            <CardTitle className="text-3xl font-bold italic transform -skew-x-6">
              <span
                style={{
                  WebkitTextStroke: "2px #A78BFA",
                  paintOrder: "stroke fill",
                }}
              >
                Melange
              </span>
            </CardTitle>
            <p className="text-sm text-blue-200 mt-1">Creative Collaborations</p>
          </div>
        </CardHeader>

        <CardContent className="p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full bg-violet-400 hover:bg-violet-500">
                  Login
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <Label htmlFor="signup-name">Name</Label>
                  <Input
                    id="signup-name"
                    value={signupForm.name}
                    onChange={(e) => setSignupForm({ ...signupForm, name: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    value={signupForm.email}
                    onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="signup-password">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={signupForm.password}
                    onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                  <Input
                    id="signup-confirm-password"
                    type="password"
                    value={signupForm.confirmPassword}
                    onChange={(e) => setSignupForm({ ...signupForm, confirmPassword: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="signup-role">Role</Label>
                  <Select value={signupForm.role} onValueChange={(value) => setSignupForm({ ...signupForm, role: value })}>
                    <SelectTrigger id="signup-role">
                      <SelectValue placeholder="Select your role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="photographer">Photographer</SelectItem>
                      <SelectItem value="model">Model</SelectItem>
                      <SelectItem value="makeup-artist">Makeup Artist</SelectItem>
                      <SelectItem value="stylist">Stylist</SelectItem>
                      <SelectItem value="designer">Designer</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="signup-skills">Skills (comma-separated)</Label>
                  <Input
                    id="signup-skills"
                    value={signupForm.skills}
                    onChange={(e) => setSignupForm({ ...signupForm, skills: e.target.value })}
                    placeholder="e.g., Portrait Photography, Lighting, Posing"
                  />
                </div>

                <div>
                  <Label htmlFor="signup-current-project">Current Project</Label>
                  <Input
                    id="signup-current-project"
                    value={signupForm.currentProject}
                    onChange={(e) => setSignupForm({ ...signupForm, currentProject: e.target.value })}
                    placeholder="What are you working on right now?"
                  />
                </div>

                <div>
                  <Label htmlFor="signup-bio">Bio</Label>
                  <Textarea
                    id="signup-bio"
                    value={signupForm.bio}
                    onChange={(e) => setSignupForm({ ...signupForm, bio: e.target.value })}
                    placeholder="Tell us about yourself and your work..."
                  />
                </div>

                {signupError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
                    {signupError}
                  </p>
                )}

                <Button type="submit" className="w-full bg-violet-400 hover:bg-violet-500">
                  Sign Up
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
