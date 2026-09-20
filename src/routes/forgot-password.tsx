import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MailCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { passwordResetRedirectUrl } from "@/lib/app-url";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot Password — D4EXAM" },
      {
        name: "description",
        content: "Request a secure password reset link for your D4EXAM account.",
      },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Enter a valid email address.");
      return;
    }
    setLoading(true);
    try {
      const redirectTo = passwordResetRedirectUrl();
      const { error: authError } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo,
      });
      if (authError) {
        // Do not reveal whether the email exists — still show success UX for security,
        // unless the provider returns a clear rate-limit / config error.
        const msg = (authError.message || "").toLowerCase();
        if (msg.includes("rate") || msg.includes("redirect") || msg.includes("url")) {
          setError(authError.message);
          return;
        }
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col px-4 py-8 sm:px-8">
      <Link to="/" aria-label="D4EXAM home" className="self-start">
        <Logo size="md" />
      </Link>
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <div className="surface-panel p-6 sm:p-8">
          <h1 className="text-2xl font-bold">Forgot your password?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the email on your D4EXAM account. We will send a secure reset link that opens on
            d4exam.name.ng.
          </p>

          {sent ? (
            <Alert className="mt-6 border-primary/30 bg-primary/10">
              <MailCheck className="h-4 w-4 text-primary" />
              <AlertTitle>Check your email</AlertTitle>
              <AlertDescription>
                If an account exists for that address, a reset link has been sent. The link expires
                after a short time. Check spam if you do not see it.
              </AlertDescription>
            </Alert>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={(e) => void onSubmit(e)}>
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@school.edu"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
              {error ? (
                <p className="text-sm font-medium text-red-600" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending…
                  </>
                ) : (
                  "Send reset link"
                )}
              </Button>
            </form>
          )}

          <div className="mt-6 flex items-center justify-between text-sm">
            <Link to="/login" className="font-medium text-primary hover:underline">
              Back to login
            </Link>
            <Link to="/support" className="text-muted-foreground hover:text-foreground">
              Contact support
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
