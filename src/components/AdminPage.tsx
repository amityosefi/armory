"use client";

import React, {useEffect, useState, useRef, useMemo} from "react";
import {supabase} from "@/lib/supabaseClient"
import {AgGridReact} from "ag-grid-react";
import {useNavigate} from "react-router-dom";
import SignatureCanvas from "react-signature-canvas";
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import StatusMessageProps from "@/components/feedbackFromBackendOrUser/StatusMessageProps";
import {usePermissions} from "@/contexts/PermissionsContext";
import MiniConfirm from "@/components/feedbackFromBackendOrUser/MiniConfirm";

type SignaturePad = SignatureCanvas | null;

const AdminPage = () => {

    const navigate = useNavigate();
    const sigPadRef = useRef<SignaturePad>(null);
    const {permissions} = usePermissions();
    const [rowData, setRowData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [showDeleteForm, setShowDeleteForm] = useState(false);
    const [emailToDelete, setEmailToDelete] = useState("");
    const [statusMessage, setStatusMessage] = useState({text: "", type: ""});
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

    // Armory items state (for admin + Armory permission)
    const [armoryItems, setArmoryItems] = useState<any[]>([]);
    const [showArmoryForm, setShowArmoryForm] = useState(false);
    const [editingArmoryItem, setEditingArmoryItem] = useState<any>(null);
    const [newArmoryItem, setNewArmoryItem] = useState({
        אמצעי: "",
        חתימה: 0,
        סוג: "",
    });
    const [miniConfirmOpen, setMiniConfirmOpen] = useState(false);
    const [itemToDelete, setItemToDelete] = useState<string>("");

    // Compute unique categories dynamically from armoryItems
    const uniqueCategories = useMemo(() => {
        const categories = new Set(armoryItems.map(item => item.סוג));
        return Array.from(categories).sort();
    }, [armoryItems]);

    // Set default category when opening add form
    useEffect(() => {
        if (showArmoryForm && !editingArmoryItem && newArmoryItem.סוג === "") {
            const defaultCategory = uniqueCategories[0] || "נשק";
            setNewArmoryItem(prev => ({...prev, סוג: defaultCategory}));
        }
    }, [showArmoryForm, editingArmoryItem, uniqueCategories]);

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
        {field: "פלסם", headerName: "פלסם", width: 80},
        {field: "מכלול", headerName: "מכלול", width: 80},
        {field: "אלון", headerName: "אלון", width: 80},
        {field: "מסייעת", headerName: "מסייעת", width: 100},
        {field: "ג", headerName: "ג", width: 80},
        {field: "ב", headerName: "ב", width: 80},
        {field: "א", headerName: "א", width: 80},
        {field: "Ammo", headerName: "Ammo", width: 100},
        {field: "munitions", headerName: "Munitions", width: 100},
        {field: "Armory", headerName: "Armory", width: 100},
        {field: "admin", headerName: "Admin", width: 100},
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
        {field: "name", headerName: "Name", width: 150},
    ];

    // Default column definition to ensure consistent alignment
    const defaultColDef = {
        headerClass: 'ag-right-aligned-header',
        cellStyle: {textAlign: 'right'},
    };

    const fetchUsers = async () => {
        // const { data: { user } } = await supabase.auth.getUser();
        if (permissions['admin']) {
            const {data, error} = await supabase.from("users").select("*");

            if (error) {
                console.error("Supabase fetch error:", error);
                setStatusMessage({text: `Error fetching users: ${error.message}`, type: "error"});
            } else {
                setRowData(data || []);
            }

            setLoading(false);
        }
    };

    const fetchArmoryItems = async () => {
        if (permissions['admin'] && permissions['Armory']) {
            const {data, error} = await supabase.from("armory_signs").select("*");

            if (error) {
                console.error("Error fetching armory items:", error);
                setStatusMessage({text: `שגיאה בטעינת אמצעים: ${error.message}`, type: "error"});
            } else {
                setArmoryItems(data || []);
            }
        }
    };

    // Helper function to log actions to תיעוד table
    const logAction = async (message: string) => {
        try {
            await supabase.from("תיעוד").insert([{
                תאריך: new Date().toLocaleString('he-IL'),
                משתמש: permissions['name'] || 'לא ידוע',
                הודעה: message
            }]);
        } catch (err) {
            console.error("Error logging action:", err);
            // Don't show error to user for logging failures
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchArmoryItems();
        logAction("Page loaded");
    }, []);

    // Save signature
    const saveSignature = () => {
        if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
            const dataURL = sigPadRef.current.getCanvas().toDataURL("image/png");
            setNewUser((prev) => ({...prev, signature: dataURL}));
            setFormErrors(prev => ({...prev, signature: ""}));
        } else {
            setFormErrors(prev => ({...prev, signature: "חתימה נדרשת"}));
        }
    };

    // Clear signature
    const clearSignature = () => {
        if (sigPadRef.current) {
            sigPadRef.current.clear();
            setNewUser(prev => ({...prev, signature: ""}));
        }
    };

    const handleNewUserChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const {name, value, type, checked} = e.target;
        setNewUser(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));

        // Validate email and name on change
        if (name === 'email') {
            const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            if (!emailRegex.test(value)) {
                setFormErrors(prev => ({...prev, email: "כתובת אימייל לא תקינה"}));
            } else {
                setFormErrors(prev => ({...prev, email: ""}));
            }
        }

        if (name === 'name') {
            if (value.trim() === "") {
                setFormErrors(prev => ({...prev, name: "שם נדרש"}));
            } else {
                setFormErrors(prev => ({...prev, name: ""}));
            }
        }
    };

    const addUser = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validate form
        let formValid = true;
        const errors = {...formErrors};

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
        setStatusMessage({text: "", type: ""});

        try {
            // Add user to the users table
            const {data, error} = await supabase
                .from("users")
                .insert([newUser])
                .select();

            if (error) {
                console.error("Error adding user:", error);
                setStatusMessage({text: `בעיה בהוספת משתמש`, type: "error"});
            } else {
                console.log("User added successfully:", data);
                setStatusMessage({text: "המשתמש " + newUser.name + " נוסף בהצלחה", type: "success"});
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
            setStatusMessage({text: `Error: ${err.message}`, type: "error"});
        } finally {
            setLoading(false);
        }
    };

    const deleteUser = async (e: React.FormEvent) => {
        e.preventDefault();

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(emailToDelete)) {
            setStatusMessage({text: "נא הכנס מייל תיקני", type: "error"});
            return;
        }

        setLoading(true);
        setStatusMessage({text: "", type: ""});

        try {
            const {data, error} = await supabase
                .from("users")
                .delete()
                .eq("email", emailToDelete)
                .select("*"); // get deleted rows

            if (error) {
                setStatusMessage({text: `Failed to delete user: ${error.message}`, type: "error"});
            } else {
                if (!data || data.length === 0) {
                    setStatusMessage({text: `המייל ${emailToDelete} לא קיים באפליקציה`, type: "error"});
                } else {
                    setStatusMessage({text: `המייל ${emailToDelete} נמחק בהצלחה`, type: "success"});
                    setEmailToDelete("");
                    setShowDeleteForm(false);
                    await fetchUsers();
                }
            }
        } catch (err: any) {
            setStatusMessage({text: `Error: ${err.message}`, type: "error"});
        } finally {
            setLoading(false);
        }
    };

    // Armory items handlers
    const handleArmoryItemChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const {name, value} = e.target;
        if (editingArmoryItem) {
            setEditingArmoryItem((prev: any) => ({
                ...prev,
                [name]: name === 'חתימה' ? Math.max(0, parseInt(value) || 0) : value
            }));
        } else {
            setNewArmoryItem((prev) => ({
                ...prev,
                [name]: name === 'חתימה' ? Math.max(0, parseInt(value) || 0) : value
            }));
        }
    };

    const addArmoryItem = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newArmoryItem.אמצעי.trim()) {
            setStatusMessage({text: "נא להכניס שם אמצעי", type: "error"});
            return;
        }

        if (newArmoryItem.חתימה < 0) {
            setStatusMessage({text: "חתימה חייבת להיות מספר חיובי", type: "error"});
            return;
        }

        setLoading(true);
        setStatusMessage({text: "", type: ""});

        try {
            const {data, error} = await supabase
                .from("armory_signs")
                .insert([newArmoryItem])
                .select();

            if (error) {
                console.error("Error adding armory item:", error);
                setStatusMessage({text: `שגיאה בהוספת אמצעי: ${error.message}`, type: "error"});
            } else {
                await logAction(`הוספת אמצעי חדש: ${newArmoryItem.אמצעי}, סוג: ${newArmoryItem.סוג}, חתימה: ${newArmoryItem.חתימה}`);
                setStatusMessage({text: "האמצעי נוסף בהצלחה", type: "success"});
                setNewArmoryItem({אמצעי: "", חתימה: 0, סוג: ""});
                setShowArmoryForm(false);
                await fetchArmoryItems();
            }
        } catch (err: any) {
            console.error("Unexpected error:", err);
            setStatusMessage({text: `שגיאה: ${err.message}`, type: "error"});
        } finally {
            setLoading(false);
        }
    };

    const updateArmoryItem = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!editingArmoryItem.אמצעי.trim()) {
            setStatusMessage({text: "נא להכניס שם אמצעי", type: "error"});
            return;
        }

        if (editingArmoryItem.חתימה < 0) {
            setStatusMessage({text: "חתימה חייבת להיות מספר חיובי", type: "error"});
            return;
        }

        setLoading(true);
        setStatusMessage({text: "", type: ""});

        try {
            const {data, error} = await supabase
                .from("armory_signs")
                .update({
                    חתימה: editingArmoryItem.חתימה,
                    סוג: editingArmoryItem.סוג
                })
                .eq("אמצעי", editingArmoryItem.אמצעי)
                .select();

            if (error) {
                console.error("Error updating armory item:", error);
                setStatusMessage({text: `שגיאה בעדכון אמצעי: ${error.message}`, type: "error"});
            } else {
                await logAction(`עדכון אמצעי: ${editingArmoryItem.אמצעי}, סוג: ${editingArmoryItem.סוג}, חתימה חדשה: ${editingArmoryItem.חתימה}`);
                setStatusMessage({text: "האמצעי עודכן בהצלחה", type: "success"});
                setEditingArmoryItem(null);
                await fetchArmoryItems();
            }
        } catch (err: any) {
            console.error("Unexpected error:", err);
            setStatusMessage({text: `שגיאה: ${err.message}`, type: "error"});
        } finally {
            setLoading(false);
        }
    };

    const deleteArmoryItem = async (אמצעי: string) => {
        setItemToDelete(אמצעי);
        setMiniConfirmOpen(true);
    };

    const performDeleteArmoryItem = async () => {
        setLoading(true);
        setStatusMessage({text: "", type: ""});

        try {
            const {error} = await supabase
                .from("armory_signs")
                .delete()
                .eq("אמצעי", itemToDelete);

            if (error) {
                console.error("Error deleting armory item:", error);
                setStatusMessage({text: `שגיאה במחיקת אמצעי: ${error.message}`, type: "error"});
            } else {
                await logAction(`מחיקת אמצעי: ${itemToDelete}`);
                setStatusMessage({text: "האמצעי נמחק בהצלחה", type: "success"});
                await fetchArmoryItems();
            }
        } catch (err: any) {
            console.error("Unexpected error:", err);
            setStatusMessage({text: `שגיאה: ${err.message}`, type: "error"});
        } finally {
            setLoading(false);
            setMiniConfirmOpen(false);
            setItemToDelete("");
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
            {permissions['admin'] && (
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
            )}

            {statusMessage.text && (
                <StatusMessageProps
                    isSuccess={statusMessage.type === 'success'}
                    message={statusMessage.text}
                    onClose={() => setStatusMessage({text: "", type: ""})}
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
                style={{direction: 'ltr'}} // Change direction to left-to-right
            >
                <style>
                    {`
                    .ag-right-aligned-header .ag-header-cell-label {
                        justify-content: flex-end;
                    }
                    `}
                </style>
                <div className="ag-theme-alpine w-full h-[40vh] ag-rtl mb-8" style={{direction: "ltr"}}>
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

            {/* Armory Items Management Section - Only for admin + Armory */}
            {permissions['admin'] && permissions['Armory'] && (
                <div className="bg-white shadow-md rounded p-4 mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold text-right">ניהול החתמות</h2>
                        <button
                            onClick={() => {
                                setShowArmoryForm(!showArmoryForm);
                                setEditingArmoryItem(null);
                                setNewArmoryItem({אמצעי: "", חתימה: 0, סוג: ""});
                            }}
                            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded"
                        >
                            {showArmoryForm ? 'ביטול' : 'הוסף אמצעי'}
                        </button>
                    </div>

                    {/* Add/Edit Form */}
                    {(showArmoryForm || editingArmoryItem) && (
                        <div className="bg-gray-50 rounded p-4 mb-4">
                            <h3 className="text-lg font-bold mb-4 text-right">
                                {editingArmoryItem ? 'ערוך אמצעי' : 'הוסף אמצעי חדש'}
                            </h3>
                            <form onSubmit={editingArmoryItem ? updateArmoryItem : addArmoryItem} className="space-y-4">
                                <div className="flex flex-wrap items-center gap-3 text-right">
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm font-medium whitespace-nowrap">אמצעי:</label>
                                        <input
                                            type="text"
                                            name="אמצעי"
                                            value={editingArmoryItem ? editingArmoryItem.אמצעי : newArmoryItem.אמצעי}
                                            onChange={handleArmoryItemChange}
                                            className="p-2 w-32 border border-gray-300 rounded text-right"
                                            placeholder="שם"
                                            required
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm font-medium whitespace-nowrap">חתימה:</label>
                                        <input
                                            type="number"
                                            name="חתימה"
                                            value={editingArmoryItem ? editingArmoryItem.חתימה : newArmoryItem.חתימה}
                                            onChange={handleArmoryItemChange}
                                            className="p-2 w-20 border border-gray-300 rounded text-right"
                                            placeholder="0"
                                            min="0"
                                            required
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm font-medium whitespace-nowrap">סוג:</label>
                                        <Select
                                            value={editingArmoryItem ? editingArmoryItem.סוג : newArmoryItem.סוג}
                                            onValueChange={(value) => {
                                                if (editingArmoryItem) {
                                                    setEditingArmoryItem((prev: any) => ({...prev, סוג: value}));
                                                } else {
                                                    setNewArmoryItem((prev) => ({...prev, סוג: value}));
                                                }
                                            }}
                                        >
                                            <SelectTrigger className="w-28 text-right">
                                                <SelectValue placeholder="בחר סוג" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {uniqueCategories.length > 0 ? (
                                                    uniqueCategories.map(category => (
                                                        <SelectItem key={category} value={category}>
                                                            {category}
                                                        </SelectItem>
                                                    ))
                                                ) : (
                                                    <>
                                                        <SelectItem value="נשק">נשק</SelectItem>
                                                        <SelectItem value="אמרל">אמרל</SelectItem>
                                                        <SelectItem value="אופטיקה">אופטיקה</SelectItem>
                                                        <SelectItem value="כוונת">כוונת</SelectItem>
                                                        <SelectItem value="ציוד">ציוד</SelectItem>
                                                    </>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="flex justify-end space-x-2">
                                    {editingArmoryItem && (
                                        <button
                                            type="button"
                                            onClick={() => setEditingArmoryItem(null)}
                                            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-6 rounded ml-2"
                                        >
                                            ביטול
                                        </button>
                                    )}
                                    <button
                                        type="submit"
                                        className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded"
                                    >
                                        {editingArmoryItem ? 'עדכן' : 'הוסף'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Armory Items Tables - Grouped by Type */}
                    {armoryItems.length > 0 ? (
                        <div className="space-y-6">
                            {/* Dynamically render tables for each category */}
                            {uniqueCategories.map(category => {
                                const categoryItems = armoryItems.filter(item => item.סוג === category);
                                if (categoryItems.length === 0) return null;

                                return (
                                    <div key={category}>
                                        <h4 className="text-lg font-bold mb-2 text-right">{category}</h4>
                                        <div className="overflow-x-auto">
                                            <table className="min-w-full bg-white border border-gray-300">
                                                <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="py-2 px-4 border-b text-right">אמצעי</th>
                                                    <th className="py-2 px-4 border-b text-right">חתימה</th>
                                                    <th className="py-2 px-4 border-b text-right">פעולות</th>
                                                </tr>
                                                </thead>
                                                <tbody>
                                                {categoryItems.map((item) => (
                                                    <tr key={item.אמצעי} className="hover:bg-gray-50">
                                                        <td className="py-2 px-4 border-b text-right">{item.אמצעי}</td>
                                                        <td className="py-2 px-4 border-b text-right">{item.חתימה}</td>
                                                        <td className="py-2 px-4 border-b text-right">
                                                            <button
                                                                onClick={() => {
                                                                    setEditingArmoryItem(item);
                                                                    setShowArmoryForm(false);
                                                                }}
                                                                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm ml-2"
                                                            >
                                                                ערוך
                                                            </button>
                                                            <button
                                                                onClick={() => deleteArmoryItem(item.אמצעי)}
                                                                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                                                            >
                                                                מחק
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-center py-4">אין אמצעים להצגה</p>
                    )}
                </div>
            )}

            <MiniConfirm
                open={miniConfirmOpen}
                message={`האם אתה בטוח שברצונך למחוק אמצעי זה?\n${itemToDelete}`}
                confirmText="מחק"
                cancelText="בטל"
                onConfirm={performDeleteArmoryItem}
                onCancel={() => {
                    setMiniConfirmOpen(false);
                    setItemToDelete("");
                }}
            />
        </div>
    );
};

export default AdminPage;
