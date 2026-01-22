import React, { useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SignatureCanvas from 'react-signature-canvas';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import StatusMessage from '@/components/feedbackFromBackendOrUser/StatusMessageProps';
import { Download, Trash2, ArrowLeft } from 'lucide-react';

const HR446Form: React.FC = () => {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [personalId, setPersonalId] = useState('');
    const [signature, setSignature] = useState('');
    const [statusMessage, setStatusMessage] = useState({ isSuccess: false, text: '', onClose: () => {} });
    const [isLoading, setIsLoading] = useState(false);
    
    const sigPadRef = useRef<SignatureCanvas>(null);

    // Get today's date in dd.mm.yyyy format
    const getTodayDate = () => {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        return `${day}.${month}.${year}`;
    };

    const saveSignature = () => {
        if (sigPadRef.current) {
            const dataUrl = sigPadRef.current.toDataURL();
            setSignature(dataUrl);
        }
    };

    // Helper function to convert text to image for Hebrew support
    const textToImage = (text: string, fontSize: number): string => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return '';

        // Set canvas size - larger for bigger text
        canvas.width = 1200;
        canvas.height = 150;

        // Set font and measure text - increased size and bold
        const adjustedFontSize = fontSize * 1.7; // 60% larger
        ctx.font = `bold ${adjustedFontSize}px Arial`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'black';

        // Draw text
        ctx.fillText(text, canvas.width - 10, canvas.height / 2);

        return canvas.toDataURL('image/png');
    };

    const clearSignature = () => {
        if (sigPadRef.current) {
            sigPadRef.current.clear();
            setSignature('');
        }
    };

    const handleDownloadPDF = async () => {
        // Validation
        if (!firstName || !lastName || !personalId || !signature) {
            setStatusMessage({
                isSuccess: false,
                text: 'נא למלא את כל השדות ולחתום',
                onClose: () => {}
            });
            return;
        }

        // Validate personal ID is exactly 7 digits
        if (!/^\d{7}$/.test(personalId)) {
            setStatusMessage({
                isSuccess: false,
                text: 'מספר אישי חייב להיות בדיוק 7 ספרות',
                onClose: () => {}
            });
            return;
        }

        try {
            setIsLoading(true);
            setStatusMessage({ isSuccess: false, text: '', onClose: () => {} });

            // Load the existing PDF
            const pdfPath = `${import.meta.env.BASE_URL}446.pdf`;
            const response = await fetch(pdfPath);
            
            if (!response.ok) {
                throw new Error(`Failed to fetch PDF: ${response.statusText}`);
            }
            
            const existingPdfBytes = await response.arrayBuffer();
            const pdfDoc = await PDFDocument.load(existingPdfBytes);

            // Get the last page
            const pages = pdfDoc.getPages();
            const lastPage = pages[pages.length - 1];
            const { height } = lastPage.getSize();

            // Get today's date
            const todayDate = getTodayDate();

            // Add text fields to the last page
            // Based on the new image layout - top row with personal ID, name, and date
            const fontSize = 28;
            const topRowY = 730; // Y position for top row (מספר אישי, שם, דרוגה)
            
            // מספר אישי (Personal ID) - split into individual digits for each cell and reverse
            const digits = personalId.split('').reverse();
            const digitSpacing = 40; // Space between each cell
            const startX = 1480; // Starting x position for the first digit
            
            digits.forEach((digit, index) => {
                lastPage.drawText(digit, {
                    x: startX - (index * digitSpacing),
                    y: 2160,
                    size: fontSize,
                    color: rgb(0, 0, 0), // Black color
                });
            });

            // שם פרטי (First Name) - center left
            const firstNameImageData = textToImage(firstName, fontSize);
            const firstNameImage = await pdfDoc.embedPng(firstNameImageData);
            const firstNameDims = firstNameImage.scale(0.5);
            
            lastPage.drawImage(firstNameImage, {
                x: -30,
                y: 2130,
                width: firstNameDims.width,
                height: firstNameDims.height,
            });

            // שם משפחה (Last Name) - next to first name
            const lastNameImageData = textToImage(lastName, fontSize);
            const lastNameImage = await pdfDoc.embedPng(lastNameImageData);
            const lastNameDims = lastNameImage.scale(0.5);
            
            lastPage.drawImage(lastNameImage, {
                x: 360,
                y: 2130,
                width: lastNameDims.width,
                height: lastNameDims.height,
            });

            // תאריך (Date) - bottom right
            lastPage.drawText(todayDate, {
                x: 1400,
                y: 990,
                size: 24,
                color: rgb(0, 0, 0), // Black color
            });

            // Add signature images - two locations
            if (signature) {
                try {
                    const signatureImage = await pdfDoc.embedPng(signature);
                    
                    // Signature 1 - middle left (חתימת החייל)
                    const sig1Dims = signatureImage.scale(0.8);
                    lastPage.drawImage(signatureImage, {
                        x: 280,
                        y: 1200,
                        width: 170,
                        height: 120,
                    }
                    );

                    // Signature 2 - bottom left (תאריך + חתימת החייל)
                    const sig2Dims = signatureImage.scale(0.6);
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

            // Save the modified PDF
            const pdfBytes = await pdfDoc.save();

            // Download the PDF
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const fullName = `${firstName}_${lastName}`;
            link.download = `445_${fullName}.pdf`;
            link.click();
            URL.revokeObjectURL(url);

            setStatusMessage({
                isSuccess: true,
                text: 'הקובץ הורד בהצלחה',
                onClose: () => {}
            });

            // Save to Supabase after download
            await saveToSupabase();

        } catch (error: any) {
            console.error('Error generating PDF:', error);
            setStatusMessage({
                isSuccess: false,
                text: `שגיאה ביצירת הקובץ: ${error.message}`,
                onClose: () => {}
            });
        } finally {
            setIsLoading(false);
        }
    };

    const saveToSupabase = async () => {
        try {
            const { error } = await supabase
                .from('hr446')
                .insert([{
                    first_name: firstName,
                    last_name: lastName,
                    personal_id: parseInt(personalId, 10),
                    date: getTodayDate(),
                    signature: signature,
                    date_filled: new Date().toLocaleString('he-IL')
                }]);

            if (error) {
                console.error('Error saving to Supabase:', error);
            }
        } catch (err: any) {
            console.error('Unexpected error saving to Supabase:', err);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-100" dir="rtl">
            {/* Green Header */}
            <div className="bg-green-500 text-white py-4 md:py-6 px-4 relative">
                <a
                    href="/armory/"
                    className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-200 text-xs md:text-sm underline"
                >
                    ← חזור
                </a>
                <h1 className="text-xl md:text-3xl font-bold text-center">
                    טופס 445 📝
                </h1>
            </div>

            <div className="max-w-lg mx-auto p-3 md:p-6">
                <div className="bg-white rounded-lg shadow-lg p-4 md:p-6">
                    {statusMessage.text && (
                        <StatusMessage
                            isSuccess={statusMessage.isSuccess}
                            message={statusMessage.text}
                            onClose={() => setStatusMessage({isSuccess: false, text: '', onClose: () => {} })}
                        />
                    )}

                    <br/>

                    <div className="space-y-6">
                        {/* First Name */}
                        <div>
                            <Label htmlFor="firstName" className="text-right block mb-2 font-semibold">
                                שם פרטי *
                            </Label>
                            <Input
                                id="firstName"
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="text-right"
                                placeholder="הכנס שם פרטי"
                            />
                        </div>

                        {/* Last Name */}
                        <div>
                            <Label htmlFor="lastName" className="text-right block mb-2 font-semibold">
                                שם משפחה *
                            </Label>
                            <Input
                                id="lastName"
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="text-right"
                                placeholder="הכנס שם משפחה"
                            />
                        </div>

                        {/* Personal ID */}
                        <div>
                            <Label htmlFor="personalId" className="text-right block mb-2 font-semibold">
                                מספר אישי *
                            </Label>
                            <Input
                                id="personalId"
                                type="text"
                                inputMode="numeric"
                                value={personalId}
                                onChange={(e) => {
                                    const value = e.target.value.replace(/\D/g, '').slice(0, 7);
                                    setPersonalId(value);
                                }}
                                className="text-right"
                                placeholder="הכנס מספר אישי (7 ספרות)"
                                maxLength={7}
                            />
                            <p className="text-xs text-gray-500 text-right mt-1">
                                * מספר אישי חייב להיות בדיוק 7 ספרות
                            </p>
                        </div>

                        {/* Date (read-only) */}
                        <div>
                            <Label htmlFor="date" className="text-right block mb-2 font-semibold">
                                תאריך
                            </Label>
                            <div className="text-right p-3 bg-gray-100 rounded-md border border-gray-300">
                                <span className="text-gray-700">{getTodayDate()}</span>
                            </div>
                        </div>

                        {/* Signature Canvas */}
                        <div>
                            <Label className="text-right block mb-2 font-semibold">
                                חתימה דיגיטלית ✍️ *
                            </Label>
                        <div className="border-2 border-gray-300 rounded-lg p-2 bg-white">
                            <div className="w-full">
                                <SignatureCanvas
                                    ref={sigPadRef}
                                    penColor="black"
                                    onEnd={saveSignature}
                                    canvasProps={{
                                        width: typeof window !== 'undefined' && window.innerWidth < 640 ? Math.min(window.innerWidth - 180, 400) : 400,
                                        height: 160,
                                        className: 'border border-gray-200 rounded mx-auto',
                                        style: { direction: 'ltr', display: 'block', maxWidth: '100%' }
                                    }}
                                    clearOnResize={false}
                                    backgroundColor="white"
                                />
                            </div>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={clearSignature}
                            className="w-full mt-2 flex items-center justify-center gap-2"
                        >
                            נקה חתימה
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>

                        {/* Download Button */}
                        <Button
                            onClick={handleDownloadPDF}
                            disabled={isLoading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 text-base md:text-lg rounded-lg flex items-center justify-center gap-2"
                        >
                            {isLoading ? 'מייצר קובץ...' : 'הורד טופס'}
                            <Download className="w-5 h-5" />

                        </Button>

                        {/* Back Button */}
                        <Button
                            onClick={() => window.location.href = '/armory/'}
                            variant="outline"
                            className="w-full mt-3 flex items-center justify-center gap-2"
                        >
                            חזור
                            <ArrowLeft className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HR446Form;
