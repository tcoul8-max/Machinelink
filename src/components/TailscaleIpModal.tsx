import React, { useState } from 'react';
import { getTailscaleIp, setTailscaleIp } from '../utils/offlineStore';
import { smartFetchApi, buildDirectUrl } from '../utils/apiClient';
import { Server, Edit3, Check, X, Globe, Activity, AlertTriangle, HelpCircle } from 'lucide-react';

interface TailscaleIpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onIpUpdated: (newIp: string) => void;
}

export const TailscaleIpModal: React.FC<TailscaleIpModalProps> = ({ isOpen, onClose, onIpUpdated }) => {
  const [ipInput, setIpInput] = useState<string>(getTailscaleIp());
  const [successMsg, setSuccessMsg] = useState<boolean>(false);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showGuide, setShowGuide] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    if (!ipInput.trim()) return;
    setIsTesting(true);
    setTestResult(null);

    const targetIp = ipInput.trim();

    try {
      const { res, data } = await smartFetchApi('/api/server-info', {}, targetIp);
      if (res.ok && data) {
        setTestResult({
          success: true,
          message: `Connected successfully to Tailscale Server Tower!\nNode ONLINE on port ${data.port || 3004}`
        });
      } else {
        setTestResult({
          success: false,
          message: `Connection attempt returned status ${res.status}`
        });
      }
    } catch (e: any) {
      const isHttps = window.location.protocol === 'https:';
      const isHttpTarget = targetIp.startsWith('http://');
      let isMixedContent = isHttps && isHttpTarget;

      let msg = `Connection Error:\n${e.message || 'Server connection unreachable'}`;
      if (isMixedContent) {
        msg += '\n\n⚠️ Mixed Content Block: HTTPS site (GitHub Pages) cannot fetch http:// resources directly. Use a Tailscale Serve / Funnel HTTPS URL (e.g. https://your-node.ts.net).';
      }

      setTestResult({
        success: false,
        message: msg
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ipInput.trim()) return;

    const formattedIp = ipInput.trim();
    setTailscaleIp(formattedIp);
    onIpUpdated(formattedIp);
    setSuccessMsg(true);

    setTimeout(() => {
      setSuccessMsg(false);
      onClose();
    }, 1200);
  };

  const applyPreset = (preset: string) => {
    setIpInput(preset);
    setTestResult(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-800 dark:border-slate-700 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md">
              <Server className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-white tracking-tight">
                TAILSCALE TOWER IP
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Configure target server node address
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-black uppercase text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-amber-500" />
                Tailscale Server IP or Public Tunnel URL
              </label>
              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                className="text-[11px] font-bold text-amber-500 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                {showGuide ? 'Hide Diagnostics' : 'Connection Guide'}
              </button>
            </div>

            <div className="relative">
              <input
                type="text"
                value={ipInput}
                onChange={e => {
                  setIpInput(e.target.value);
                  setTestResult(null);
                }}
                placeholder="e.g. 100.112.45.19 or 100.112.45.19:3004"
                className="w-full p-3 pl-10 pr-24 rounded-2xl border-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono font-black focus:ring-2 focus:ring-amber-500 focus:outline-none"
              />
              <Edit3 className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || !ipInput.trim()}
                className="absolute right-2 top-2 px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-amber-500 hover:text-slate-950 text-slate-800 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Activity className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
                {isTesting ? 'Testing...' : 'Test'}
              </button>
            </div>
          </div>

          {/* Test Result Feedback */}
          {testResult && (
            <div className={`p-3.5 rounded-2xl border ${
              testResult.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              <div className="flex items-start gap-2.5">
                {testResult.success ? (
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="whitespace-pre-wrap break-words font-sans text-xs font-semibold leading-relaxed max-h-60 overflow-y-auto w-full pr-1">
                  {testResult.message}
                </div>
              </div>
            </div>
          )}

          {/* Diagnostic Guide Accordion */}
          {showGuide && (
            <div className="p-4 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs space-y-2.5 text-slate-700 dark:text-slate-300">
              <p className="font-extrabold text-slate-900 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Why does 100.x.y.z time out in Cloud Preview?
              </p>
              <p className="text-[11px] leading-relaxed">
                Cloud hosted apps run in Google Cloud containers which are outside your private Tailscale network.
              </p>
              <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-slate-700 text-[11px]">
                <p className="font-bold text-slate-900 dark:text-white">To verify your server machine:</p>
                <ol className="list-decimal pl-4 space-y-1 font-mono text-[10.5px]">
                  <li>Run <span className="text-amber-400">pm2 status</span> on your server machine</li>
                  <li>Run <span className="text-amber-400">curl http://localhost:3004/api/server-info</span></li>
                  <li>Or test on phone: <span className="text-amber-400">http://100.112.45.19:3004/api/server-info</span></li>
                </ol>
              </div>
              <div className="pt-1.5 border-t border-slate-200 dark:border-slate-700 text-[11px]">
                <p className="font-bold text-slate-900 dark:text-white">To connect Cloud App directly:</p>
                <p className="text-[10.5px] font-mono text-amber-400">tailscale funnel 3004</p>
                <p className="text-[10px] text-slate-400">Use the generated https://...ts.net URL above!</p>
              </div>
            </div>
          )}

          {/* Presets */}
          <div className="space-y-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Quick IP Presets:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyPreset('100.112.45.19')}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-500/10 hover:border-amber-500/40 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-mono font-bold transition cursor-pointer"
              >
                100.112.45.19 (Default)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('100.112.45.19:3004')}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-amber-500/10 hover:border-amber-500/40 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-mono font-bold transition cursor-pointer"
              >
                100.112.45.19:3004 (PM2 Node)
              </button>
            </div>
          </div>

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs font-bold text-center flex items-center justify-center gap-2">
              <Check className="w-4 h-4 text-emerald-400" /> Tailscale IP Updated Successfully!
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Check className="w-4 h-4" /> Save IP
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

