import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { usePermissions } from '@/contexts/PermissionsContext';
import { PDFDocument, rgb } from 'pdf-lib';
import { Download } from 'lucide-react';
import StatusMessage from '@/components/feedbackFromBackendOrUser/StatusMessageProps';

interface HR445Data {
    id: number;
    first_name: string;
    last_name: string;
    personal_id: number;
    date: string;
    signature: string;
    date_filled: string;
}

interface CommitteeRequestData {
    id: number;
    personalNumber: number;
    firstName: string;
    lastName: string;
    date: string;
    signature: string;
    date_filled: string;
}

interface MedicalWaiverData {
    id: number;
    personalNumber: number;
    idNumber: number;
    firstName: string;
    lastName: string;
    date: string;
    signature: string;
    date_filled: string;
}

type HRData = HR445Data | CommitteeRequestData | MedicalWaiverData;

interface HR445Props {
    selectedSheet: {
        range: string;
        name: string;
        id: number;
    };
}

const HrPermission: React.FC<HR445Props> = ({ selectedSheet }) => {
    const [data, setData] = useState<HRData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState({ isSuccess: false, text: '', onClose: () => {} });
    const { permissions } = usePermissions();

    useEffect(() => {
        fetchData();
    }, [selectedSheet.range]);

    const getTableName = () => {
        switch (selectedSheet.range) {
            case 'טופס445':
                return 'hr445';
            case 'ועדה ללא נוכחות':
                return 'hrCommitteeRequest';
            case 'סודיות רפואית':
                return 'hrMedicalWaiver';
            default:
                return 'hr445';
        }
    };

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const tableName = getTableName();
            const { data: hrData, error } = await supabase
                .from(tableName)
                .select('*')
                .order('date_filled', { ascending: false });

            if (error) {
                console.error(`Error fetching ${tableName} data:`, error);
                setStatusMessage({
                    isSuccess: false,
                    text: 'שגיאה בטעינת הנתונים',
                    onClose: () => {}
                });
            } else {
                setData((hrData as unknown as HRData[]) || []);
            }
        } catch (err) {
            console.error('Unexpected error:', err);
            setStatusMessage({
                isSuccess: false,
                text: 'שגיאה בלתי צפויה',
                onClose: () => {}
            });
        } finally {
            setIsLoading(false);
        }
    };

    const textToImage = (text: string, fontSize: number): string => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';

        canvas.width = 1200;
        canvas.height = 150;

        const adjustedFontSize = fontSize * 1.7;
        ctx.font = `bold ${adjustedFontSize}px Arial`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'black';

        ctx.fillText(text, canvas.width - 10, canvas.height / 2);

        return canvas.toDataURL('image/png');
    };

    const handleDownload445PDF = async (item: HR445Data) => {
        if (!permissions['hr']) {
            setStatusMessage({
                isSuccess: false,
                text: 'אין לך הרשאה להוריד קבצים',
                onClose: () => {}
            });
            return;
        }

        try {
            setStatusMessage({ isSuccess: false, text: '', onClose: () => {} });

            const pdfPath = `${import.meta.env.BASE_URL}446.pdf`;
            const response = await fetch(pdfPath);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch PDF: ${response.statusText}`);
            }
            
            const existingPdfBytes = await response.arrayBuffer();
            const pdfDoc = await PDFDocument.load(existingPdfBytes);

            const pages = pdfDoc.getPages();
            const lastPage = pages[pages.length - 1];

            const fontSize = 28;
            const personalIdStr = item.personal_id.toString().padStart(7, '0');
            const digits = personalIdStr.split('').reverse();
            const digitSpacing = 40;
            const startX = 1480;
            
            digits.forEach((digit, index) => {
                lastPage.drawText(digit, {
                    x: startX - (index * digitSpacing),
                    y: 2160,
                    size: fontSize,
                    color: rgb(0, 0, 0),
                });
            });

            const firstNameImageData = textToImage(item.first_name, fontSize);
            const firstNameImage = await pdfDoc.embedPng(firstNameImageData);
            const firstNameDims = firstNameImage.scale(0.5);
            
            lastPage.drawImage(firstNameImage, {
                x: -30,
                y: 2130,
                width: firstNameDims.width,
                height: firstNameDims.height,
            });

            const lastNameImageData = textToImage(item.last_name, fontSize);
            const lastNameImage = await pdfDoc.embedPng(lastNameImageData);
            const lastNameDims = lastNameImage.scale(0.5);
            
            lastPage.drawImage(lastNameImage, {
                x: 360,
                y: 2130,
                width: lastNameDims.width,
                height: lastNameDims.height,
            });

            lastPage.drawText(item.date, {
                x: 1400,
                y: 990,
                size: 24,
                color: rgb(0, 0, 0),
            });

            if (item.signature) {
                try {
                    const signatureImage = await pdfDoc.embedPng(item.signature);
                    
                    lastPage.drawImage(signatureImage, {
                        x: 280,
                        y: 1200,
                        width: 170,
                        height: 120,
                    });

                    lastPage.drawImage(signatureImage, {
                        x: 710,
                        y: 990,
                        width: 133,
                        height: 50,
                    });
                } catch (err) {
                    console.error('Error embedding signature:', err);
                }
            }

            const pdfBytes = await pdfDoc.save();

            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const fullName = `${item.first_name}_${item.last_name}`;
            link.download = `445_${fullName}.pdf`;
            link.click();
            URL.revokeObjectURL(url);

            setStatusMessage({
                isSuccess: true,
                text: 'הקובץ הורד בהצלחה',
                onClose: () => {}
            });

        } catch (error: any) {
            console.error('Error generating PDF:', error);
            setStatusMessage({
                isSuccess: false,
                text: `שגיאה ביצירת הקובץ: ${error.message}`,
                onClose: () => {}
            });
        }
    };

    const handleDownloadCommitteePDF = async (item: CommitteeRequestData) => {
        if (!permissions['hr']) {
            setStatusMessage({
                isSuccess: false,
                text: 'אין לך הרשאה להוריד קבצים',
                onClose: () => {}
            });
            return;
        }

        try {
            setStatusMessage({ isSuccess: false, text: '', onClose: () => {} });

            const pdfPath = `${import.meta.env.BASE_URL}committeeRequest.pdf`;
            const response = await fetch(pdfPath);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch PDF: ${response.statusText}`);
            }
            
            const existingPdfBytes = await response.arrayBuffer();
            const pdfDoc = await PDFDocument.load(existingPdfBytes);

            const pages = pdfDoc.getPages();
            const firstPage = pages[0];
            const fontSize = 20;

            const personal_width = 330;
            const personal_height = 120;
            const personal_y = 560;

            // Personal Number
            const personalDigits = item.personalNumber.toString().padStart(7, '0').split('').reverse();
            const digitSpacing = 10;
            const personalStartX = 430;
            
            personalDigits.forEach((digit, index) => {
                firstPage.drawText(digit, {
                    x: personalStartX - (index * digitSpacing),
                    y: personal_y + 50,
                    size: fontSize,
                    color: rgb(0, 0, 0),
                });
            });

            // First Name
            const firstNameImageData = textToImage(item.firstName, fontSize);
            const firstNameImage = await pdfDoc.embedPng(firstNameImageData);

            firstPage.drawImage(firstNameImage, {
                x: -105,
                y: personal_y + 1,
                width: personal_width,
                height: personal_height,
            });

            // Last Name
            const lastNameImageData = textToImage(item.lastName, fontSize);
            const lastNameImage = await pdfDoc.embedPng(lastNameImageData);

            firstPage.drawImage(lastNameImage, {
                x: -30,
                y: personal_y,
                width: personal_width,
                height: personal_height,
            });

            // Date
            const selectedDate = new Date(item.date);
            const day = String(selectedDate.getDate()).padStart(2, '0');
            const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const year = selectedDate.getFullYear();
            const formattedDate = `${day}.${month}.${year}`;
            
            const dateImageData = textToImage(formattedDate, fontSize);
            const dateImage = await pdfDoc.embedPng(dateImageData);
            
            firstPage.drawImage(dateImage, {
                x: 55,
                y: personal_y - 230,
                width: personal_width + 30,
                height: personal_height,
            });

            // Signature
            if (item.signature) {
                const signatureImageBytes = await fetch(item.signature).then(res => res.arrayBuffer());
                const signatureImage = await pdfDoc.embedPng(signatureImageBytes);

                firstPage.drawImage(signatureImage, {
                    x: 130,
                    y: personal_y - 180,
                    width: 90,
                    height: 35,
                });
            }

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `בקשה לועדה ללא נוכחות ${item.personalNumber.toString().padStart(7, '0')}.pdf`;
            link.click();
            URL.revokeObjectURL(url);

            setStatusMessage({
                isSuccess: true,
                text: 'הקובץ הורד בהצלחה',
                onClose: () => {}
            });

        } catch (error: any) {
            console.error('Error generating PDF:', error);
            setStatusMessage({
                isSuccess: false,
                text: `שגיאה ביצירת הקובץ: ${error.message}`,
                onClose: () => {}
            });
        }
    };

    const handleDownloadMedicalPDF = async (item: MedicalWaiverData) => {
        if (!permissions['hr']) {
            setStatusMessage({
                isSuccess: false,
                text: 'אין לך הרשאה להוריד קבצים',
                onClose: () => {}
            });
            return;
        }

        try {
            setStatusMessage({ isSuccess: false, text: '', onClose: () => {} });

            const pdfPath = `${import.meta.env.BASE_URL}medical.pdf`;
            const response = await fetch(pdfPath);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch PDF: ${response.statusText}`);
            }
            
            const existingPdfBytes = await response.arrayBuffer();
            const pdfDoc = await PDFDocument.load(existingPdfBytes);

            const pages = pdfDoc.getPages();
            const firstPage = pages[0];
            const fontSize = 20;

            const personal_width = 330;
            const personal_height = 120;
            const personal_y = 505;

            // Personal Number
            const personalDigits = item.personalNumber.toString().padStart(7, '0').split('').reverse();
            const digitSpacing = 9;
            const personalStartX = 444;

            personalDigits.forEach((digit, index) => {
                firstPage.drawText(digit, {
                    x: personalStartX - (index * digitSpacing),
                    y: personal_y + 47,
                    size: fontSize,
                    color: rgb(0, 0, 0),
                });
            });

            // ID Number
            const idDigits = item.idNumber.toString().padStart(9, '0').split('').reverse();
            const idStartX = 370;
            
            idDigits.forEach((digit, index) => {
                firstPage.drawText(digit, {
                    x: idStartX - (index * digitSpacing),
                    y: personal_y + 47,
                    size: fontSize,
                    color: rgb(0, 0, 0),
                });
            });

            // First Name
            const firstNameImageData = textToImage(item.firstName, fontSize);
            const firstNameImage = await pdfDoc.embedPng(firstNameImageData);

            firstPage.drawImage(firstNameImage, {
                x: -190,
                y: personal_y + 1,
                width: personal_width + 70,
                height: personal_height,
            });

            // Last Name
            const lastNameImageData = textToImage(item.lastName, fontSize);
            const lastNameImage = await pdfDoc.embedPng(lastNameImageData);

            firstPage.drawImage(lastNameImage, {
                x: -116,
                y: personal_y,
                width: personal_width + 70,
                height: personal_height,
            });

            // Date
            const selectedDate = new Date(item.date);
            const day = String(selectedDate.getDate()).padStart(2, '0');
            const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
            const year = selectedDate.getFullYear();
            const formattedDate = `${day}.${month}.${year}`;
            
            const dateImageData = textToImage(formattedDate, fontSize);
            const dateImage = await pdfDoc.embedPng(dateImageData);
            
            firstPage.drawImage(dateImage, {
                x: -10,
                y: personal_y - 45,
                width: personal_width + 70,
                height: personal_height,
            });

            // Signature
            if (item.signature) {
                const signatureImageBytes = await fetch(item.signature).then(res => res.arrayBuffer());
                const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
                
                firstPage.drawImage(signatureImage, {
                    x: 210,
                    y: personal_y + 10,
                    width: 80,
                    height: 20,
                });
            }

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `כתב ויתור על סודיות רפואית ${item.personalNumber.toString().padStart(7, '0')}.pdf`;
            link.click();
            URL.revokeObjectURL(url);

            setStatusMessage({
                isSuccess: true,
                text: 'הקובץ הורד בהצלחה',
                onClose: () => {}
            });

        } catch (error: any) {
            console.error('Error generating PDF:', error);
            setStatusMessage({
                isSuccess: false,
                text: `שגיאה ביצירת הקובץ: ${error.message}`,
                onClose: () => {}
            });
        }
    };

    const handleDownloadPDF = (item: HRData) => {
        switch (selectedSheet.range) {
            case 'טופס445':
                handleDownload445PDF(item as HR445Data);
                break;
            case 'ועדה ללא נוכחות':
                handleDownloadCommitteePDF(item as CommitteeRequestData);
                break;
            case 'סודיות רפואית':
                handleDownloadMedicalPDF(item as MedicalWaiverData);
                break;
            default:
                handleDownload445PDF(item as HR445Data);
        }
    };

    if (!permissions['hr']) {
        return (
            <div className="p-4 text-center text-red-600">
                אין לך הרשאה לצפות בדף זה
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="p-4" dir="rtl">
            {statusMessage.text && (
                <StatusMessage
                    isSuccess={statusMessage.isSuccess}
                    message={statusMessage.text}
                    onClose={() => setStatusMessage({ isSuccess: false, text: '', onClose: () => {} })}
                />
            )}

            <div className="mb-4">
                <h2 className="text-2xl font-bold text-gray-800">{selectedSheet.name} שהוגשו</h2>
                <p className="text-sm text-gray-600">סה"כ: {data.length} טפסים</p>
            </div>

            {data.length === 0 ? (
                <div className="text-center p-8 text-gray-500">
                    אין טפסים להצגה
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.map((item) => {
                        const is445 = selectedSheet.range === 'טופס445';
                        const firstName = is445 ? (item as HR445Data).first_name : (item as CommitteeRequestData | MedicalWaiverData).firstName;
                        const lastName = is445 ? (item as HR445Data).last_name : (item as CommitteeRequestData | MedicalWaiverData).lastName;
                        
                        let personalId = '';
                        if (is445) {
                            personalId = (item as HR445Data).personal_id?.toString().padStart(7, '0') || 'N/A';
                        } else {
                            const num = (item as CommitteeRequestData | MedicalWaiverData).personalNumber;
                            personalId = num ? num.toString().padStart(7, '0') : 'N/A';
                        }
                        
                        return (
                            <div
                                key={item.id}
                                onClick={() => handleDownloadPDF(item)}
                                className="bg-white border-2 border-green-300 rounded-lg shadow-md p-4 cursor-pointer hover:bg-green-50 transition-colors"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-lg font-bold text-green-800">
                                        {firstName} {lastName}
                                    </h3>
                                    <Download className="w-5 h-5 text-green-600" />
                                </div>
                                
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="font-semibold text-gray-700">מספר אישי:</span>
                                        <span className="text-gray-900">{personalId}</span>
                                    </div>
                                    
                                    {selectedSheet.range === 'סודיות רפואית' && (
                                        <div className="flex justify-between">
                                            <span className="font-semibold text-gray-700">תעודת זהות:</span>
                                            <span className="text-gray-900">
                                                {(item as MedicalWaiverData).idNumber ? (item as MedicalWaiverData).idNumber.toString().padStart(9, '0') : 'N/A'}
                                            </span>
                                        </div>
                                    )}
                                    
                                    <div className="flex justify-between">
                                        <span className="font-semibold text-gray-700">תאריך:</span>
                                        <span className="text-gray-900">{item.date}</span>
                                    </div>
                                    
                                    <div className="flex justify-between">
                                        <span className="font-semibold text-gray-700">תאריך מילוי:</span>
                                        <span className="text-gray-900 text-xs">{item.date_filled}</span>
                                    </div>
                                </div>

                                <div className="mt-3 pt-3 border-t border-gray-200">
                                    <div className="flex items-center justify-center gap-2 text-green-700 font-semibold">
                                        <Download className="w-4 h-4" />
                                        <span>לחץ להורדת PDF</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default HrPermission;
