import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import '@/fonts/NotoSansHebrew-normal';
import logoImg from '@/assets/logo.jpeg';

interface Person {
    id: number;
    name: string;
    phone: string;
    location: string;
}

interface ArmoryItem {
    id: number;
    kind: string;
    location: string | number;
    is_save: boolean;
    name: string;
    people_sign?: string;
    sign_time?: string;
    logistic_sign?: string;
    logistic_name?: string;
    logistic_id?: string | number;
}

// Helper function to mirror Hebrew text for proper PDF display
const mirrorHebrew = (str: string): string => {
    if (!str) return '';
    return [...str].reverse().join('');
};

// Smart Hebrew mirroring that handles mixed content
const mirrorHebrewSmart = (str: string): string => {
    if (!str) return '';

    const words = str.trim().split(/\s+/);

    // Check if all words are Hebrew
    const allHebrew = words.every(word =>
        [...word].every(char => /[\u0590-\u05FF"״׳]/.test(char))
    );

    const transformedWords = words.map(word => {
        const isHebrew = [...word].every(char => /[\u0590-\u05FF"״׳]/.test(char));
        return isHebrew ? [...word].reverse().join('') : word;
    });

    // Reverse word order only if all words are Hebrew
    const finalWords = allHebrew ? transformedWords.reverse() : transformedWords;

    return finalWords.join(' ');
};

// Helper function to add a soldier page to an existing PDF document
const addSoldierPageToPDF = (doc: jsPDF, soldier: Person, armoryItems: ArmoryItem[], isFirstPage: boolean = false) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 30;
    let y = 10;

    // Track the starting page for this soldier
    const startingPage = doc.getNumberOfPages();

    // Add Hebrew font
    doc.addFont('NotoSansHebrew-normal.ttf', 'NotoSansHebrew', 'normal');
    doc.setFont('NotoSansHebrew');
    doc.setFontSize(12);

    // Add logo on the left side
    try {
        doc.addImage(logoImg, 'JPEG', margin, y, 20, 20);
    } catch (error) {
        console.error('Error adding logo to PDF:', error);
    }

    // Title
    doc.setFontSize(18);
    doc.text(mirrorHebrew('טופס חתימת חייל גדוד 8101.'), pageWidth / 2, y + 10, {align: 'center'});
    y += 30;

    // Soldier Information
    const dateStr = new Date().toLocaleString('he-IL').split(' ');
    doc.setFontSize(10);
    doc.text(dateStr[0] + ' ' + dateStr[1], pageWidth - margin, y, {align: 'right'});

    // Get sign time from weapon item
    const weaponItem = armoryItems.find(item => item.kind === 'נשק');

    y += 15;

    // Notes section
    const notes = [
        'הנני מצהיר/ה כי ביצעתי מטווח יום + לילה בסוג הנשק הנ״ל שעליו אני חותם.',
        'הנני בקיא בהפעלתו ובהוראות הבטיחות בנושא אחזקת הנשק כולל שימוש במק פורק.',
        'הנשק יוחזר לנשקייה נקי ומשומן - ואחת לחודש יבצע בדיקת נשק.',
        'החייל/ת ביצע/ה בוחן לנשק אישי ובוחן למק פורק.',
        'הנשק ינופק באישור השלישות.',
    ];

    doc.setFontSize(12);
    notes.forEach((line, i) => {
        doc.text(`${mirrorHebrew(line)} •`, pageWidth - margin, y + i * 8, {align: 'right'});
    });

    y += 40;

    // Group items by kind
    const groupedItems: { [key: string]: ArmoryItem[] } = {};
    armoryItems.forEach(item => {
        if (item.kind) {
            if (!groupedItems[item.kind]) {
                groupedItems[item.kind] = [];
            }
            groupedItems[item.kind].push(item);
        }
    });

    // Create a table for each kind
    Object.entries(groupedItems).forEach(([kind, items]) => {
        // Check if we need a new page
        if (y > 220) {
            doc.addPage();
            y = 20;
        }

        // Kind header - centered above table
        doc.setFontSize(14);
        const tableWidth = 90;
        doc.text(mirrorHebrewSmart(kind), pageWidth / 2, y, {align: 'right'});
        doc.setFont('NotoSansHebrew', 'normal');
        y += 10;

        // Items for this kind
        const isWeaponTable = kind === 'נשק';
        const kvPairs = items.map(item => {
            const row = isWeaponTable ? [
                item.sign_time || '',
                mirrorHebrewSmart(item.id.toString()),
                mirrorHebrewSmart(item.name)
            ] : [
                mirrorHebrewSmart(item.id.toString()),
                mirrorHebrewSmart(item.name)
            ];
            return row;
        });

        const headers = isWeaponTable ? 
            [mirrorHebrewSmart('תאריך חתימה'), mirrorHebrewSmart('מסד'), mirrorHebrewSmart('אמצעי')] :
            [mirrorHebrewSmart('מסד'), mirrorHebrewSmart('אמצעי')];

        const adjustedTableWidth = isWeaponTable ? 140 : tableWidth;
        const adjustedTableX = (pageWidth - adjustedTableWidth) / 2;

        autoTable(doc, {
            startY: y,
            body: [headers, ...kvPairs],
            styles: {
                font: 'NotoSansHebrew',
                halign: 'right',
                cellWidth: 'wrap'
            },
            columnStyles: isWeaponTable ? {
                0: {cellWidth: 50},  // תאריך חתימה column (left)
                1: {cellWidth: 30},  // מסד column
                2: {cellWidth: 60}   // אמצעי column
            } : {
                0: {cellWidth: 30},  // מסד column
                1: {cellWidth: 60}   // אמצעי column
            },
            margin: {
                left: adjustedTableX,
                right: pageWidth - adjustedTableX - adjustedTableWidth
            },
            tableWidth: adjustedTableWidth
        });

        // @ts-ignore
        y = doc.lastAutoTable.finalY + 15;
    });

    // Footer with signatures - only for pages added during this function call
    const endingPage = doc.getNumberOfPages();
    const pageHeight = doc.internal.pageSize.getHeight();

    for (let i = startingPage; i <= endingPage; i++) {
        doc.setPage(i);
        doc.setFontSize(10);

        const footerY = pageHeight - 60; // Moved higher from -30 to -60

        // Define signature Y position (same for both sides)
        const signatureY = footerY + 32;

        // Right side - Logistics (only show if there's data)
        if (weaponItem?.logistic_name || weaponItem?.logistic_id || weaponItem?.logistic_sign) {
            doc.text(mirrorHebrew('מחלקת לוגיסטיקה'), pageWidth - margin, footerY, {align: 'right'});

            let logisticsY = footerY + 7;

            if (weaponItem?.logistic_name) {
                doc.text(mirrorHebrew(weaponItem.logistic_name), pageWidth - margin, logisticsY, {align: 'right'});
                logisticsY += 7;
            }

            if (weaponItem?.logistic_id) {
                doc.text(weaponItem.logistic_id.toString(), pageWidth - margin, logisticsY, {align: 'right'});
                logisticsY += 7;
            }

            if (weaponItem?.logistic_sign) {
                // Add logistics signature image if available (bigger size) - aligned with soldier signature
                try {
                    doc.addImage(weaponItem.logistic_sign, 'PNG', pageWidth - margin - 50, signatureY, 45, 25);
                } catch (e) {
                    doc.text('_______________', pageWidth - margin, signatureY + 3, {align: 'right'});
                }
            }
        }

        // Left side - Soldier
        doc.text(mirrorHebrew(soldier.location) + ' ' + mirrorHebrewSmart('פלוגה'), margin, footerY, {align: 'left'});
        doc.text(mirrorHebrew(soldier.name), margin, footerY + 7, {align: 'left'});

        // Add soldier ID
        doc.text(soldier.id.toString(), margin, footerY + 14, {align: 'left'});
        
        // Add soldier phone
        doc.text(soldier.phone, margin, footerY + 21, {align: 'left'});

        if (weaponItem?.people_sign) {
            // Add soldier signature image if available (bigger size) - aligned with logistics signature
            try {
                doc.addImage(weaponItem.people_sign, 'PNG', margin, signatureY-10, 45, 25);
            } catch (e) {
                doc.text('_______________', margin, signatureY, {align: 'left'});
            }
        }
    }

};

// Export single soldier PDF
export const exportSoldierPDF = (soldier: Person, armoryItems: ArmoryItem[]) => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    addSoldierPageToPDF(doc, soldier, armoryItems, true);

    // Save the PDF
    doc.save(`${soldier.name}_${soldier.id}_${soldier.location}.pdf`);
};

// Export multiple soldiers in one PDF
export const exportMultipleSoldiersPDF = (
    soldiers: Array<{ soldier: Person, items: ArmoryItem[] }>,
    filename: string = 'soldiers.pdf'
) => {
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });

    soldiers.forEach((soldierData, index) => {
        if (index > 0) {
            doc.addPage();
        }
        addSoldierPageToPDF(doc, soldierData.soldier, soldierData.items, index === 0);
    });

    // Save the PDF
    doc.save(filename);
};
