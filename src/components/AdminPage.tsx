"use client";

import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient"
import { AgGridReact } from "ag-grid-react";
import { useNavigate } from "react-router-dom";
import SignatureCanvas from "react-signature-canvas";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import StatusMessageProps from "@/components/feedbackFromBackendOrUser/StatusMessageProps";

type SignaturePad = SignatureCanvas | null;

const AdminPage = () => {

    const navigate = useNavigate();
    const sigPadRef = useRef<SignaturePad>(null);

    const [rowData, setRowData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [showDeleteForm, setShowDeleteForm] = useState(false);
    const [emailToDelete, setEmailToDelete] = useState("");
    const [statusMessage, setStatusMessage] = useState({ text: "", type: "" });
    const [formErrors, setFormErrors] = useState({
        email: "",
        name: "",
        signature: "",
    });

    // New user form state
    const [newUser, setNewUser] = useState({
        email: "",
        name: "",
        admin: false,
        Logistic: false,
        munitions: false,
        Armory: false,
        א: false,
        ב: false,
        ג: false,
        מסייעת: false,
        אלון: false,
        מכלול: false,
        פלסם: false,
        signature: "", // Add signature field
    });

    // Check if form is valid
    const isFormValid = () => {
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        const isEmailValid = emailRegex.test(newUser.email);
        const isNameValid = newUser.name.trim() !== "";
        const isSignatureValid = newUser.signature !== "";

        return isEmailValid && isNameValid && isSignatureValid;
    };

    const onFirstDataRendered = (e: any) => {
        // prefer what's actually displayed (respects visibility, groups, pinning)
        const displayed = e.api.getAllDisplayedColumns()
        if (displayed.length) {
            const last = displayed[displayed.length - 1]
            e.api.ensureColumnVisible(last.getColId(), 'end') // scroll so last col sits at the right
            return
        }

        // fallback: derive last col id from your columnDefs
        const lastDef = columnDefs[columnDefs.length - 1] as any | undefined
        const lastKey = lastDef?.colId ?? lastDef?.field
        if (lastKey) e.api.ensureColumnVisible(lastKey, 'end')
    }

    // Reverse the column order to display from left to right
    const columnDefs = [
        { field: "פלסם", headerName: "פלסם", width: 80 },
        { field: "מכלול", headerName: "מכלול", width: 80 },
        { field: "אלון", headerName: "אלון", width: 80 },
        { field: "מסייעת", headerName: "מסייעת", width: 100 },
        { field: "ג", headerName: "ג", width: 80 },
        { field: "ב", headerName: "ב", width: 80 },
        { field: "א", headerName: "א", width: 80 },
        { field: "Logistic", headerName: "Logistic", width: 100 },
        { field: "munitions", headerName: "Munitions", width: 100 },
        { field: "Armory", headerName: "Armory", width: 100 },
        { field: "admin", headerName: "Admin", width: 100 },
        { 
            field: "email", 
            headerName: "Email", 
            width: 200,
            cellStyle: { 
                textAlign: 'right',
                userSelect: 'text', // Enable text selection
                cursor: 'text'      // Show text cursor on hover
            }
        },
        { field: "name", headerName: "Name", width: 150 },
    ];

    // Default column definition to ensure consistent alignment
    const defaultColDef = {
        headerClass: 'ag-right-aligned-header',
        cellStyle: { textAlign: 'right' },
    };

    const fetchUsers = async () => {
        // const { data: { user } } = await supabase.auth.getUser();

        const { data, error } = await supabase.from("users").select("*");

        if (error) {
            console.error("Supabase fetch error:", error);
            setStatusMessage({ text: `Error fetching users: ${error.message}`, type: "error" });
        } else {
            setRowData(data || []);
        }

        setLoading(false);
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // Save signature
    const saveSignature = () => {
        if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
            const dataURL = sigPadRef.current.getCanvas().toDataURL("image/png");
            setNewUser((prev) => ({...prev, signature: dataURL}));
            setFormErrors(prev => ({ ...prev, signature: "" }));
        } else {
            setFormErrors(prev => ({ ...prev, signature: "חתימה נדרשת" }));
        }
    };

    // Clear signature
    const clearSignature = () => {
        if (sigPadRef.current) {
            sigPadRef.current.clear();
            setNewUser(prev => ({ ...prev, signature: "" }));
        }
    };

    const handleNewUserChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setNewUser(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));

        // Validate email and name on change
        if (name === 'email') {
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!emailRegex.test(value)) {
                setFormErrors(prev => ({ ...prev, email: "כתובת אימייל לא תקינה" }));
            } else {
                setFormErrors(prev => ({ ...prev, email: "" }));
            }
        }
        
        if (name === 'name') {
            if (value.trim() === "") {
                setFormErrors(prev => ({ ...prev, name: "שם נדרש" }));
            } else {
                setFormErrors(prev => ({ ...prev, name: "" }));
            }
        }
    };

    const addUser = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validate form
        let formValid = true;
        const errors = { ...formErrors };

        // Validate email
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(newUser.email)) {
            errors.email = "כתובת אימייל לא תקינה";
            formValid = false;
        } else {
            errors.email = "";
        }

        // Validate name
        if (newUser.name.trim() === "") {
            errors.name = "שם נדרש";
            formValid = false;
        } else {
            errors.name = "";
        }

        // Validate signature
        if (newUser.signature === "") {
            errors.signature = "חתימה נדרשת";
            formValid = false;
        } else {
            errors.signature = "";
        }

        setFormErrors(errors);

        if (!formValid) {
            return;
        }

        setLoading(true);
        setStatusMessage({ text: "", type: "" });

        try {
            // Add user to the users table
            const { data, error } = await supabase
                .from("users")
                .insert([newUser])
                .select();

            if (error) {
                console.error("Error adding user:", error);
                setStatusMessage({ text: `בעיה בהוספת משתמש`, type: "error" });
            } else {
                console.log("User added successfully:", data);
                setStatusMessage({ text:"המשתמש " + newUser.name + " נוסף בהצלחה", type: "success" });
                setNewUser({
                    email: "",
                    name: "",
                    admin: false,
                    Logistic: false,
                    munitions: false,
                    Armory: false,
                    א: false,
                    ב: false,
                    ג: false,
                    מסייעת: false,
                    אלון: false,
                    מכלול: false,
                    פלסם: false,
                    signature: "",
                });
                if (sigPadRef.current) {
                    sigPadRef.current.clear();
                }
                setShowAddForm(false);
                // Refresh the user list
                fetchUsers();
            }
        } catch (err: any) {
            console.error("Unexpected error:", err);
            setStatusMessage({ text: `Error: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const deleteUser = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(emailToDelete)) {
            setStatusMessage({ text: "נא הכנס מייל תיקני", type: "error" });
            return;
        }

        setLoading(true);
        setStatusMessage({ text: "", type: "" });

        try {
            const { data, error } = await supabase
                .from("users")
                .delete()
                .eq("email", emailToDelete)
                .select("*"); // get deleted rows

            if (error) {
                setStatusMessage({ text: `Failed to delete user: ${error.message}`, type: "error" });
            } else {
                if (!data || data.length === 0) {
                    setStatusMessage({ text: `המייל ${emailToDelete} לא קיים באפליקציה`, type: "error" });
                } else {
                    setStatusMessage({ text: `המייל ${emailToDelete} נמחק בהצלחה`, type: "success" });
                    setEmailToDelete("");
                    setShowDeleteForm(false);
                    await fetchUsers();
                }
            }
        } catch (err: any) {
            setStatusMessage({ text: `Error: ${err.message}`, type: "error" });
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                <p className="text-center p-4">Loading...</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4">
            <div className="flex justify-between mb-4">
                <button
                    onClick={() => navigate(-1)}
                    className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-6 rounded"
                >
                    חזור
                </button>
                <div className="space-x-2">
                    <button
                        onClick={() => {
                            setShowAddForm(!showAddForm);
                            if (!showAddForm) {
                                setShowDeleteForm(false);
                            }
                        }}
                        className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded mx-2"
                    >
                        {showAddForm ? 'ביטול' : 'הוסף משתמש'}
                    </button>
                    <button
                        onClick={() => {
                            setShowDeleteForm(!showDeleteForm);
                            if (!showDeleteForm) {
                                setShowAddForm(false);
                            }
                        }}
                        className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded"
                    >
                        {showDeleteForm ? 'ביטול' : 'מחק משתמש'}
                    </button>
                </div>
            </div>

            {statusMessage.text && (
                <StatusMessageProps
                    isSuccess={statusMessage.type === 'success'}
                    message={statusMessage.text}
                    onClose={() => setStatusMessage({ text: "", type: "" })}
                />
            )}

            {showAddForm && (
                <div className="bg-white shadow-md rounded p-4 mb-6">
                    <h2 className="text-xl font-bold mb-4 text-right">הוסף משתמש חדש</h2>
                    <form onSubmit={addUser} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-right">שם מלא</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={newUser.name}
                                    onChange={handleNewUserChange}
                                    className={`mt-1 p-2 block w-full border ${formErrors.name ? 'border-red-500' : 'border-gray-300'} rounded text-right`}
                                    required
                                />
                                {formErrors.name && (
                                    <p className="text-red-500 text-sm mt-1 text-right">{formErrors.name}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-right">דוא"ל</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={newUser.email}
                                    onChange={handleNewUserChange}
                                    className={`mt-1 p-2 block w-full border ${formErrors.email ? 'border-red-500' : 'border-gray-300'} rounded text-right`}
                                    required
                                />
                                {formErrors.email && (
                                    <p className="text-red-500 text-sm mt-1 text-right">{formErrors.email}</p>
                                )}
                            </div>
                        </div>

                        <div className="mt-4">
                            <label className="block text-sm font-medium text-right mb-2">חתימה</label>
                            <div className="border border-gray-100 rounded p-2 bg-white">
                                <SignatureCanvas
                                    ref={sigPadRef}
                                    penColor="black"
                                    canvasProps={{
                                        width: 500,
                                        height: 200,
                                        className: "signature-canvas border border-gray-100"
                                    }}
                                />
                            </div>
                            <div className="flex justify-end mt-1 space-x-2">
                                <button
                                    type="button"
                                    onClick={saveSignature}
                                    className="bg-blue-500 hover:bg-blue-300 text-white px-1 py-1 rounded text-sm ml-2"
                                >
                                    שמור חתימה
                                </button>
                                <button
                                    type="button"
                                    onClick={clearSignature}
                                    className="bg-gray-300 hover:bg-gray-200 text-gray-200 px-1 py-1 rounded text-sm"
                                >
                                    נקה
                                </button>
                            </div>
                            {formErrors.signature && (
                                <p className="text-red-100 text-sm mt-1 text-right">{formErrors.signature}</p>
                            )}
                            {newUser.signature && (
                                <div className="mt-2 text-green-600 text-right">✓ החתימה נשמרה</div>
                            )}
                        </div>

                        <h3 className="font-medium mt-4 text-right">הרשאות:</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="flex items-center space-x-2">
                                <label className="flex items-center space-x-2 text-right">
                                    <input
                                        type="checkbox"
                                        name="admin"
                                        checked={newUser.admin}
                                        onChange={handleNewUserChange}
                                        className="ml-2"
                                    />
                                    מנהל
                                </label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <label className="flex items-center space-x-2 text-right">
                                    <input
                                        type="checkbox"
                                        name="Armory"
                                        checked={newUser.Armory}
                                        onChange={handleNewUserChange}
                                        className="ml-2"
                                    />
                                    נשקיה
                                </label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <label className="flex items-center space-x-2 text-right">
                                    <input
                                        type="checkbox"
                                        name="Logistic"
                                        checked={newUser.Logistic}
                                        onChange={handleNewUserChange}
                                        className="ml-2"
                                    />
                                    לוגיסטיקה
                                </label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <label className="flex items-center space-x-2 text-right">
                                    <input
                                        type="checkbox"
                                        name="munitions"
                                        checked={newUser.munitions}
                                        onChange={handleNewUserChange}
                                        className="ml-2"
                                    />
                                    תחמושת
                                </label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <label className="flex items-center space-x-2 text-right">
                                    <input
                                        type="checkbox"
                                        name="א"
                                        checked={newUser.א}
                                        onChange={handleNewUserChange}
                                        className="ml-2"
                                    />
                                    א
                                </label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <label className="flex items-center space-x-2 text-right">
                                    <input
                                        type="checkbox"
                                        name="ב"
                                        checked={newUser.ב}
                                        onChange={handleNewUserChange}
                                        className="ml-2"
                                    />
                                    ב
                                </label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <label className="flex items-center space-x-2 text-right">
                                    <input
                                        type="checkbox"
                                        name="ג"
                                        checked={newUser.ג}
                                        onChange={handleNewUserChange}
                                        className="ml-2"
                                    />
                                    ג
                                </label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <label className="flex items-center space-x-2 text-right">
                                    <input
                                        type="checkbox"
                                        name="מסייעת"
                                        checked={newUser.מסייעת}
                                        onChange={handleNewUserChange}
                                        className="ml-2"
                                    />
                                    מסייעת
                                </label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <label className="flex items-center space-x-2 text-right">
                                    <input
                                        type="checkbox"
                                        name="אלון"
                                        checked={newUser.אלון}
                                        onChange={handleNewUserChange}
                                        className="ml-2"
                                    />
                                    אלון
                                </label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <label className="flex items-center space-x-2 text-right">
                                    <input
                                        type="checkbox"
                                        name="מכלול"
                                        checked={newUser.מכלול}
                                        onChange={handleNewUserChange}
                                        className="ml-2"
                                    />
                                    מכלול
                                </label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <label className="flex items-center space-x-2 text-right">
                                    <input
                                        type="checkbox"
                                        name="פלסם"
                                        checked={newUser.פלסם}
                                        onChange={handleNewUserChange}
                                        className="ml-2"
                                    />
                                    פלסם
                                </label>
                            </div>
                        </div>

                        <div className="flex justify-end mt-4">
                            <button
                                type="submit"
                                disabled={!isFormValid()}
                                className={`${isFormValid() ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400 cursor-not-allowed'} text-white font-bold py-2 px-6 rounded`}
                            >
                                הוסף משתמש
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {showDeleteForm && (
                <div className="bg-white shadow-md rounded p-4 mb-6">
                    <h2 className="text-xl font-bold mb-4 text-right">מחק משתמש</h2>
                    <form onSubmit={deleteUser} className="flex items-end space-x-2">
                        <button
                            type="submit"
                            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded ml-2"
                        >
                            מחק
                        </button>
                        <div className="flex-grow">
                            <label className="block text-sm font-medium text-right">דוא"ל</label>
                            <input
                                type="email"
                                value={emailToDelete}
                                onChange={(e) => setEmailToDelete(e.target.value)}
                                className="mt-1 p-2 block w-full border border-gray-300 rounded text-right"
                                placeholder="example@example.com"
                                required
                            />
                        </div>
                    </form>
                </div>
            )}

            <div
                className="ag-theme-alpine w-full h-[40vh] ag-rtl mb-8"
                style={{ direction: 'ltr' }} // Change direction to left-to-right
            >
                <style>
                    {`
                    .ag-right-aligned-header .ag-header-cell-label {
                        justify-content: flex-end;
                    }
                    `}
                </style>
                <div className="ag-theme-alpine w-full h-[40vh] ag-rtl mb-8" style={{ direction: "ltr" }}>
                    <AgGridReact
                        rowData={rowData}
                        columnDefs={columnDefs}
                        defaultColDef={defaultColDef}
                        suppressColumnVirtualisation={true}
                        domLayout="normal"
                        onFirstDataRendered={onFirstDataRendered}
                    />
                </div>
            </div>
        </div>
    );
};

export default AdminPage;
