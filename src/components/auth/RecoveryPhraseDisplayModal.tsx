import React, { useState } from 'react';
import { KeyRound, Copy, Check, Download, AlertTriangle, ShieldCheck } from 'lucide-react';

interface RecoveryPhraseDisplayModalProps {
  recoveryPhrase: string;
  onConfirm: () => void;
}

export const RecoveryPhraseDisplayModal: React.FC<RecoveryPhraseDisplayModalProps> = ({
  recoveryPhrase,
  onConfirm,
}) => {
  const [hasCopied, setHasCopied] = useState(false);
  const [hasConfirmedStorage, setHasConfirmedStorage] = useState(false);

  const words = recoveryPhrase.split(' ');

  const handleCopy = () => {
    navigator.clipboard.writeText(recoveryPhrase);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 2500);
  };

  const handleDownload = () => {
    const element = document.createElement('a');
    const file = new Blob(
      [
        `COVE ACCOUNT RECOVERY MASTER KEY\n` +
        `==================================\n\n` +
        `Keep this file private and offline. If you ever forget your Cove password, this 16-word key is the ONLY way to recover your account.\n\n` +
        `Your 16-Word Recovery Key:\n${recoveryPhrase}\n\n` +
        `Generated: ${new Date().toISOString()}\n`
      ],
      { type: 'text/plain' }
    );
    element.href = URL.createObjectURL(file);
    element.download = `cove-recovery-key-${Date.now()}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 font-display">
              Your 16-Word Recovery Key
            </h2>
            <p className="text-xs text-slate-500">
              Save this key now. It is your only way to recover account access.
            </p>
          </div>
        </div>

        <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl mb-5 flex items-start gap-2.5 text-xs text-amber-800 leading-relaxed">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          <span>
            Cove uses client-controlled cryptography. We never store your recovery key in plaintext.
            If you lose your password and this key, your account cannot be recovered.
          </span>
        </div>

        {/* 16 Words Grid */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {words.map((word, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 bg-white px-2.5 py-1.5 rounded-lg border border-slate-200/80 text-xs shadow-2xs font-mono"
              >
                <span className="text-slate-400 select-none text-[10px] w-4 text-right">
                  {idx + 1}.
                </span>
                <span className="font-semibold text-slate-800">{word}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
            >
              {hasCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Copied to clipboard</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Key</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download (.txt)</span>
            </button>
          </div>
        </div>

        <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50/50 cursor-pointer select-none mb-6">
          <input
            type="checkbox"
            checked={hasConfirmedStorage}
            onChange={(e) => setHasConfirmedStorage(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded text-[#2D5AFF] focus:ring-[#2D5AFF] border-slate-300"
          />
          <span className="text-xs text-slate-700 font-medium leading-relaxed">
            I have securely copied or saved my 16-word recovery key in a private place.
          </span>
        </label>

        <button
          type="button"
          disabled={!hasConfirmedStorage}
          onClick={onConfirm}
          className="w-full h-11 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-[#2D5AFF] hover:bg-[#2448cc] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#2D5AFF] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Confirm & Proceed</span>
        </button>
      </div>
    </div>
  );
};
