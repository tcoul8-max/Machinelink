import { jsPDF } from 'jspdf';
import { JobDocket, DocketTemplateConfig } from '../types';
import { DEFAULT_DOCKET_TEMPLATE } from '../data/defaultData';

export function generateDocketPDF(docket: JobDocket, config: DocketTemplateConfig = DEFAULT_DOCKET_TEMPLATE): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header background banner
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(0, 0, pageWidth, 32, 'F');

  // Company Name & Logo Text
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(config.companyName, 14, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`${config.companyAbn} | ${config.companyPhone} | ${config.companyEmail}`, 14, 18);
  doc.text(config.companyAddress, 14, 23);

  // Docket Title Pill (Right aligned)
  doc.setFillColor(234, 88, 12); // Orange 600
  doc.roundedRect(pageWidth - 65, 8, 51, 16, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('JOB DOCKET', pageWidth - 40, 15, { align: 'center' });
  doc.setFontSize(8);
  doc.text(`NO: ${docket.docketNumber}`, pageWidth - 40, 21, { align: 'center' });

  // Job Meta Box
  let y = 38;
  doc.setLineWidth(0.3);
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.roundedRect(14, y, pageWidth - 28, 38, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42); // Slate 900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);

  // Left column meta
  doc.text('CLIENT / CONTRACTOR:', 18, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(docket.clientName || 'N/A', 56, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.text('JOB SITE / LOCATION:', 18, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.text(docket.jobSite || 'N/A', 56, y + 14);

  doc.setFont('helvetica', 'bold');
  doc.text('PURCHASE ORDER NO:', 18, y + 21);
  doc.setFont('helvetica', 'normal');
  doc.text(docket.poNumber || 'N/A', 56, y + 21);

  doc.setFont('helvetica', 'bold');
  doc.text('OPERATOR / WORKER:', 18, y + 28);
  doc.setFont('helvetica', 'normal');
  doc.text(docket.workerName || 'N/A', 56, y + 28);

  // Right column meta
  const rightX = 118;
  doc.setFont('helvetica', 'bold');
  doc.text('DATE:', rightX, y + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(docket.date || 'N/A', rightX + 30, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.text('MACHINE UNIT:', rightX, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.text(`${docket.machineCode} - ${docket.machineName}`, rightX + 30, y + 14);

  doc.setFont('helvetica', 'bold');
  doc.text('START / END HOURS:', rightX, y + 21);
  doc.setFont('helvetica', 'normal');
  doc.text(`${docket.startHours} hrs -> ${docket.endHours} hrs`, rightX + 30, y + 21);

  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL MACHINE HRS:', rightX, y + 28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(234, 88, 12);
  doc.text(`${docket.totalMachineHours} Hours`, rightX + 30, y + 28);

  // Line Items Table
  y += 44;
  doc.setFillColor(30, 41, 59);
  doc.rect(14, y, pageWidth - 28, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);

  doc.text('DESCRIPTION / ITEM', 18, y + 5.5);
  doc.text('TYPE', 98, y + 5.5);
  doc.text('QTY / HRS', 132, y + 5.5, { align: 'right' });
  doc.text('RATE ($)', 160, y + 5.5, { align: 'right' });
  doc.text('TOTAL ($)', pageWidth - 18, y + 5.5, { align: 'right' });

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);

  docket.lineItems.forEach((item, index) => {
    const isEven = index % 2 === 0;
    if (isEven) {
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y, pageWidth - 28, 7, 'F');
    }

    doc.text(item.description || 'General Machine Operation', 18, y + 4.8);
    doc.text(item.itemType, 98, y + 4.8);
    doc.text((item.qtyOrHours || 0).toFixed(1), 132, y + 4.8, { align: 'right' });
    doc.text(`$${(item.unitRate || 0).toFixed(2)}`, 160, y + 4.8, { align: 'right' });
    doc.text(`$${(item.totalAmount || 0).toFixed(2)}`, pageWidth - 18, y + 4.8, { align: 'right' });

    y += 7;
  });

  // Totals Box
  y += 3;
  doc.setDrawColor(203, 213, 225);
  doc.line(14, y, pageWidth - 14, y);
  y += 4;

  const totalXLabel = pageWidth - 65;
  const totalXVal = pageWidth - 18;

  doc.setFont('helvetica', 'normal');
  doc.text('SUBTOTAL (EX. GST):', totalXLabel, y);
  doc.text(`$${(docket.subtotal || 0).toFixed(2)}`, totalXVal, y, { align: 'right' });

  y += 5;
  doc.text('GST (10%):', totalXLabel, y);
  doc.text(`$${(docket.gstAmount || 0).toFixed(2)}`, totalXVal, y, { align: 'right' });

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(234, 88, 12);
  doc.text('TOTAL DOCKET AMOUNT:', totalXLabel, y);
  doc.text(`$${(docket.totalIncGst || 0).toFixed(2)}`, totalXVal, y, { align: 'right' });

  // General Notes section
  y += 10;
  if (docket.generalNotes) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    doc.text('WORK DETAILS / NOTES:', 14, y);
    y += 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const splitNotes = doc.splitTextToSize(docket.generalNotes, pageWidth - 28);
    doc.text(splitNotes, 14, y);
    y += splitNotes.length * 4 + 4;
  }

  // Signatures Section
  y = Math.max(y + 6, 215);
  doc.setDrawColor(203, 213, 225);
  doc.setFillColor(248, 250, 252);
  
  // Left Box - Operator Signature
  const boxWidth = (pageWidth - 34) / 2;
  doc.roundedRect(14, y, boxWidth, 42, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('PLANT OPERATOR SIGNATURE', 18, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Operator: ${docket.workerName}`, 18, y + 11);

  if (docket.operatorSignature) {
    try {
      doc.addImage(docket.operatorSignature, 'PNG', 18, y + 14, 45, 20);
    } catch (e) {
      doc.text('[ Signature Signed Digitally ]', 18, y + 20);
    }
  } else {
    doc.text('[ Pending Signature ]', 18, y + 20);
  }
  doc.text(`Signed: ${docket.date}`, 18, y + 38);

  // Right Box - Client / Supervisor Signature
  const rightBoxX = 14 + boxWidth + 6;
  doc.roundedRect(rightBoxX, y, boxWidth, 42, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('CLIENT / SITE SUPERVISOR SIGN-OFF', rightBoxX + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Representative: ${docket.clientSignerName || docket.clientName || 'Site Representative'}`, rightBoxX + 4, y + 11);

  if (docket.clientSignature) {
    try {
      doc.addImage(docket.clientSignature, 'PNG', rightBoxX + 4, y + 14, 45, 20);
    } catch (e) {
      doc.text('[ Signature Signed Digitally ]', rightBoxX + 4, y + 20);
    }
  } else {
    doc.text('[ Signed on Site ]', rightBoxX + 4, y + 20);
  }
  doc.text(`Date Confirmed: ${docket.date}`, rightBoxX + 4, y + 38);

  // Footer / Tailscale Server Tower Stamp
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text(
    `Tailscale Tower Sync Node: 100.112.45.19 | Generated via APEX Field System | Template: ${config.templateVersion}`,
    14,
    288
  );

  return doc;
}
