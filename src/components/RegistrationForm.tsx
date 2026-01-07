import React, {useState, useRef} from 'react';
import {supabase} from '@/lib/supabaseClient';
import SignatureCanvas from "react-signature-canvas";

interface RegistrationFormProps {
    onBackToLogin: () => void;
}

const RegistrationForm: React.FC<RegistrationFormProps> = ({onBackToLogin}) => {
    const [registrationData, setRegistrationData] = useState({
        email: "",
        name: "",
        id: null as number | null,
        admin: false,
        logistic: false,
        ammo: false,
        armory: false,
        א: false,
        ב: false,
        ג: false,
        מסייעת: false,
        אלון: false,
        מכלול: false,
        פלסם: false,
        signature: "",
    });
    const [companyPermission, setCompanyPermission] = useState("");
    const [registrationMessage, setRegistrationMessage] = useState({ text: "", type: "" });
    const sigPadRef = useRef<SignatureCanvas>(null);

    const handleRegistrationChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const {name, value, type} = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        
        const companyPermissions = ['א', 'ב', 'ג', 'מסייעת', 'אלון', 'פלסם', 'מכלול'];
        const otherPermissions = ['admin', 'armory', 'logistic', 'ammo'];
        
        let finalValue: any;
        if (type === 'checkbox') {
            finalValue = checked;
            
            if (checked && companyPermissions.includes(name)) {
                setRegistrationData(prev => {
                    const updated = {...prev, [name]: true};
                    companyPermissions.forEach(perm => {
                        if (perm !== name) {
                            (updated as any)[perm] = false;
                        }
                    });
                    otherPermissions.forEach(perm => {
                        (updated as any)[perm] = false;
                    });
                    return updated;
                });
                return;
            }
            
            if (checked && otherPermissions.includes(name)) {
                setRegistrationData(prev => {
                    const updated = {...prev, [name]: true};
                    companyPermissions.forEach(perm => {
                        (updated as any)[perm] = false;
                    });
                    return updated;
                });
                setCompanyPermission('');
                return;
            }
        } else if (name === 'id') {
            finalValue = value === '' ? null : parseInt(value, 10);
        } else {
            finalValue = value;
        }
        
        setRegistrationData(prev => ({
            ...prev,
            [name]: finalValue
        }));
    };

    const handleSignatureEnd = () => {
        if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
            const dataURL = sigPadRef.current.getCanvas().toDataURL("image/png");
            setRegistrationData((prev) => ({...prev, signature: dataURL}));
        }
    };

    const clearSignature = () => {
        if (sigPadRef.current) {
            sigPadRef.current.clear();
            setRegistrationData(prev => ({...prev, signature: ""}));
        }
    };

    const handleRegistrationSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(registrationData.email)) {
            setRegistrationMessage({text: "כתובת אימייל לא תקינה", type: "error"});
            return;
        }
        
        if (registrationData.name.trim() === "") {
            setRegistrationMessage({text: "שם נדרש", type: "error"});
            return;
        }
        
        if (registrationData.signature === "") {
            setRegistrationMessage({text: "חתימה נדרשת", type: "error"});
            return;
        }
        
        const companyPermissions = ['א', 'ב', 'ג', 'מסייעת', 'אלון', 'פלסם', 'מכלול'];
        const otherPermissions = ['admin', 'armory', 'logistic', 'ammo'];
        const selectedCompanies = companyPermissions.filter(perm => registrationData[perm as keyof typeof registrationData]);
        const selectedOthers = otherPermissions.filter(perm => registrationData[perm as keyof typeof registrationData]);
        
        if (selectedCompanies.length > 1) {
            setRegistrationMessage({text: "ניתן לבחור רק פלוגה אחת", type: "error"});
            return;
        }
        
        if (selectedCompanies.length > 0 && selectedOthers.length > 0) {
            setRegistrationMessage({text: "לא ניתן לשלב הרשאת פלוגה עם הרשאות אחרות", type: "error"});
            return;
        }
        
        try {
            const {data, error} = await supabase
                .from("registration")
                .insert([{...registrationData, email: registrationData.email.toLowerCase()}])
                .select();

            if (error) {
                console.error("Error submitting registration:", error);
                setRegistrationMessage({text: "שגיאה בשליחת הבקשה", type: "error"});
            } else {
                setRegistrationMessage({text: "הבקשה נשלחה בהצלחה! נא להמתין לאישור מנהל", type: "success"});
                setRegistrationData({
                    email: "",
                    name: "",
                    id: null,
                    admin: false,
                    logistic: false,
                    ammo: false,
                    armory: false,
                    א: false,
                    ב: false,
                    ג: false,
                    מסייעת: false,
                    אלון: false,
                    מכלול: false,
                    פלסם: false,
                    signature: "",
                });
                setCompanyPermission("");
                if (sigPadRef.current) {
                    sigPadRef.current.clear();
                }
                setTimeout(() => {
                    onBackToLogin();
                    setRegistrationMessage({ text: "", type: "" });
                }, 3000);
            }
        } catch (err: any) {
            console.error("Unexpected error:", err);
            setRegistrationMessage({text: `שגיאה: ${err.message}`, type: "error"});
        }
    };

    return (
        <div>
            <div className="mb-6 flex items-center justify-between">
                <button
                    onClick={() => {
                        onBackToLogin();
                        setRegistrationMessage({ text: "", type: "" });
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                >
                    ← חזור להתחברות
                </button>
                <h2 className="text-2xl font-bold text-gray-900">הרשמה</h2>
            </div>
            
            {registrationMessage.text && (
                <div className={`mb-4 p-3 rounded ${registrationMessage.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} text-right`}>
                    {registrationMessage.text}
                </div>
            )}
            
            <form onSubmit={handleRegistrationSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-right">שם מלא</label>
                        <input
                            type="text"
                            name="name"
                            value={registrationData.name}
                            onChange={handleRegistrationChange}
                            className="mt-1 p-2 block w-full border border-gray-300 rounded text-right"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-right">דוא&quot;ל</label>
                        <input
                            type="email"
                            name="email"
                            value={registrationData.email}
                            onChange={handleRegistrationChange}
                            className="mt-1 p-2 block w-full border border-gray-300 rounded text-right"
                            required
                        />
                    </div>
                </div>
                
                <div>
                    <label className="block text-sm font-medium text-right">מספר אישי</label>
                    <input
                        type="number"
                        name="id"
                        value={registrationData.id || ''}
                        onChange={handleRegistrationChange}
                        className="mt-1 p-2 block w-full border border-gray-300 rounded text-right"
                    />
                </div>

                <div className="mt-4">
                    <label className="block text-sm font-medium text-right mb-2">חתימה</label>
                    <div className="border border-gray-300 rounded p-2 bg-white">
                        <SignatureCanvas
                            ref={sigPadRef}
                            penColor="black"
                            onEnd={handleSignatureEnd}
                            canvasProps={{
                                width: 350,
                                height: 150,
                                className: "signature-canvas border border-gray-100"
                            }}
                        />
                    </div>
                    <div className="flex justify-end mt-2">
                        <button
                            type="button"
                            onClick={clearSignature}
                            className="bg-gray-300 hover:bg-gray-400 text-gray-800 px-3 py-1 rounded text-sm"
                        >
                            נקה
                        </button>
                    </div>
                </div>

                <h3 className="font-medium mt-4 text-right">הרשאות (מיועד למחלקת הלוגיסטיקה):</h3>
                <div className="mb-4">
                    <label className="flex items-center space-x-2 text-right">
                        <input
                            type="checkbox"
                            name="admin"
                            checked={registrationData.admin}
                            onChange={handleRegistrationChange}
                            className="ml-2"
                        />
                        מנהל
                    </label>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                    <label className="flex items-center space-x-2 text-right">
                        <input
                            type="checkbox"
                            name="armory"
                            checked={registrationData.armory}
                            onChange={handleRegistrationChange}
                            className="ml-2"
                        />
                        נשקיה
                    </label>
                    <label className="flex items-center space-x-2 text-right">
                        <input
                            type="checkbox"
                            name="logistic"
                            checked={registrationData.logistic}
                            onChange={handleRegistrationChange}
                            className="ml-2"
                        />
                        לוגיסטיקה
                    </label>
                    <label className="flex items-center space-x-2 text-right">
                        <input
                            type="checkbox"
                            name="ammo"
                            checked={registrationData.ammo}
                            onChange={handleRegistrationChange}
                            className="ml-2"
                        />
                        תחמושת
                    </label>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium text-right mb-2">בחר פלוגה (מיועד לחיילי הפלוגות):</label>
                    <select
                        name="companyPermission"
                        value={companyPermission}
                        onChange={(e) => {
                            const value = e.target.value;
                            const companyPermissions = ['א', 'ב', 'ג', 'מסייעת', 'אלון', 'פלסם', 'מכלול'];
                            const otherPermissions = ['admin', 'armory', 'logistic', 'ammo'];
                            
                            setCompanyPermission(value);
                            
                            setRegistrationData(prev => {
                                const updated = {...prev};
                                
                                companyPermissions.forEach(perm => {
                                    (updated as any)[perm] = false;
                                });
                                
                                if (value) {
                                    (updated as any)[value] = true;
                                    otherPermissions.forEach(perm => {
                                        (updated as any)[perm] = false;
                                    });
                                }
                                
                                return updated;
                            });
                        }}
                        className="mt-1 p-2 block w-full border border-gray-300 rounded text-right"
                        dir="rtl"
                    >
                        <option value="">-- בחר פלוגה --</option>
                        <option value="א">א</option>
                        <option value="ב">ב</option>
                        <option value="ג">ג</option>
                        <option value="מסייעת">מסייעת</option>
                        <option value="אלון">אלון</option>
                        <option value="מכלול">מכלול</option>
                        <option value="פלסם">פלסם</option>
                    </select>
                </div>

                <div className="flex justify-end mt-6">
                    <button
                        type="submit"
                        className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded"
                    >
                        שלח בקשה
                    </button>
                </div>
            </form>
        </div>
    );
};

export default RegistrationForm;
