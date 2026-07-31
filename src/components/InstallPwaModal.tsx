import React, { useState, useEffect } from 'react';
import { Download, Smartphone, Monitor, CheckCircle, X, Share, PlusSquare, ArrowRight } from 'lucide-react';

interface InstallPwaModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
  onInstallClick: () => void;
}

export const InstallPwaModal: React.FC<InstallPwaModalProps> = ({
  isOpen,
  onClose,
  deferredPrompt,
  onInstallClick
}) => {
  if (!isOpen) return null;

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="bg-slate-950 p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-base">Install MachineLink Web App</h3>
              <p className="text-xs text-slate-400">Instant offline access on phone, tablet or tablet screen</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {isStandalone ? (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3 text-emerald-400">
              <CheckCircle className="w-6 h-6 shrink-0" />
              <div>
                <p className="font-bold text-sm text-emerald-300">App Installed & Ready</p>
                <p className="text-xs text-emerald-400/80">You are running MachineLink in standalone Web App mode.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Feature Highlights */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col items-center text-center">
                  <Smartphone className="w-6 h-6 text-amber-400 mb-1.5" />
                  <span className="font-bold text-xs text-slate-200">1-Tap Home Screen</span>
                  <span className="text-[11px] text-slate-400">Launches full screen like a native app</span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col items-center text-center">
                  <Monitor className="w-6 h-6 text-amber-400 mb-1.5" />
                  <span className="font-bold text-xs text-slate-200">100% Offline Capable</span>
                  <span className="text-[11px] text-slate-400">Complete prestarts without mobile service</span>
                </div>
              </div>

              {/* Install Options */}
              {deferredPrompt ? (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center space-y-3">
                  <p className="text-xs text-amber-200 font-medium">
                    Your browser supports 1-click automatic installation!
                  </p>
                  <button
                    onClick={onInstallClick}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 transition cursor-pointer"
                  >
                    <Download className="w-4 h-4" /> Install MachineLink App Now
                  </button>
                </div>
              ) : isIOS ? (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">iOS / Safari Setup Instructions:</p>
                  <ol className="text-xs text-slate-300 space-y-2.5">
                    <li className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 font-bold flex items-center justify-center text-[11px] shrink-0">1</span>
                      <span>Tap the <Share className="w-3.5 h-3.5 inline text-sky-400 mx-1" /> <strong>Share</strong> button at bottom of Safari.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 font-bold flex items-center justify-center text-[11px] shrink-0">2</span>
                      <span>Scroll down and tap <PlusSquare className="w-3.5 h-3.5 inline text-slate-200 mx-1" /> <strong>Add to Home Screen</strong>.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 font-bold flex items-center justify-center text-[11px] shrink-0">3</span>
                      <span>Tap <strong>Add</strong> in the top right corner.</span>
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">Chrome / Android Setup Instructions:</p>
                  <ol className="text-xs text-slate-300 space-y-2.5">
                    <li className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 font-bold flex items-center justify-center text-[11px] shrink-0">1</span>
                      <span>Tap the <strong>3 dots menu (⋮)</strong> in upper right of browser.</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-amber-400 font-bold flex items-center justify-center text-[11px] shrink-0">2</span>
                      <span>Select <strong>Install app</strong> or <strong>Add to Home screen</strong>.</span>
                    </li>
                  </ol>
                </div>
              )}
            </>
          )}
        </div>

        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl text-xs transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
