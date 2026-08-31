"use client";

/**
 * Team wallet onboarding.
 *
 * Two paths:
 * 1. Sponsored account — we generate a fresh testnet keypair and friendbot
 *    it; teams keep the secret, we never store it. Animated step sequence.
 * 2. Freighter — teams that already have a wallet connect and share their
 *    public key only.
 *
 * Either way the team ends up with a valid Stellar address used as the
 * submission identity. Recording itself is sponsored by the event issuer,
 * so no XLM is required to get timestamped.
 */

import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useState } from "react";
import { getFreighterAddress } from "@/lib/freighter";

type Step = "idle" | "generating" | "funding" | "done" | "error";

export default function WalletOnboarding({
  onWallet,
}: {
  onWallet: (address: string) => void;
}) {
  const [mode, setMode] = useState<"sponsor" | "freighter">("sponsor");
  const [step, setStep] = useState<Step>("idle");
  const [account, setAccount] = useState<{
    publicKey: string;
    secret: string;
    note: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSponsored = useCallback(async () => {
    setError(null);
    setStep("generating");
    try {
      setStep("funding");
      const res = await fetch("/api/wallet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Wallet creation failed");
      setAccount(data);
      setStep("done");
      onWallet(data.publicKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("error");
    }
  }, [onWallet]);

  const connectFreighter = useCallback(async () => {
    setError(null);
    const { address, error } = await getFreighterAddress();
    if (error || !address) {
      setError(error ?? "Freighter connection failed.");
      return;
    }
    onWallet(address);
  }, [onWallet]);

  const copySecret = async () => {
    if (!account) return;
    await navigator.clipboard.writeText(account.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const steps = [
    { key: "generating", label: "Generate keypair" },
    { key: "funding", label: "Fund via friendbot (testnet)" },
    { key: "done", label: "Team wallet ready" },
  ];
  const stepIndex =
    step === "generating" ? 0 : step === "funding" ? 1 : step === "done" ? 2 : -1;

  return (
    <div className="card p-5">
      <div className="mb-4 flex gap-2" role="tablist" aria-label="Wallet options">
        <button
          role="tab"
          aria-selected={mode === "sponsor"}
          className={`btn text-xs ${mode === "sponsor" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setMode("sponsor")}
        >
          No wallet? Get a sponsored one
        </button>
        <button
          role="tab"
          aria-selected={mode === "freighter"}
          className={`btn text-xs ${mode === "freighter" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setMode("freighter")}
        >
          Connect Freighter
        </button>
      </div>

      {mode === "sponsor" && (
        <div>
          {step === "idle" && (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                We&apos;ll create a fresh testnet account for your team and fund
                it automatically. You keep the secret key; we never store it.
              </p>
              <button className="btn btn-primary" onClick={createSponsored}>
                Create sponsored wallet
              </button>
            </div>
          )}

          {(stepIndex >= 0 || step === "error") && (
            <ol className="space-y-2 text-sm" aria-live="polite">
              {steps.map((s, i) => {
                const state =
                  step === "error" && i >= stepIndex && stepIndex >= 0
                    ? "error"
                    : i < stepIndex
                      ? "done"
                      : i === stepIndex
                        ? "active"
                        : "todo";
                return (
                  <AnimatePresence key={s.key}>
                    <motion.li
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className="flex items-center gap-2"
                    >
                      <span
                        aria-hidden
                        className={`inline-block h-2 w-2 rounded-full ${
                          state === "done"
                            ? "bg-accent"
                            : state === "active"
                              ? "animate-pulse bg-accent-2"
                              : state === "error"
                                ? "bg-danger"
                                : "bg-line"
                        }`}
                      />
                      <span
                        className={
                          state === "todo" ? "text-muted" : "text-foreground"
                        }
                      >
                        {s.label}
                        {state === "active" && "…"}
                        {state === "done" && " ✓"}
                      </span>
                    </motion.li>
                  </AnimatePresence>
                );
              })}
            </ol>
          )}

          {step === "done" && account && (
            <div className="mt-4 space-y-3 rounded-lg border border-warn/40 bg-warn/5 p-4 text-sm">
              <p className="font-semibold text-warn">
                Save your team secret key now — it is shown only once.
              </p>
              <p className="mono break-all text-xs">{account.secret}</p>
              <button className="btn btn-ghost text-xs" onClick={copySecret}>
                {copied ? "Copied ✓" : "Copy secret key"}
              </button>
              <p className="text-xs text-muted">{account.note}</p>
            </div>
          )}
        </div>
      )}

      {mode === "freighter" && (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Connect your existing wallet via Freighter. Only your public key is
            shared — it becomes your team&apos;s submission identity.
          </p>
          <button className="btn btn-primary" onClick={connectFreighter}>
            Connect Freighter
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
