// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Check, ShieldCheck, Zap, Sparkles, Building2, RefreshCw } from 'lucide-react';
import { SAMPLE_PRESETS } from '@/lib/resumeParser';

export interface CandidateAccount {
  name: string;
  email: string;
  role: string;
  company: string;
  presetId?: string;
}

const STORAGE_KEY = 'cadence_candidate_account';

export function getCandidateAccount(): CandidateAccount {
  if (typeof window === 'undefined') {
    return {
      name: '',
      email: '',
      role: '',
      company: '',
      presetId: ''
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    name: '',
    email: '',
    role: '',
    company: '',
    presetId: ''
  };
}

export function saveCandidateAccount(account: CandidateAccount) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
  }
}

export default function CandidateProfileModal({
  isOpen,
  onClose,
  onAccountUpdated
}: {
  isOpen: boolean;
  onClose: () => void;
  onAccountUpdated?: (account: CandidateAccount) => void;
}) {
  const [account, setAccount] = useState<CandidateAccount>(getCandidateAccount());
  const [savedNotice, setSavedNotice] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAccount(getCandidateAccount());
    }
  }, [isOpen]);

  const selectPreset = (presetId: string) => {
    const preset = SAMPLE_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    const updated: CandidateAccount = {
      name: preset.resume.candidateName,
      email: `${preset.resume.candidateName.toLowerCase().replace(' ', '.')}@enterprise.ai`,
      role: preset.resume.targetTitle,
      company: preset.jd.company,
      presetId
    };
    setAccount(updated);
    saveCandidateAccount(updated);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
    onAccountUpdated?.(updated);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveCandidateAccount(account);
    setSavedNotice(true);
    setTimeout(() => {
      setSavedNotice(false);
      onClose();
    }, 1200);
    onAccountUpdated?.(account);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-lg overflow-hidden rounded-3xl border border-line bg-white shadow-lift"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line bg-cream/40 px-6 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-terra text-white font-display font-bold text-sm">
                  {account.name.charAt(0)}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-ink">Candidate Account &amp; Profile</h3>
                  <p className="font-mono text-[10px] text-mut uppercase tracking-wider">Step 1: Identity &amp; Auth</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-1 text-ink2 hover:bg-cream hover:text-ink cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              {/* Fallback Engine Status Banner */}
              <div className="rounded-2xl border border-line bg-cream/50 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-sage font-bold flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-sage" /> Engine Status: Offline Fallback Active
                  </span>
                  <span className="chip !border-sagesoft !bg-sagesoft !text-sage font-mono !text-[9px]">
                    100% Operational
                  </span>
                </div>
                <p className="text-xs text-ink2 leading-relaxed">
                  No API key is required. The platform runs full 5-agent rubric scoring, STAR validation, resume-to-JD grounding, and acoustic telemetry through our local deterministic engine.
                </p>
              </div>

              {/* Persona Quick-Switch */}
              <div className="space-y-2">
                <p className="eyebrow">Switch Candidate Persona</p>
                <div className="grid grid-cols-3 gap-2">
                  {SAMPLE_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectPreset(p.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        account.presetId === p.id
                          ? 'border-terra bg-cream/70 ring-1 ring-terra'
                          : 'border-line bg-white hover:border-line2'
                      }`}
                    >
                      <p className="text-[11px] font-bold text-ink truncate">{p.resume.candidateName}</p>
                      <p className="text-[9px] text-mut truncate mt-0.5">{p.resume.targetTitle.split(' ')[0]} Architect</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Account Form */}
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-ink">Candidate Full Name</label>
                  <input
                    type="text"
                    value={account.name}
                    onChange={(e) => setAccount({ ...account, name: e.target.value })}
                    className="input-warm text-xs"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-ink">Email Address</label>
                  <input
                    type="email"
                    value={account.email}
                    onChange={(e) => setAccount({ ...account, email: e.target.value })}
                    className="input-warm text-xs"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-ink">Primary Role</label>
                    <input
                      type="text"
                      value={account.role}
                      onChange={(e) => setAccount({ ...account, role: e.target.value })}
                      className="input-warm text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-ink">Target Organization</label>
                    <input
                      type="text"
                      value={account.company}
                      onChange={(e) => setAccount({ ...account, company: e.target.value })}
                      className="input-warm text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-line">
                  {savedNotice ? (
                    <span className="text-xs font-semibold text-sage flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> Profile updated successfully!
                    </span>
                  ) : <span />}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="btn-ghost !text-xs cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn-terra !text-xs cursor-pointer"
                    >
                      Save Profile
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
