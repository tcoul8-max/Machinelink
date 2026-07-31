import { jsPDF } from 'jspdf';
import { JobDocket, DocketTemplateConfig } from '../types';
import { getSavedDocketTemplate } from '../data/defaultData';

export function generateDocketPDF(docket: JobDocket, config: DocketTemplateConfig = getSavedDocketTemplate()): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Header background banner
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(0, 0, pageWidth, 32, 'F');

  // Company Name & Details
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(config.companyName || 'CIVIL & EARTHMOVING CONTRACTORS', 14, 11, { maxWidth: pageWidth - 85 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const contactLine = [config.companyAbn, config.companyPhone, config.companyEmail].filter(Boolean).join('  |  ');
  doc.text(contactLine, 14, 18, { maxWidth: pageWidth - 85 });
  doc.text(config.companyAddress || '', 14, 23, { maxWidth: pageWidth - 85 });

  // Docket Title Pill (Right aligned)
  doc.setFillColor(234, 88, 12); // Orange 600
  doc.roundedRect(pageWidth - 65, 7, 51, 18, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('JOB DOCKET', pageWidth - 40, 14, { align: 'center' });
  doc.setFontSize(8.5);
  doc.text(`NO: ${docket.docketNumber}`, pageWidth - 40, 20, { align: 'center' });

  // Job Meta Box
  let y = 36;
  doc.setLineWidth(0.3);
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.roundedRect(14, y, pageWidth - 28, 42, 2, 2, 'FD');

  doc.setTextColor(15, 23, 42); // Slate 900
  doc.setFontSize(8.5);

  // Left column meta (X label = 18, X val = 58)
  const leftXLabel = 18;
  const leftXVal = 58;

  doc.setFont('helvetica', 'bold');
  doc.text('CLIENT / CONTRACTOR:', leftXLabel, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(docket.clientName || 'N/A', leftXVal, y + 8, { maxWidth: 52 });

  doc.setFont('helvetica', 'bold');
  doc.text('JOB SITE / LOCATION:', leftXLabel, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.text(docket.jobSite || 'N/A', leftXVal, y + 16, { maxWidth: 52 });

  doc.setFont('helvetica', 'bold');
  doc.text('PURCHASE ORDER NO:', leftXLabel, y + 24);
  doc.setFont('helvetica', 'normal');
  doc.text(docket.poNumber || 'N/A', leftXVal, y + 24, { maxWidth: 52 });

  doc.setFont('helvetica', 'bold');
  doc.text('OPERATOR / WORKER:', leftXLabel, y + 32);
  doc.setFont('helvetica', 'normal');
  doc.text(docket.workerName || 'N/A', leftXVal, y + 32, { maxWidth: 52 });

  // Right column meta (X label = 115, X val = 158)
  const rightXLabel = 115;
  const rightXVal = 158;

  doc.setFont('helvetica', 'bold');
  doc.text('DATE:', rightXLabel, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.text(docket.date || 'N/A', rightXVal, y + 8);

  doc.setFont('helvetica', 'bold');
  doc.text('MACHINE UNIT:', rightXLabel, y + 16);
  doc.setFont('helvetica', 'normal');
  doc.text(`${docket.machineCode || ''} - ${docket.machineName || ''}`, rightXVal, y + 16, { maxWidth: 36 });

  doc.setFont('helvetica', 'bold');
  doc.text('START / END HOURS:', rightXLabel, y + 24);
  doc.setFont('helvetica', 'normal');
  const startHrs = docket.startHours ?? docket.startHourMeter ?? 0;
  const endHrs = docket.endHours ?? docket.finishHourMeter ?? 0;
  doc.text(`${startHrs} hrs  →  ${endHrs} hrs`, rightXVal, y + 24);

  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL MACHINE HRS:', rightXLabel, y + 32);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(234, 88, 12);
  doc.text(`${docket.totalMachineHours ?? 0} Hours`, rightXVal, y + 32);

  // Line Items Table
  y += 48;
  doc.setFillColor(30, 41, 59);
  doc.rect(14, y, pageWidth - 28, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);

  doc.text('DESCRIPTION / ITEM', 18, y + 5.5);
  doc.text('TYPE', 95, y + 5.5);
  doc.text('QTY / HRS', 135, y + 5.5, { align: 'right' });
  doc.text('RATE ($)', 162, y + 5.5, { align: 'right' });
  doc.text('TOTAL ($)', pageWidth - 18, y + 5.5, { align: 'right' });

  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(15, 23, 42);

  if (docket.lineItems && docket.lineItems.length > 0) {
    docket.lineItems.forEach((item, index) => {
      const isEven = index % 2 === 0;
      if (isEven) {
        doc.setFillColor(241, 245, 249);
        doc.rect(14, y, pageWidth - 28, 7, 'F');
      }

      doc.text(item.description || 'General Machine Operation', 18, y + 4.8, { maxWidth: 72 });
      doc.text(item.itemType || 'Hours', 95, y + 4.8);
      doc.text((item.qtyOrHours || 0).toFixed(1), 135, y + 4.8, { align: 'right' });
      doc.text(`$${(item.unitRate || 0).toFixed(2)}`, 162, y + 4.8, { align: 'right' });
      doc.text(`$${(item.totalAmount || 0).toFixed(2)}`, pageWidth - 18, y + 4.8, { align: 'right' });

      y += 7;
    });
  } else {
    doc.setFillColor(241, 245, 249);
    doc.rect(14, y, pageWidth - 28, 7, 'F');
    doc.text('General Plant / Machine Operation', 18, y + 4.8);
    doc.text('Plant Hire', 95, y + 4.8);
    doc.text((docket.totalMachineHours || 0).toFixed(1), 135, y + 4.8, { align: 'right' });
    doc.text('$0.00', 162, y + 4.8, { align: 'right' });
    doc.text('$0.00', pageWidth - 18, y + 4.8, { align: 'right' });
    y += 7;
  }

  // Totals Box
  y += 3;
  doc.setDrawColor(203, 213, 225);
  doc.line(14, y, pageWidth - 14, y);
  y += 4;

  const totalXLabel = 115;
  const totalXVal = pageWidth - 18;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text('SUBTOTAL (EX. GST):', totalXLabel, y);
  doc.text(`$${(docket.subtotal || 0).toFixed(2)}`, totalXVal, y, { align: 'right' });

  y += 5;
  doc.text('GST (10%):', totalXLabel, y);
  doc.text(`$${(docket.gstAmount || 0).toFixed(2)}`, totalXVal, y, { align: 'right' });

  y += 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
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

  // Freehand Drawing Sketch Attachment
  if (docket.drawingDataUrl) {
    try {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text('SKETCH / ANNOTATION ATTACHMENT:', 14, y);
      y += 4;
      doc.addImage(docket.drawingDataUrl, 'PNG', 14, y, 65, 26);
      y += 28;
    } catch (e) {
      // ignore sketch embedding errors
    }
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
  doc.text(`Operator: ${docket.workerName || 'N/A'}`, 18, y + 11, { maxWidth: boxWidth - 8 });

  if (docket.operatorSignature) {
    try {
      doc.addImage(docket.operatorSignature, 'PNG', 18, y + 14, 45, 20);
    } catch (e) {
      doc.text('[ Signature Signed Digitally ]', 18, y + 20);
    }
  } else {
    doc.text('[ Pending Signature ]', 18, y + 20);
  }
  doc.text(`Signed: ${docket.date || ''}`, 18, y + 38);

  // Right Box - Client / Supervisor Signature
  const rightBoxX = 14 + boxWidth + 6;
  doc.roundedRect(rightBoxX, y, boxWidth, 42, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('CLIENT / SITE SUPERVISOR SIGN-OFF', rightBoxX + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Representative: ${docket.clientSignerName || docket.clientName || 'Site Representative'}`, rightBoxX + 4, y + 11, { maxWidth: boxWidth - 8 });

  if (docket.clientSignature) {
    try {
      doc.addImage(docket.clientSignature, 'PNG', rightBoxX + 4, y + 14, 45, 20);
    } catch (e) {
      doc.text('[ Signature Signed Digitally ]', rightBoxX + 4, y + 20);
    }
  } else {
    doc.text('[ Signed on Site ]', rightBoxX + 4, y + 20);
  }
  doc.text(`Date Confirmed: ${docket.date || ''}`, rightBoxX + 4, y + 38);

  // Footer / System Info Stamp
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text(
    `Generated via Field Management System | Node ID: 100.112.45.19 | Template: ${config.templateVersion || 'V2026.4'}`,
    14,
    288
  );

  return doc;
}
