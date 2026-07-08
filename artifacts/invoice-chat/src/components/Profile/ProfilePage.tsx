import { useState } from "react";

import { changeProfilePassword, updateProfileEmail } from "../../api/client";
import type { UserProfile } from "../../types";

function errorMessage(data: unknown): string {
  if (typeof data !== "object" || data === null) return "Request failed";
  const record = data as Record<string, unknown>;
  const detail = record.detail;
  if (Array.isArray(detail)) return detail.map(String).join("\n");
  if (typeof detail === "string") return detail;
  if (typeof record.message === "string") return record.message;
  if (typeof record.error === "string") return record.error;
  return "Request failed";
}

export function ProfilePage({
  user,
  onBack,
  onUserUpdated,
}: {
  user: UserProfile;
  onBack: () => void;
  onUserUpdated: (user: UserProfile) => void;
}) {
  const [email, setEmail] = useState(user.email);
  const [emailPassword, setEmailPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [emailStatus, setEmailStatus] = useState<string | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);
  const [submittingEmail, setSubmittingEmail] = useState(false);
  const [submittingPassword, setSubmittingPassword] = useState(false);

  const submitEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingEmail) return;

    setSubmittingEmail(true);
    setEmailStatus(null);
    try {
      const result = await updateProfileEmail({ current_password: emailPassword, new_email: email });
      if (!result.ok) {
        setEmailStatus(errorMessage(result.data));
        return;
      }
      onUserUpdated(result.data);
      setEmailPassword("");
      setEmailStatus("Email updated.");
    } catch (err) {
      setEmailStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingEmail(false);
    }
  };

  const submitPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingPassword) return;

    setSubmittingPassword(true);
    setPasswordStatus(null);
    try {
      const result = await changeProfilePassword({ current_password: currentPassword, new_password: newPassword });
      if (!result.ok) {
        setPasswordStatus(errorMessage(result.data));
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setPasswordStatus("Password changed. Other active sessions were revoked.");
    } catch (err) {
      setPasswordStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card shadow-sm">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Profile</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
          </div>
          <button
            onClick={onBack}
            className="text-xs px-3 py-1.5 rounded-lg border border-border bg-secondary hover:bg-accent transition-colors"
          >
            Back to chat
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <section className="bg-card border border-border rounded-2xl shadow-sm p-5">
          <h2 className="text-base font-semibold text-foreground">Account</h2>
          <div className="mt-3 text-sm text-muted-foreground space-y-1">
            <div>User ID: <span className="font-mono">{user.id}</span></div>
            <div>Email: {user.email}</div>
            {user.display_name && <div>Name: {user.display_name}</div>}
          </div>
        </section>

        <section className="bg-card border border-border rounded-2xl shadow-sm p-5">
          <h2 className="text-base font-semibold text-foreground">Change email</h2>
          <p className="text-sm text-muted-foreground mt-1">Enter your current password to confirm the email change.</p>
          <form onSubmit={submitEmail} className="mt-4 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-foreground">New email</span>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                type="email"
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-foreground">Current password</span>
              <input
                value={emailPassword}
                onChange={(event) => setEmailPassword(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            {emailStatus && <div className="text-sm text-muted-foreground whitespace-pre-line">{emailStatus}</div>}
            <button
              type="submit"
              disabled={submittingEmail}
              className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {submittingEmail ? "Saving…" : "Update email"}
            </button>
          </form>
        </section>

        <section className="bg-card border border-border rounded-2xl shadow-sm p-5">
          <h2 className="text-base font-semibold text-foreground">Change password</h2>
          <p className="text-sm text-muted-foreground mt-1">Changing password revokes other active sessions.</p>
          <form onSubmit={submitPassword} className="mt-4 space-y-4">
            <label className="block">
              <span className="text-sm font-medium text-foreground">Current password</span>
              <input
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-foreground">New password</span>
              <input
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={256}
              />
              <span className="block text-xs text-muted-foreground mt-1">Min 8 chars with uppercase, lowercase, number, and special character.</span>
            </label>
            {passwordStatus && <div className="text-sm text-muted-foreground whitespace-pre-line">{passwordStatus}</div>}
            <button
              type="submit"
              disabled={submittingPassword}
              className="rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {submittingPassword ? "Saving…" : "Change password"}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
