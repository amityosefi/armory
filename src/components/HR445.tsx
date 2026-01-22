import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { usePermissions } from '@/contexts/PermissionsContext';
import { PDFDocument, rgb } from 'pdf-lib';
import { Download } from 'lucide-react';
import StatusMessage from '@/components/feedbackFromBackendOrUser/StatusMessageProps';

interface HR446Data {
    id: number;
    first_name: string;
    last_name: string;
    personal_id: number;
    date: string;
    signature: string;
    date_filled: string;
}

interface HR445Props {
    selectedSheet: {
        range: string;
        name: string;
        id: number;
    };
}

const HR445: React.FC<HR445Props> = ({ selectedSheet }) => {
    const [data, setData] = useState<HR446Data[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState({ isSuccess: false, text: '', onClose: () => {} });
    const { permissions } = usePermissions();

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const { data: hr446Data, error } = await supabase
                .from('hr445')
                .select('*')
                .order('date_filled', { ascending: false });

            if (error) {
                console.error('Error fetching hr446 data:', error);
                setStatusMessage({
                    isSuccess: false,
                    text: 'שגיאה בטעינת הנתונים',
                    onClose: () => {}
                });
            } else {
                setData((hr446Data as unknown as HR446Data[]) || []);
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

    const handleDownloadPDF = async (item: HR446Data) => {
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
                <h2 className="text-2xl font-bold text-gray-800">טפסים 445 שהוגשו</h2>
                <p className="text-sm text-gray-600">סה"כ: {data.length} טפסים</p>
            </div>

            {data.length === 0 ? (
                <div className="text-center p-8 text-gray-500">
                    אין טפסים להצגה
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.map((item) => (
                        <div
                            key={item.id}
                            onClick={() => handleDownloadPDF(item)}
                            className="bg-white border-2 border-green-300 rounded-lg shadow-md p-4 cursor-pointer hover:bg-green-50 transition-colors"
                        >
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-lg font-bold text-green-800">
                                    {item.first_name} {item.last_name}
                                </h3>
                                <Download className="w-5 h-5 text-green-600" />
                            </div>
                            
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="font-semibold text-gray-700">מספר אישי:</span>
                                    <span className="text-gray-900">{item.personal_id.toString().padStart(7, '0')}</span>
                                </div>
                                
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
                    ))}
                </div>
            )}
        </div>
    );
};

export default HR445;
