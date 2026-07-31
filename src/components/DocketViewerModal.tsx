import React from 'react';
import { JobDocket } from '../types';
import { generateDocketPDF } from '../utils/pdfGenerator';
import { X, Download, FileText, Calendar, Building, User, Clock, DollarSign, CheckCircle2 } from 'lucide-react';

interface DocketViewerModalProps {
  docket: JobDocket | null;
  onClose: () => void;
}

export const DocketViewerModal: React.FC<DocketViewerModalProps> = ({ docket, onClose }) => {
  if (!docket) return null;

  const handleDownloadPDF = () => {
    const pdf = generateDocketPDF(docket);
    pdf.save(`${docket.docketNumber}.pdf`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white dark:bg-slate-900 border-2 border-slate-800 dark:border-slate-700 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 px-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shadow-md">
              <FileText className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white uppercase tracking-wider">
                  FILLED DOCKET RECORD
                </h2>
                <span className="font-mono text-xs font-black text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                  NO. {docket.docketNumber}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Client: <strong className="text-white">{docket.clientName}</strong> | Date: {docket.date}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition flex items-center gap-1.5 shadow-md cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body Scrollable */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-800 dark:text-slate-200">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">Job Site</span>
              <span className="font-extrabold text-slate-900 dark:text-white">{docket.jobSite}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">PO / Contract #</span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">{docket.poNumber || 'N/A'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">Operator</span>
              <span className="font-extrabold text-slate-900 dark:text-white">{docket.workerName}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">Machine Unit</span>
              <span className="font-mono font-bold text-amber-500">{docket.machineCode}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">Operating Hours</span>
              <span className="font-mono font-extrabold text-slate-900 dark:text-white">{docket.totalMachineHours} Hrs</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase block">Server Status</span>
              <span className={`inline-flex items-center gap-1 font-bold ${docket.synced ? 'text-emerald-500' : 'text-amber-500'}`}>
                <CheckCircle2 className="w-3 h-3" /> {docket.synced ? 'Synced to Server' : 'Pending Sync'}
              </span>
            </div>
          </div>

          {/* Shift / Hours Table Breakdown */}
          {(docket.startTime || docket.startHourMeter !== undefined) && (
            <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
              <div className="bg-slate-900 text-white px-4 py-2 font-black text-[11px] uppercase tracking-wider flex items-center justify-between">
                <span>Shift & Hour Meter Breakdown</span>
                <Clock className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-white dark:bg-slate-800 text-center text-[11px]">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Start Time</span>
                  <span className="font-mono font-extrabold">{docket.startTime || '06:30 AM'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Break</span>
                  <span className="font-mono font-extrabold">{docket.breakHours ?? 0.5} hrs</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Finish Time</span>
                  <span className="font-mono font-extrabold">{docket.finishTime || '05:00 PM'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Load Count</span>
                  <span className="font-mono font-black text-amber-500">{docket.loadCount ?? 'N/A'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Freehand Drawing Canvas Sketch Pad Output */}
          {docket.drawingDataUrl && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Freehand Drawing & Sketch Annotation Pad
              </span>
              <div className="border-2 border-slate-300 dark:border-slate-700 rounded-2xl p-2 bg-[#faf8f5] dark:bg-slate-950 flex items-center justify-center">
                <img
                  src={docket.drawingDataUrl}
                  alt="Freehand Docket Sketch Pad"
                  className="max-h-48 rounded-xl object-contain"
                />
              </div>
            </div>
          )}

          {/* Line Items Table */}
          {docket.lineItems && docket.lineItems.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Line Items & Billing
              </span>
              <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-black uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">Description</th>
                      <th className="p-2.5">Type</th>
                      <th className="p-2.5 text-right">Qty/Hrs</th>
                      <th className="p-2.5 text-right">Rate</th>
                      <th className="p-2.5 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {docket.lineItems.map((item, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-bold">{item.description}</td>
                        <td className="p-2.5 text-slate-500">{item.itemType}</td>
                        <td className="p-2.5 text-right font-mono">{item.qtyOrHours}</td>
                        <td className="p-2.5 text-right font-mono">${item.unitRate?.toFixed(2)}</td>
                        <td className="p-2.5 text-right font-mono font-bold">${item.totalAmount?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Totals Summary */}
          <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col sm:flex-row justify-between items-center gap-2">
            <span className="text-xs text-slate-400 font-bold">Total Billable Amount (Inc GST)</span>
            <span className="text-xl font-black font-mono text-amber-400">
              ${docket.totalIncGst?.toFixed(2)}
            </span>
          </div>

          {/* Shift Notes */}
          {docket.generalNotes && (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase block mb-1">
                Shift Notes & Works Executed
              </span>
              <p className="text-xs font-medium italic text-slate-800 dark:text-slate-200">
                "{docket.generalNotes}"
              </p>
            </div>
          )}

          {/* Dual Signatures Preview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {docket.operatorSignature && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1 text-center">
                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase block">
                  Operator Signature ({docket.workerName})
                </span>
                <img src={docket.operatorSignature} alt="Operator Signature" className="max-h-16 mx-auto object-contain" />
              </div>
            )}

            {docket.clientSignature && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-1 text-center">
                <span className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase block">
                  Supervisor Signature ({docket.clientSignerName || 'Supervisor'})
                </span>
                <img src={docket.clientSignature} alt="Supervisor Signature" className="max-h-16 mx-auto object-contain" />
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
