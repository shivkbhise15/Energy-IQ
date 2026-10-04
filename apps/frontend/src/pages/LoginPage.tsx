import { FormEvent, useState } from "react";
import { Gauge, LockKeyhole, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/use-auth-store";

export function LoginPage() {
  const navigate = useNavigate();
  const signIn = useAuthStore((state) => state.signIn);
  const [email, setEmail] = useState("superadmin@energyiq.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await signIn(email, password);
      navigate("/", { replace: true });
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to sign in"); }
    finally { setIsSubmitting(false); }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-lg border border-border bg-panel p-8 shadow-soft">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Gauge className="h-5 w-5" /></div>
          <div><p className="text-lg font-semibold">EnergyIQ</p><p className="text-sm text-muted-foreground">Operations Command</p></div>
        </div>
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">Connect to your energy operations workspace.</p>
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium">Email<div className="relative mt-2"><Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input className="h-10 w-full rounded-lg border border-border bg-background pl-10 pr-3 outline-none focus:ring-2 focus:ring-primary" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></div></label>
          <label className="block text-sm font-medium">Password<div className="relative mt-2"><LockKeyhole className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input className="h-10 w-full rounded-lg border border-border bg-background pl-10 pr-3 outline-none focus:ring-2 focus:ring-primary" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div></label>
          {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
          <Button className="w-full" variant="primary" type="submit" disabled={isSubmitting}>{isSubmitting ? "Connecting..." : "Sign in"}</Button>
        </form>
      </section>
    </main>
  );
}
