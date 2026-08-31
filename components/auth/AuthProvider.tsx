"use client";

/**
 * Wallet-based identity. The wallet address IS the login:
 * connect Freighter or generate a sponsored testnet keypair, then attach
 * profile details (name, organization, location, bio) as either a team or
 * an organizer. On-chain organizer authority still comes exclusively from
 * the event-registry contract — profiles are display/UX data.
 */

import { motion, AnimatePresence } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Avatar from "@/components/Avatar";
import { getFreighterAddress } from "@/lib/freighter";

export interface ProfileView {
  wallet: string;
  role: "team" | "organizer";
  name: string | null;
  organization: string | null;
  location: string | null;
  bio: string | null;
}

interface AuthContextValue {
  wallet: string | null;
  profile: ProfileView | null;
  eventsOrganized: string[];
  modalOpen: boolean;
  openConnect: (preferredRole?: "team" | "organizer") => void;
  closeConnect: () => void;
  disconnect: () => void;
  saveProfile: (fields: Omit<ProfileView, "wallet">) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

type ModalStep = "method" | "secret" | "profile";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem("notari-wallet"),
  );
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [eventsOrganized, setEventsOrganized] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [step, setStep] = useState<ModalStep>("method");
  const [preferredRole, setPreferredRole] = useState<"team" | "organizer">("team");
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    name: "",
    organization: "",
    location: "",
    bio: "",
    role: "team" as "team" | "organizer",
  });

  const fetchProfile = useCallback(async (w: string) => {
    try {
      const res = await fetch(`/api/profile?wallet=${w}`);
      if (!res.ok) return;
      const d = await res.json();
      setProfile(d.profile ?? null);
      setEventsOrganized(d.events_organized ?? []);
      if (d.profile) {
        setForm({
          name: d.profile.name ?? "",
          organization: d.profile.organization ?? "",
          location: d.profile.location ?? "",
          bio: d.profile.bio ?? "",
          role: d.profile.role === "organizer" ? "organizer" : "team",
        });
      }
    } catch {
      // profile is optional UX data; never block the wallet flow
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch, setState happens post-await
    if (wallet) fetchProfile(wallet);
  }, [wallet, fetchProfile]);

  const adoptWallet = useCallback(
    (w: string, role: "team" | "organizer") => {
      setWallet(w);
      localStorage.setItem("notari-wallet", w);
      localStorage.setItem("notari-organizer", w); // dashboard convenience
      setForm((f) => ({ ...f, role }));
      fetchProfile(w);
    },
    [fetchProfile],
  );

  const openConnect = useCallback((role: "team" | "organizer" = "team") => {
    setPreferredRole(role);
    setError(null);
    setStep("method");
    setModalOpen(true);
  }, []);

  const closeConnect = useCallback(() => setModalOpen(false), []);

  const connectFreighter = useCallback(async () => {
    setBusy(true);
    setError(null);
    const { address, error: err } = await getFreighterAddress();
    setBusy(false);
    if (err || !address) {
      setError(err ?? "Freighter connection failed.");
      return;
    }
    adoptWallet(address, preferredRole);
    setStep("profile");
  }, [adoptWallet, preferredRole]);

  const generateSponsored = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Wallet creation failed");
      setSecret(d.secret);
      adoptWallet(d.publicKey, preferredRole);
      setStep("secret");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [adoptWallet, preferredRole]);

  const saveProfile = useCallback(
    async (fields: Omit<ProfileView, "wallet">) => {
      if (!wallet) throw new Error("No wallet connected");
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet, ...fields }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? "Could not save profile");
      setProfile(d.profile);
      await fetchProfile(wallet);
    },
    [wallet, fetchProfile],
  );

  const submitProfile = async () => {
    setBusy(true);
    setError(null);
    try {
      await saveProfile(form);
      setModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = useCallback(() => {
    setWallet(null);
    setProfile(null);
    setEventsOrganized([]);
    localStorage.removeItem("notari-wallet");
    localStorage.removeItem("notari-organizer");
  }, []);

  const value = useMemo(
    () => ({
      wallet,
      profile,
      eventsOrganized,
      modalOpen,
      openConnect,
      closeConnect,
      disconnect,
      saveProfile,
    }),
    [wallet, profile, eventsOrganized, modalOpen, openConnect, closeConnect, disconnect, saveProfile],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeConnect}
          >
            <motion.div
              className="card w-full max-w-md p-6"
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Connect wallet"
            >
              <AnimatePresence mode="wait">
                {step === "method" && (
                  <motion.div key="method" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <h2 className="text-lg font-semibold">
                      {preferredRole === "organizer" ? "Connect as organizer" : "Connect your wallet"}
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      Your wallet address is your identity. Add your details
                      after connecting — teams and organizers both get profiles.
                    </p>
                    <div className="mt-5 space-y-3">
                      <button className="btn btn-primary w-full" onClick={connectFreighter} disabled={busy}>
                        {busy ? "Waiting for Freighter…" : "Connect Freighter"}
                      </button>
                      <button className="btn btn-ghost w-full" onClick={generateSponsored} disabled={busy}>
                        {busy ? "Creating…" : "No wallet — generate a sponsored one"}
                      </button>
                    </div>
                    {wallet && (
                      <button
                        className="mt-4 w-full text-center text-xs text-muted underline"
                        onClick={() => {
                          setStep("profile");
                        }}
                      >
                        Already connected as {wallet.slice(0, 8)}… — edit profile
                      </button>
                    )}
                  </motion.div>
                )}

                {step === "secret" && secret && (
                  <motion.div key="secret" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <h2 className="text-lg font-semibold text-warn">Save your secret key</h2>
                    <p className="mt-1 text-sm text-muted">
                      Shown once — we never store it. Anyone with this key
                      controls the address.
                    </p>
                    <p className="mono mt-3 break-all rounded border border-warn/40 bg-warn/5 p-3 text-xs">{secret}</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        className="btn btn-ghost text-xs"
                        onClick={async () => {
                          await navigator.clipboard.writeText(secret);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 1500);
                        }}
                      >
                        {copied ? "Copied ✓" : "Copy"}
                      </button>
                      <button className="btn btn-primary text-xs" onClick={() => setStep("profile")}>
                        I saved it — continue →
                      </button>
                    </div>
                  </motion.div>
                )}

                {step === "profile" && wallet && (
                  <motion.div key="profile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <h2 className="text-lg font-semibold">Your details</h2>
                    <p className="mono mt-1 break-all text-xs text-muted">{wallet}</p>
                    <div className="mt-4 space-y-3">
                      <div className="flex gap-2" role="radiogroup" aria-label="Role">
                        {(["team", "organizer"] as const).map((r) => (
                          <button
                            key={r}
                            role="radio"
                            aria-checked={form.role === r}
                            className={`btn flex-1 text-xs ${form.role === r ? "btn-primary" : "btn-ghost"}`}
                            onClick={() => setForm((f) => ({ ...f, role: r }))}
                          >
                            {r === "team" ? "Team / participant" : "Organizer"}
                          </button>
                        ))}
                      </div>
                      <input className="input" placeholder="Full name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} aria-label="Full name" />
                      <input className="input" placeholder={form.role === "organizer" ? "Community / organization (e.g. FIEM ACM)" : "Team or college"} value={form.organization} onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))} aria-label="Organization" />
                      <input className="input" placeholder="Location (e.g. Kolkata, IN)" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} aria-label="Location" />
                      <textarea className="input min-h-20" placeholder={form.role === "organizer" ? "What do you run? (events, community size…)" : "One line about your team"} value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))} aria-label="Bio" />
                    </div>
                    <button className="btn btn-primary mt-4 w-full" onClick={submitProfile} disabled={busy}>
                      {busy ? "Saving…" : "Save profile"}
                    </button>
                    <button className="mt-2 w-full text-center text-xs text-muted underline" onClick={closeConnect}>
                      Skip for now
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthContext.Provider>
  );
}

