"use client";

import React, {useEffect, useState, useRef, useMemo} from "react";
import {supabase} from "@/lib/supabaseClient"
import {AgGridReact} from "ag-grid-react";
import {useNavigate} from "react-router-dom";
import SignatureCanvas from "react-signature-canvas";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import StatusMessageProps from "@/components/feedbackFromBackendOrUser/StatusMessageProps";
import {usePermissions} from "@/contexts/PermissionsContext";

type SignaturePad = SignatureCanvas | null;

const AdminPage = () => {

    const navigate = useNavigate();
    const sigPadRef = useRef<SignaturePad>(null);
    const tableContainerRef = useRef<HTMLDivElement>(null);
    const registrationTableRef = useRef<HTMLDivElement>(null);
    const {permissions} = usePermissions();
    const [rowData, setRowData] = useState<any[]>([]);
    const [registrationData, setRegistrationData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [registrationLoading, setRegistrationLoading] = useState(true);
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
        signature: "", // Add signature field
        companyPermission: "", // Dropdown for company permissions
    });

    // User search state for delete form
    const [userSearchQuery, setUserSearchQuery] = useState("");
    const [filteredUsers, setFilteredUsers] = useState<any[]>([]);

    // Filter users based on search query
    useEffect(() => {
        if (userSearchQuery.trim() === "") {
            setFilteredUsers([]);
        } else {
            const query = userSearchQuery.toLowerCase();
            const filtered = rowData.filter(user => 
                user.email.toLowerCase().includes(query) ||
                user.name.toLowerCase().includes(query)
            );
            setFilteredUsers(filtered);
        }
    }, [userSearchQuery, rowData]);

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

    // Column definitions with # counter first
    const columnDefs = useMemo(() => [
        {
            headerName: "#",
            valueGetter: (params: any) => {
                return params.node?.rowIndex != null ? params.node.rowIndex + 1 : '';
            },
            sortable: false,
            filter: false,
            width: 70,
            pinned: 'right' as const,
        },
        {field: "name", headerName: "שם", width: 150, filter: 'agTextColumnFilter', filterParams: { filterOptions: ['contains'], defaultOption: 'contains' }},
        {
            field: "email",
            headerName: "אימייל",
            width: 200,
            filter: 'agTextColumnFilter',
            filterParams: { filterOptions: ['contains'], defaultOption: 'contains' },
            cellStyle: {
                textAlign: 'right',
                userSelect: 'text',
                cursor: 'text'
            }
        },
        {field: "id", headerName: "מספר אישי", width: 120, filter: 'agNumberColumnFilter'},
        {
            headerName: "הרשאות",
            width: 350,
            filter: 'agTextColumnFilter',
            filterParams: { filterOptions: ['contains'], defaultOption: 'contains' },
            valueGetter: (params: any) => {
                const user = params.data;
                const permissions = [];
                if (user.admin) permissions.push('מנהל');
                if (user.armory) permissions.push('נשקיה');
                if (user.logistic) permissions.push('לוגיסטיקה');
                if (user.ammo) permissions.push('תחמושת');
                if (user.א) permissions.push('א');
                if (user.ב) permissions.push('ב');
                if (user.ג) permissions.push('ג');
                if (user.מסייעת) permissions.push('מסייעת');
                if (user.אלון) permissions.push('אלון');
                if (user.מכלול) permissions.push('מכלול');
                if (user.פלסם) permissions.push('פלסם');
                return permissions.join(', ');
            }
        },
    ], []);

    // Default column definition to ensure consistent alignment
    const defaultColDef = useMemo(() => ({
        headerClass: 'ag-right-aligned-header',
        cellStyle: {textAlign: 'right'},
        resizable: true,
        sortable: true,
    }), []);

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

    const fetchRegistrations = async () => {
        if (permissions['admin']) {
            const {data, error} = await supabase.from("registration").select("*");

            if (error) {
                console.error("Supabase fetch error:", error);
                setStatusMessage({text: `Error fetching registrations: ${error.message}`, type: "error"});
            } else {
                setRegistrationData(data || []);
            }

            setRegistrationLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
        fetchRegistrations();
    }, []);

    // Scroll table to the right on mount and when data changes
    useEffect(() => {
        if (tableContainerRef.current) {
            // Scroll to the right (start position for RTL)
            tableContainerRef.current.scrollLeft = tableContainerRef.current.scrollWidth;
        }
    }, [rowData]);

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

    const handleNewUserChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const {name, value, type} = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        
        const companyPermissions = ['א', 'ב', 'ג', 'מסייעת', 'אלון', 'פלסם', 'מכלול'];
        const otherPermissions = ['admin', 'armory', 'logistic', 'ammo'];
        
        let finalValue: any;
        if (type === 'checkbox') {
            finalValue = checked;
            
            // If checking a company permission, uncheck ALL other permissions
            if (checked && companyPermissions.includes(name)) {
                setNewUser(prev => {
                    const updated = {...prev, [name]: true};
                    // Uncheck all other company permissions
                    companyPermissions.forEach(perm => {
                        if (perm !== name) {
                            (updated as any)[perm] = false;
                        }
                    });
                    // Uncheck all other permissions (admin, armory, logistic, ammo)
                    otherPermissions.forEach(perm => {
                        (updated as any)[perm] = false;
                    });
                    return updated;
                });
                return; // Exit early since we already set the state
            }
            
            // If checking admin/armory/logistic/ammo, uncheck all company permissions
            if (checked && otherPermissions.includes(name)) {
                setNewUser(prev => {
                    const updated = {...prev, [name]: true};
                    // Uncheck all company permissions and reset dropdown
                    companyPermissions.forEach(perm => {
                        (updated as any)[perm] = false;
                    });
                    (updated as any).companyPermission = '';
                    return updated;
                });
                return; // Exit early since we already set the state
            }
        } else if (name === 'id') {
            // Handle numeric id field
            finalValue = value === '' ? null : parseInt(value, 10);
        } else {
            finalValue = value;
        }
        
        setNewUser(prev => ({
            ...prev,
            [name]: finalValue
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
        
        // Validate company permissions - only one allowed and cannot be combined with other permissions
        const companyPermissions = ['א', 'ב', 'ג', 'מסייעת', 'אלון', 'פלסם', 'מכלול'];
        const otherPermissions = ['admin', 'armory', 'logistic', 'ammo'];
        const selectedCompanies = companyPermissions.filter(perm => newUser[perm as keyof typeof newUser]);
        const selectedOthers = otherPermissions.filter(perm => newUser[perm as keyof typeof newUser]);
        
        if (selectedCompanies.length > 1) {
            setStatusMessage({text: "ניתן לבחור רק פלוגה אחת (א, ב, ג, מסייעת, אלון, פלסם, מכלול)", type: "error"});
            formValid = false;
        }
        
        // Check if company permission is combined with other permissions
        if (selectedCompanies.length > 0 && selectedOthers.length > 0) {
            setStatusMessage({text: "לא ניתן לשלב הרשאת פלוגה (א, ב, ג, מסייעת, אלון, פלסם, מכלול) עם הרשאות אחרות", type: "error"});
            formValid = false;
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
                const successMsg = `המשתמש ${newUser.name} (אימייל: ${newUser.email}) נוסף בהצלחה`;
                setStatusMessage({text: successMsg, type: "success"});
                
                // Log to armory_document
                await supabase.from('armory_document').insert({
                    'משתמש': permissions['name'] ? String(permissions['name']) : 'Admin',
                    'תאריך': new Date().toLocaleString('he-IL'),
                    'הודעה': successMsg
                });
                
                setNewUser({
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
                    companyPermission: "",
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
                    const deletedUser = data[0];
                    const successMsg = `המשתמש ${deletedUser.name || emailToDelete} (אימייל: ${emailToDelete}) נמחק בהצלחה`;
                    setStatusMessage({text: successMsg, type: "success"});
                    
                    // Log to armory_document
                    await supabase.from('armory_document').insert({
                        'משתמש': permissions['name'] ? String(permissions['name']) : 'Admin',
                        'תאריך': new Date().toLocaleString('he-IL'),
                        'הודעה': successMsg
                    });
                    
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

    const approveRegistration = async (registration: any) => {
        if (!window.confirm(`האם לאשר את הבקשה של ${registration.name}?`)) {
            return;
        }

        setRegistrationLoading(true);
        setStatusMessage({text: "", type: ""});

        try {
            // Add to users table
            const {data: userData, error: userError} = await supabase
                .from("users")
                .insert([registration])
                .select();

            if (userError) {
                setStatusMessage({text: `שגיאה בהוספת משתמש: ${userError.message}`, type: "error"});
                setRegistrationLoading(false);
                return;
            }

            // Delete from registration table
            const {error: deleteError} = await supabase
                .from("registration")
                .delete()
                .eq("id", registration.id);

            if (deleteError) {
                setStatusMessage({text: `שגיאה במחיקת בקשה: ${deleteError.message}`, type: "error"});
                setRegistrationLoading(false);
                return;
            }

            const successMsg = `בקשת ההרשמה של ${registration.name} (${registration.email}) אושרה `;
            setStatusMessage({text: successMsg, type: "success"});

            // Log to armory_document
            await supabase.from('armory_document').insert({
                'משתמש': permissions['name'] ? String(permissions['name']) : 'Admin',
                'תאריך': new Date().toLocaleString('he-IL'),
                'הודעה': successMsg
            });

            // Remove from UI immediately
            setRegistrationData(prev => prev.filter(r => r.id !== registration.id));
            await fetchUsers();
        } catch (err: any) {
            setStatusMessage({text: `Error: ${err.message}`, type: "error"});
        } finally {
            setRegistrationLoading(false);
        }
    };

    const rejectRegistration = async (registration: any) => {
        if (!window.confirm(`האם לדחות את הבקשה של ${registration.name}?`)) {
            return;
        }

        setRegistrationLoading(true);
        setStatusMessage({text: "", type: ""});

        try {
            const {error} = await supabase
                .from("registration")
                .delete()
                .eq("id", registration.id);

            if (error) {
                setStatusMessage({text: `שגיאה במחיקת בקשה: ${error.message}`, type: "error"});
            } else {
                const successMsg = `בקשת ההרשמה של ${registration.name} (${registration.email}) נדחתה ונמחקה`;
                setStatusMessage({text: successMsg, type: "success"});

                // Log to armory_document
                await supabase.from('armory_document').insert({
                    'משתמש': permissions['name'] ? String(permissions['name']) : 'Admin',
                    'תאריך': new Date().toLocaleString('he-IL'),
                    'הודעה': successMsg
                });

                // Remove from UI immediately
                setRegistrationData(prev => prev.filter(r => r.id !== registration.id));
            }
        } catch (err: any) {
            setStatusMessage({text: `Error: ${err.message}`, type: "error"});
        } finally {
            setRegistrationLoading(false);
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
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                            <div>
                                <label className="block text-sm font-medium text-right">מספר אישי</label>
                                <input
                                    type="number"
                                    name="id"
                                    value={newUser.id || ''}
                                    onChange={handleNewUserChange}
                                    className="mt-1 p-2 block w-full border border-gray-300 rounded text-right"
                                />
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
                        
                        {/* Admin Checkbox */}
                        <div className="mb-4">
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

                        {/* Armory, Logistic, Ammo Checkboxes */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div className="flex items-center space-x-2">
                                <label className="flex items-center space-x-2 text-right">
                                    <input
                                        type="checkbox"
                                        name="armory"
                                        checked={newUser.armory}
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
                                        name="logistic"
                                        checked={newUser.logistic}
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
                                        name="ammo"
                                        checked={newUser.ammo}
                                        onChange={handleNewUserChange}
                                        className="ml-2"
                                    />
                                    תחמושת
                                </label>
                            </div>
                        </div>

                        {/* Company Permissions Dropdown */}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-right mb-2">פלוגה</label>
                            <select
                                name="companyPermission"
                                value={newUser.companyPermission}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    const companyPermissions = ['א', 'ב', 'ג', 'מסייעת', 'אלון', 'פלסם', 'מכלול'];
                                    const otherPermissions = ['admin', 'armory', 'logistic', 'ammo'];
                                    
                                    setNewUser(prev => {
                                        const updated = {...prev, companyPermission: value};
                                        
                                        // Reset all company checkboxes
                                        companyPermissions.forEach(perm => {
                                            (updated as any)[perm] = false;
                                        });
                                        
                                        // If a company is selected, set it and uncheck other permissions
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
                    <form onSubmit={deleteUser} className="space-y-4">
                        <div className="relative">
                            <label className="block text-sm font-medium text-right mb-2">חפש משתמש (לפי אימייל או שם)</label>
                            <input
                                type="text"
                                value={userSearchQuery}
                                onChange={(e) => setUserSearchQuery(e.target.value)}
                                className="p-2 block w-full border border-gray-300 rounded text-right"
                                placeholder="הקלד אימייל או שם..."
                                dir="rtl"
                            />
                            {filteredUsers.length > 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto">
                                    {filteredUsers.map((user) => (
                                        <div
                                            key={user.email}
                                            className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100"
                                            onClick={() => {
                                                setEmailToDelete(user.email);
                                                setUserSearchQuery("");
                                                setFilteredUsers([]);
                                            }}
                                        >
                                            <div className="text-right">
                                                <div className="font-semibold">{user.name}</div>
                                                <div className="text-sm text-gray-600">{user.email}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-right mb-2">אימייל נבחר למחיקה</label>
                            <input
                                type="email"
                                value={emailToDelete}
                                onChange={(e) => setEmailToDelete(e.target.value)}
                                className="p-2 block w-full border border-gray-300 rounded text-right"
                                placeholder="example@example.com"
                                required
                                dir="rtl"
                            />
                        </div>
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded"
                            >
                                מחק משתמש
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* User Cards Section - Moved above table */}
            <div className="mb-8 space-y-6">
                {/* מנהלים Users - First */}
                {rowData.filter(u => u.admin).length > 0 && (
                    <div>
                        <h2 className="text-xl font-bold mb-4 text-right">מנהלים</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                            {rowData.filter(u => u.admin).map(user => (
                                <div key={user.email} className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-3 shadow-md hover:shadow-lg transition-shadow">
                                    <div className="text-white text-right">
                                        <div className="font-bold text-sm truncate">{user.name}</div>
                                        <div className="text-xs opacity-90 truncate">{user.email}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* נשקיה Users */}
                {rowData.filter(u => u.armory).length > 0 && (
                    <div>
                        <h2 className="text-xl font-bold mb-4 text-right">נשקיה</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                            {rowData.filter(u => u.armory).map(user => (
                                <div key={user.email} className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-3 shadow-md hover:shadow-lg transition-shadow">
                                    <div className="text-white text-right">
                                        <div className="font-bold text-sm truncate">{user.name}</div>
                                        <div className="text-xs opacity-90 truncate">{user.email}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* לוגיסטיקה Users */}
                {rowData.filter(u => u.logistic).length > 0 && (
                    <div>
                        <h2 className="text-xl font-bold mb-4 text-right">לוגיסטיקה</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                            {rowData.filter(u => u.logistic).map(user => (
                                <div key={user.email} className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-3 shadow-md hover:shadow-lg transition-shadow">
                                    <div className="text-white text-right">
                                        <div className="font-bold text-sm truncate">{user.name}</div>
                                        <div className="text-xs opacity-90 truncate">{user.email}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* תחמושת Users */}
                {rowData.filter(u => u.ammo).length > 0 && (
                    <div>
                        <h2 className="text-xl font-bold mb-4 text-right">תחמושת</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                            {rowData.filter(u => u.ammo).map(user => (
                                <div key={user.email} className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-3 shadow-md hover:shadow-lg transition-shadow">
                                    <div className="text-white text-right">
                                        <div className="font-bold text-sm truncate">{user.name}</div>
                                        <div className="text-xs opacity-90 truncate">{user.email}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Additional User Cards Section - Company permissions */}
            <div className="mt-8 space-y-6">

                {/* Company א */}
                {rowData.filter(u => u.א).length > 0 && (
                    <div>
                        <h2 className="text-xl font-bold mb-4 text-right">פלוגה א</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                            {rowData.filter(u => u.א).map(user => (
                                <div key={user.email} className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-3 shadow-md hover:shadow-lg transition-shadow">
                                    <div className="text-white text-right">
                                        <div className="font-bold text-sm truncate">{user.name}</div>
                                        <div className="text-xs opacity-90 truncate">{user.email}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Company ב */}
                {rowData.filter(u => u.ב).length > 0 && (
                    <div>
                        <h2 className="text-xl font-bold mb-4 text-right">פלוגה ב</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                            {rowData.filter(u => u.ב).map(user => (
                                <div key={user.email} className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg p-3 shadow-md hover:shadow-lg transition-shadow">
                                    <div className="text-white text-right">
                                        <div className="font-bold text-sm truncate">{user.name}</div>
                                        <div className="text-xs opacity-90 truncate">{user.email}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Company ג */}
                {rowData.filter(u => u.ג).length > 0 && (
                    <div>
                        <h2 className="text-xl font-bold mb-4 text-right">פלוגה ג</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                            {rowData.filter(u => u.ג).map(user => (
                                <div key={user.email} className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg p-3 shadow-md hover:shadow-lg transition-shadow">
                                    <div className="text-white text-right">
                                        <div className="font-bold text-sm truncate">{user.name}</div>
                                        <div className="text-xs opacity-90 truncate">{user.email}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Company מסייעת */}
                {rowData.filter(u => u.מסייעת).length > 0 && (
                    <div>
                        <h2 className="text-xl font-bold mb-4 text-right">פלוגה מסייעת</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                            {rowData.filter(u => u.מסייעת).map(user => (
                                <div key={user.email} className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg p-3 shadow-md hover:shadow-lg transition-shadow">
                                    <div className="text-white text-right">
                                        <div className="font-bold text-sm truncate">{user.name}</div>
                                        <div className="text-xs opacity-90 truncate">{user.email}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Company אלון */}
                {rowData.filter(u => u.אלון).length > 0 && (
                    <div>
                        <h2 className="text-xl font-bold mb-4 text-right">פלוגה אלון</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                            {rowData.filter(u => u.אלון).map(user => (
                                <div key={user.email} className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-lg p-3 shadow-md hover:shadow-lg transition-shadow">
                                    <div className="text-white text-right">
                                        <div className="font-bold text-sm truncate">{user.name}</div>
                                        <div className="text-xs opacity-90 truncate">{user.email}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Company מכלול */}
                {rowData.filter(u => u.מכלול).length > 0 && (
                    <div>
                        <h2 className="text-xl font-bold mb-4 text-right">פלוגה מכלול</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                            {rowData.filter(u => u.מכלול).map(user => (
                                <div key={user.email} className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg p-3 shadow-md hover:shadow-lg transition-shadow">
                                    <div className="text-white text-right">
                                        <div className="font-bold text-sm truncate">{user.name}</div>
                                        <div className="text-xs opacity-90 truncate">{user.email}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Company פלסם */}
                {rowData.filter(u => u.פלסם).length > 0 && (
                    <div>
                        <h2 className="text-xl font-bold mb-4 text-right">פלוגה פלסם</h2>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                            {rowData.filter(u => u.פלסם).map(user => (
                                <div key={user.email} className="bg-gradient-to-br from-lime-500 to-lime-600 rounded-lg p-3 shadow-md hover:shadow-lg transition-shadow">
                                    <div className="text-white text-right">
                                        <div className="font-bold text-sm truncate">{user.name}</div>
                                        <div className="text-xs opacity-90 truncate">{user.email}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* AG Grid Table - Moved to bottom */}
            <div ref={tableContainerRef} className="ag-theme-alpine w-full h-[40vh] mt-8 overflow-x-auto" style={{direction: "rtl"}}>
                <style>
                    {`
                    .ag-right-aligned-header .ag-header-cell-label {
                        justify-content: flex-end;
                    }
                    `}
                </style>
                <AgGridReact
                    rowData={rowData}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    suppressColumnVirtualisation={true}
                    domLayout="normal"
                    enableRtl={true}
                    onFirstDataRendered={onFirstDataRendered}
                    getRowStyle={(params) => {
                        if (params.node.rowIndex != null && params.node.rowIndex % 2 === 1) {
                            return { background: '#e3f2fd' };
                        }
                        return undefined;
                    }}
                />
            </div>

            {/* Registration Requests Section */}
            {permissions['admin'] && (
                <div className="mt-12">
                    <h2 className="text-2xl font-bold mb-4 text-right">בקשות הרשמה ממתינות</h2>
                    
                    {registrationLoading ? (
                        <div className="flex flex-col items-center justify-center h-[20vh]">
                            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                            <p className="text-center p-4">טוען בקשות...</p>
                        </div>
                    ) : registrationData.length === 0 ? (
                        <div className="bg-gray-100 rounded-lg p-8 text-center">
                            <p className="text-gray-600 text-lg">אין בקשות הרשמה ממתינות</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {registrationData.map((registration) => (
                                <div key={registration.id} className="bg-white border-2 border-gray-200 rounded-lg p-6 shadow-md hover:shadow-lg transition-shadow">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                        <div className="text-right">
                                            <span className="font-semibold text-gray-700">שם:</span>
                                            <p className="text-lg">{registration.name}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-semibold text-gray-700">אימייל:</span>
                                            <p className="text-lg">{registration.email}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-semibold text-gray-700">מספר אישי:</span>
                                            <p className="text-lg">{registration.id || 'לא צוין'}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-semibold text-gray-700">הרשאות מבוקשות:</span>
                                            <p className="text-lg">
                                                {[
                                                    registration.admin && 'מנהל',
                                                    registration.armory && 'נשקיה',
                                                    registration.logistic && 'לוגיסטיקה',
                                                    registration.ammo && 'תחמושת',
                                                    registration.א && 'א',
                                                    registration.ב && 'ב',
                                                    registration.ג && 'ג',
                                                    registration.מסייעת && 'מסייעת',
                                                    registration.אלון && 'אלון',
                                                    registration.מכלול && 'מכלול',
                                                    registration.פלסם && 'פלסם'
                                                ].filter(Boolean).join(', ') || 'אין'}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {registration.signature && (
                                        <div className="mb-4 text-right">
                                            <span className="font-semibold text-gray-700">חתימה:</span>
                                            <div className="mt-2 border border-gray-300 rounded p-2 inline-block">
                                                <img src={registration.signature} alt="חתימה" className="h-20" />
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="flex justify-end gap-3 mt-4">
                                        <button
                                            onClick={() => rejectRegistration(registration)}
                                            className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded transition-colors"
                                        >
                                            דחה
                                        </button>
                                        <button
                                            onClick={() => approveRegistration(registration)}
                                            className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded transition-colors"
                                        >
                                            אשר והוסף למשתמשים
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

        </div>
    );
};

export default AdminPage;
