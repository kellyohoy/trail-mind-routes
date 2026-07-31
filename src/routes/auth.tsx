import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Compass, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — TrailMind AI Route Planner" },
      {
        name: "description",
        content:
          "Sign in to TrailMind AI with Google or Apple to save your planned MTB and adventure moto routes and open them again later.",
      },
      { property: "og:title", content: "Sign in — TrailMind AI" },
      {
        property: "og:description",
        content: "Save and revisit your planned trail routes with a TrailMind AI account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function oauth(provider: "google" | "apple") {
    setBusy(provider);
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(null);
      toast.error(result.error.message ?? "Sign-in failed");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/", replace: true });
  }

  async function withEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy("email");
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Check your email to confirm your account.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 topo-grid">
      <div className="w-full max-w-sm rounded-sm border border-border bg-card p-6">
        <div className="flex items-center gap-2">
          <Compass className="size-5 text-primary" />
          <h1 className="font-display text-lg font-semibold">TrailMind AI</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to save routes and open them on any device.
        </p>

        <div className="mt-5 space-y-2">
          <button
            onClick={() => oauth("google")}
            disabled={!!busy}
            className="flex w-full items-center justify-center gap-2 rounded-sm border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary disabled:opacity-50"
          >
            {busy === "google" ? <Loader2 className="size-4 animate-spin" /> : null}
            Continue with Google
          </button>
          <button
            onClick={() => oauth("apple")}
            disabled={!!busy}
            className="flex w-full items-center justify-center gap-2 rounded-sm border border-border px-4 py-2.5 text-sm font-medium transition-colors hover:border-primary disabled:opacity-50"
          >
            {busy === "apple" ? <Loader2 className="size-4 animate-spin" /> : null}
            Continue with Apple
          </button>
        </div>

        <div className="my-5 flex items-center gap-3 text-[11px] tracking-widest text-muted-foreground uppercase">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={withEmail} className="space-y-2">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-sm border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
          />
          <button
            type="submit"
            disabled={!!busy}
            className="flex w-full items-center justify-center gap-2 rounded-sm bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy === "email" ? <Loader2 className="size-4 animate-spin" /> : null}
            {mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "No account? Sign up" : "Already have an account? Sign in"}
        </button>

        <Link
          to="/"
          className="mt-4 block text-center text-xs text-muted-foreground hover:text-accent"
        >
          Back to the map
        </Link>
      </div>
    </main>
  );
}