/** Header widget: connect button or profile chip with menu. */
export function AuthChip() {
  const { wallet, profile, eventsOrganized, openConnect, disconnect } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!wallet) {
    return (
      <button className="btn btn-ghost px-3 py-1.5 text-xs" onClick={() => openConnect("team")}>
        Connect wallet
      </button>
    );
  }

  const label = profile?.name || `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
  const badge =
    eventsOrganized.length > 0 ? "organizer" : profile?.role ?? "team";

  return (
    <div className="relative">
      <button
        className="flex items-center gap-2 rounded-full border border-line bg-panel px-2.5 py-1.5 text-xs transition-colors hover:border-accent-2"
        onClick={() => setMenuOpen((o) => !o)}
        aria-expanded={menuOpen}
        aria-label="Account menu"
      >
        <Avatar wallet={wallet} size={20} />
        <span className="max-w-28 truncate font-medium">{label}</span>
        <span className="rounded bg-line px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted">{badge}</span>
      </button>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="card absolute right-0 top-full z-50 mt-2 w-64 p-4"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            <div className="flex items-center gap-3">
              <Avatar wallet={wallet} size={36} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{profile?.name ?? "Unnamed"}</p>
                <p className="mono truncate text-[10px] text-muted">{wallet}</p>
              </div>
            </div>
            {(profile?.location || profile?.organization) && (
              <p className="mt-2 text-xs text-muted">
                {profile?.organization}
                {profile?.organization && profile?.location ? " · " : ""}
                {profile?.location}
              </p>
            )}
            {eventsOrganized.length > 0 && (
              <p className="mt-2 text-[11px] text-accent">
                Organizes: {eventsOrganized.join(", ")}
              </p>
            )}
            <div className="mt-3 flex gap-2">
              <button className="btn btn-ghost flex-1 text-xs" onClick={() => { setMenuOpen(false); openConnect(profile?.role ?? "team"); }}>
                Edit profile
              </button>
              <button className="btn btn-danger flex-1 text-xs" onClick={() => { setMenuOpen(false); disconnect(); }}>
                Disconnect
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
