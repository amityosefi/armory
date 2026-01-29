import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabaseClient';
import { PDFDocument, rgb } from 'pdf-lib';
import SignatureCanvas from 'react-signature-canvas';

interface FormData {
    personalNumber: string;
    idNumber: string;
    firstName: string;
    lastName: string;
    date: string;
    signature: string;
}

const MedicalWaiverForm: React.FC = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState<FormData>({
        personalNumber: '',
        idNumber: '',
        firstName: '',
        lastName: '',
        date: new Date().toISOString().split('T')[0],
        signature: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState({ text: '', isSuccess: false });
    const sigPadRef = useRef<SignatureCanvas>(null);

    const handleInputChange = (field: keyof FormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const saveSignature = () => {
        if (sigPadRef.current) {
            const dataUrl = sigPadRef.current.toDataURL();
            setFormData(prev => ({ ...prev, signature: dataUrl }));
        }
    };

    const clearSignature = () => {
        if (sigPadRef.current) {
            sigPadRef.current.clear();
            setFormData(prev => ({ ...prev, signature: '' }));
        }
    };

    const clearForm = () => {
        setFormData({
            personalNumber: '',
            idNumber: '',
            firstName: '',
            lastName: '',
            date: new Date().toISOString().split('T')[0],
            signature: ''
        });
        if (sigPadRef.current) {
            sigPadRef.current.clear();
        }
        setStatusMessage({ text: '', isSuccess: false });
    };

    const getTodayDate = () => {
        const selectedDate = new Date(formData.date);
        const day = String(selectedDate.getDate()).padStart(2, '0');
        const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
        const year = selectedDate.getFullYear();
        return `${day}.${month}.${year}`;
    };

    const getTodayDateISO = () => {
        return new Date().toISOString().split('T')[0];
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
        const adjustedFontSize = fontSize * 1.7;
        ctx.font = `bold ${adjustedFontSize}px Arial`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'black';

        // Draw text
        ctx.fillText(text, canvas.width - 10, canvas.height / 2);

        return canvas.toDataURL('image/png');
    };

    const generatePDF = async (): Promise<Blob> => {
        // Load the existing PDF
        const pdfPath = `${import.meta.env.BASE_URL}medical.pdf`;
        const response = await fetch(pdfPath);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch PDF: ${response.statusText}`);
        }
        
        const existingPdfBytes = await response.arrayBuffer();
        const pdfDoc = await PDFDocument.load(existingPdfBytes);

        // Get the first page (assuming form is on first page)
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];
        const { height, width } = firstPage.getSize();

        const fontSize = 20;

        const personal_width = 330;
        const personal_height = 120;
        const personal_y = 505;

        // Personal Number (7 digits) - split into individual digits
        const personalDigits = formData.personalNumber.split('').reverse();
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

        // ID Number (9 digits) - split into individual digits
        const idDigits = formData.idNumber.split('').reverse();
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
        const firstNameImageData = textToImage(formData.firstName, fontSize);
        const firstNameImage = await pdfDoc.embedPng(firstNameImageData);
        const firstNameDims = firstNameImage.scale(0.5);

        firstPage.drawImage(firstNameImage, {
            x: -190,
            y: personal_y+1,
            width: personal_width + 70,
            height: personal_height,
        });

        // Last Name
        const lastNameImageData = textToImage(formData.lastName, fontSize);
        const lastNameImage = await pdfDoc.embedPng(lastNameImageData);
        const lastNameDims = lastNameImage.scale(0.5);
        


        firstPage.drawImage(lastNameImage, {
            x: -116,
            y: personal_y,
            width: personal_width + 70,
            height: personal_height,
        });

        // Date
        const dateImageData = textToImage(getTodayDate(), fontSize);
        const dateImage = await pdfDoc.embedPng(dateImageData);
        const dateDims = dateImage.scale(0.5);
        
        firstPage.drawImage(dateImage, {
            x: -10,
            y: personal_y - 45,
            width: personal_width + 70,
            height: personal_height,
        });

        // Signature
        if (formData.signature) {
            const signatureImageBytes = await fetch(formData.signature).then(res => res.arrayBuffer());
            const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
            const signatureDims = signatureImage.scale(0.3);
            
            firstPage.drawImage(signatureImage, {
                x: 210,
                y: personal_y + 10,
                width: 80,
                height: 20,
            });
        }

        const pdfBytes = await pdfDoc.save();
        return new Blob([pdfBytes], { type: 'application/pdf' });
    };

    const handleSubmit = async () => {
        // Validate required fields
        if (!formData.personalNumber || !formData.firstName || !formData.lastName) {
            setStatusMessage({ text: 'נא למלא את כל השדות החובה', isSuccess: false });
            return;
        }

        // Validate personal number is exactly 7 digits
        if (!/^\d{7}$/.test(formData.personalNumber)) {
            setStatusMessage({ text: 'מספר אישי חייב להיות בדיוק 7 ספרות', isSuccess: false });
            return;
        }

        // Validate ID number is exactly 9 digits
        if (!/^\d{9}$/.test(formData.idNumber)) {
            setStatusMessage({ text: 'תעודת זהות חייבת להיות בדיוק 9 ספרות', isSuccess: false });
            return;
        }

        setIsSubmitting(true);
        setStatusMessage({ text: '', isSuccess: false });

        try {
            // Generate PDF
            const pdfBlob = await generatePDF();
            const fileName = `כתב ויתור על סודיות רפואית ${formData.personalNumber}.pdf`;

            // Download PDF locally
            const url = URL.createObjectURL(pdfBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.click();
            URL.revokeObjectURL(url);
            
            setStatusMessage({ text: 'הקובץ הורד בהצלחה', isSuccess: true });

            // Insert data into Supabase (no UI feedback)
            await supabase.from('hrMedicalWaiver').insert({
                personalNumber: formData.personalNumber,
                idNumber: formData.idNumber,
                firstName: formData.firstName,
                lastName: formData.lastName,
                signature: formData.signature,
                date: formData.date,
                date_filled: new Date().toLocaleString('he-IL')
            });
        } catch (error: any) {
            console.error('Error:', error);
            setStatusMessage({ text: `שגיאה: ${error.message}`, isSuccess: false });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-600 to-orange-100" dir="rtl">
            <div className="max-w-lg mx-auto p-3 md:p-6">
                {/* Header */}
                <div className="bg-orange-500 text-white p-6 rounded-t-lg flex items-center justify-between">
                    <Button
                        variant="outline"
                        onClick={() => navigate(-1)}
                        className="bg-white text-orange-500 hover:bg-orange-50"
                    >
                        ← חזרה
                    </Button>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        🏥 ויתור על סודיות רפואית
                    </h1>
                </div>

                {/* Form */}
                <div className="bg-white p-6 rounded-b-lg shadow-lg space-y-4">
                    {/* Status Message */}
                    {statusMessage.text && (
                        <div className={`p-3 rounded-lg ${statusMessage.isSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {statusMessage.text}
                        </div>
                    )}

                    {/* Personal Number */}
                    <div>
                        <label className="block text-right font-semibold mb-2">
                            מספר אישי <span className="text-red-500">*</span>
                        </label>
                        <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="הכנס מספר אישי (7 ספרות)"
                            value={formData.personalNumber}
                            onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, '').slice(0, 7);
                                handleInputChange('personalNumber', value);
                            }}
                            className="text-right"
                            dir="rtl"
                            maxLength={7}
                        />
                        <p className="text-xs text-gray-500 text-right mt-1">
                            * מספר אישי חייב להיות בדיוק 7 ספרות
                        </p>
                    </div>

                    {/* ID Number */}
                    <div>
                        <label className="block text-right font-semibold mb-2">
                            תעודת זהות <span className="text-red-500">*</span>
                        </label>
                        <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="הכנס מספר תעודת זהות (9 ספרות)"
                            value={formData.idNumber}
                            onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, '').slice(0, 9);
                                handleInputChange('idNumber', value);
                            }}
                            className="text-right"
                            dir="rtl"
                            maxLength={9}
                        />
                        <p className="text-xs text-gray-500 text-right mt-1">
                            * תעודת זהות חייבת להיות בדיוק 9 ספרות
                        </p>
                    </div>

                    {/* First Name */}
                    <div>
                        <label className="block text-right font-semibold mb-2">
                            שם פרטי <span className="text-red-500">*</span>
                        </label>
                        <Input
                            type="text"
                            placeholder="הכנס שם פרטי"
                            value={formData.firstName}
                            onChange={(e) => handleInputChange('firstName', e.target.value)}
                            className="text-right"
                            dir="rtl"
                        />
                    </div>

                    {/* Last Name */}
                    <div>
                        <label className="block text-right font-semibold mb-2">
                            שם משפחה <span className="text-red-500">*</span>
                        </label>
                        <Input
                            type="text"
                            placeholder="הכנס שם משפחה"
                            value={formData.lastName}
                            onChange={(e) => handleInputChange('lastName', e.target.value)}
                            className="text-right"
                            dir="rtl"
                        />
                    </div>

                    {/* Date */}
                    <div>
                        <label className="block text-right font-semibold mb-2">
                            תאריך *
                        </label>
                        <Input
                            type="date"
                            value={formData.date}
                            onChange={(e) => handleInputChange('date', e.target.value)}
                            min={getTodayDateISO()}
                            className="text-right"
                            dir="rtl"
                        />
                    </div>

                    {/* Digital Signature */}
                    <div>
                        <label className="block text-right font-semibold mb-2 text-green-600">
                            ✍חתימה דיגיטלית ✍️ *
                        </label>
                        <div className="border-2 border-green-500 rounded-lg p-2 bg-green-50">
                            <SignatureCanvas
                                ref={sigPadRef}
                                canvasProps={{
                                    className: 'w-full h-40 bg-white rounded',
                                }}
                                onEnd={saveSignature}
                            />
                        </div>
                        <Button
                            onClick={clearSignature}
                            className="mt-2 bg-red-500 hover:bg-red-600 text-white"
                        >
                            🗑️ נקה חתימה
                        </Button>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-4 justify-center pt-4">
                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting}
                            className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-3"
                        >
                            📤 הורד טופס חתום
                        </Button>
                        <Button
                            onClick={clearForm}
                            disabled={isSubmitting}
                            className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-3"
                        >
                            📥 נקה טופס
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MedicalWaiverForm;
