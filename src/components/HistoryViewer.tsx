import React, { useState, useEffect } from 'react';
import { PrestartSubmission, JobDocket } from '../types';
import { getOfflinePrestarts, getOfflineDockets } from '../utils/offlineStore';
import { generateDocketPDF } from '../utils/pdfGenerator';
import { DocketViewerModal } from './DocketViewerModal';
import { History, ClipboardCheck, FileText, Download, CheckCircle2, AlertTriangle, XCircle, Search, Filter, Eye } from 'lucide-react';

export const HistoryViewer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'prestarts' | 'dockets'>('prestarts');
  const [prestarts, setPrestarts] = useState<PrestartSubmission[]>([]);
  const [dockets, setDockets] = useState<JobDocket[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedDocket, setSelectedDocket] = useState<JobDocket | null>(null);

  const reloadData = () => {
    setPrestarts(getOfflinePrestarts());
    setDockets(getOfflineDockets());
  };

  useEffect(() => {
    reloadData();
    window.addEventListener('sync-completed', reloadData);
    return () => window.removeEventListener('sync-completed', reloadData);
  }, []);

  const filteredPrestarts = prestarts.filter(p =>
    p.machineCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.workerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.date.includes(searchTerm)
  );

  const filteredDockets = dockets.filter(d =>
    d.docketNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.machineCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header & Search */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2.5 tracking-tight">
            <History className="w-5 h-5 text-amber-500" />
            Field Records & Submission History
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Local queue & server synchronized prestarts and job dockets logged on this device.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search machine, worker, docket #..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-3">
        <button
          onClick={() => setActiveTab('prestarts')}
          className={`pb-3.5 px-5 text-xs font-black transition border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'prestarts'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          Prestart Checks ({prestarts.length})
        </button>

        <button
          onClick={() => setActiveTab('dockets')}
          className={`pb-3.5 px-5 text-xs font-black transition border-b-2 flex items-center gap-2 cursor-pointer ${
            activeTab === 'dockets'
              ? 'border-amber-500 text-amber-500'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Job Dockets ({dockets.length})
        </button>
      </div>

      {/* Content 1: Prestarts List */}
      {activeTab === 'prestarts' && (
        <div className="space-y-3">
          {filteredPrestarts.map(p => {
            const hasIssues = p.overallStatus !== 'SAFE_TO_OPERATE';
            return (
              <div
                key={p.id}
                className={`bg-white dark:bg-slate-900 p-5 rounded-3xl border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                  hasIssues
                    ? 'border-rose-500/40 dark:border-rose-500/30 bg-rose-500/[0.02]'
                    : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start sm:items-center gap-3">
                  {/* Small Red Issue Icon / Green Check at start of row */}
                  {hasIssues ? (
                    <div
                      className="p-1.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex-shrink-0 mt-0.5 sm:mt-0 shadow-sm"
                      title="Machine Has Issues / Defects Reported"
                    >
                      <AlertTriangle className="w-4 h-4 fill-rose-500/20 stroke-[2.5]" />
                    </div>
                  ) : (
                    <div className="p-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex-shrink-0 mt-0.5 sm:mt-0">
                      <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                    </div>
                  )}

                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-black text-amber-500 text-sm">
                        {p.machineCode}
                      </span>
                      <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                        {p.machineName}
                      </span>
                      {hasIssues && (
                        <span className="text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full font-black">
                          DEFECT
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex flex-wrap items-center gap-4">
                      <span>Operator: <strong className="text-slate-800 dark:text-slate-200">{p.workerName}</strong></span>
                      <span>Date: <strong>{p.date}</strong></span>
                      <span>Hours: <strong className="font-mono">{p.engineHours} hrs</strong></span>
                    </div>
                  </div>
                </div>

              <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                {p.overallStatus === 'SAFE_TO_OPERATE' && (
                  <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> SAFE TO OPERATE
                  </span>
                )}
                {p.overallStatus === 'DEFECT_REPORTED' && (
                  <span className="px-3 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black border border-amber-500/20 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> DEFECT REPORTED
                  </span>
                )}
                {p.overallStatus === 'UNSAFE_OUT_OF_SERVICE' && (
                  <span className="px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-black border border-rose-500/20 flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> OUT OF SERVICE
                  </span>
                )}

                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  p.synced
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-300 dark:border-emerald-800'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 border-amber-300 dark:border-amber-800 animate-pulse'
                }`}>
                  {p.synced ? 'Synced to Server' : 'Pending Offline'}
                </span>
              </div>
            </div>
            );
          })}

          {filteredPrestarts.length === 0 && (
            <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-xs font-medium">
              No prestart inspection logs found.
            </div>
          )}
        </div>
      )}

      {/* Content 2: Dockets List */}
      {activeTab === 'dockets' && (
        <div className="space-y-3">
          {filteredDockets.map(d => (
            <div
              key={d.id}
              className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-black text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                    {d.docketNumber}
                  </span>
                  <span className="text-xs font-black text-slate-900 dark:text-white">{d.clientName}</span>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex flex-wrap items-center gap-4">
                  <span>Site: <strong className="text-slate-800 dark:text-slate-200">{d.jobSite}</strong></span>
                  <span>Machine: <strong>{d.machineCode} ({d.totalMachineHours} hrs)</strong></span>
                  <span>Date: {d.date}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                  ${d.totalIncGst?.toFixed(2)}
                </span>

                <button
                  onClick={() => setSelectedDocket(d)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 text-slate-950 hover:bg-amber-400 text-xs font-black transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" /> Open Docket
                </button>

                <button
                  onClick={() => {
                    const pdf = generateDocketPDF(d);
                    pdf.save(`${d.docketNumber}.pdf`);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" /> PDF
                </button>

                <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                  d.synced
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-300 dark:border-emerald-800'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 border-amber-300 dark:border-amber-800 animate-pulse'
                }`}>
                  {d.synced ? 'Synced' : 'Pending Offline'}
                </span>
              </div>
            </div>
          ))}

          {filteredDockets.length === 0 && (
            <div className="p-12 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-xs font-medium">
              No job dockets found.
            </div>
          )}
        </div>
      )}

      {/* Docket Inspector Modal */}
      <DocketViewerModal
        docket={selectedDocket}
        onClose={() => setSelectedDocket(null)}
      />
    </div>
  );
};
