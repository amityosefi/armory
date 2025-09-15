import React, {useMemo, useEffect, useState, useRef} from "react";
import SignatureCanvas from "react-signature-canvas";
import {useGoogleSheetData} from "./hooks/useGoogleSheetData";
import Select from "react-select";
import {sheetGroups} from "@/constants";
import CreatableSelect from 'react-select/creatable';


interface AssignWeaponProps {
    accessToken: string;
    formValues: {
        fullName: string;
        personalNumber: number | any;
        phone: number | any;
        group: number,
        weaponName: string;
        intentionName: string;
        serialNumber: string;
        signature: string;
    };
    setFormValues: React.Dispatch<
        React.SetStateAction<{
            fullName: string;
            personalNumber: number | any;
            phone: number | any;
            group: number,
            weaponName: string;
            intentionName: string;
            serialNumber: string;
            signature: string;
        }>
    >;
    onConfirm: () => void;
    onCancel: () => void;
    setSelectedSerialInfo: (
        info: { value: string; rowIndex: number; colIndex: number } | null
    ) => void;
    setSelectedOptic: React.Dispatch<
        React.SetStateAction<
            {
                label: string;
                rowIndex: number;
                colIndex: number;
            } | null
        >
    >;
    setShowDialog?: (show: boolean) => void;
    setAssignSoldier?: (assign: boolean) => void;
}

const AssignWeapon: React.FC<AssignWeaponProps> = ({
                                                       accessToken,
                                                       formValues,
                                                       setFormValues,
                                                       onConfirm,
                                                       onCancel,
                                                       setSelectedSerialInfo,
                                                       setSelectedOptic,
                                                       setShowDialog,
                                                       setAssignSoldier,

                                                   }) => {
    const {data: opticsData} = useGoogleSheetData(
        {
            accessToken,
            range: "מלאי אופטיקה",
        },
        {
            processData: false,
            enabled: !!accessToken,
        }
    );

    const {data: weaponData} = useGoogleSheetData(
        {
            accessToken,
            range: "מלאי נשקיה",
        },
        {
            processData: false,
            enabled: !!accessToken,
        }
    );

    const {data: peopleData} = useGoogleSheetData(
        {
            accessToken,
            range: "דוח1",
        },
        {
            processData: false,
            enabled: !!accessToken,
        }
    );
    const plugaSheets = sheetGroups.find(group => group.name === "פלוגות")?.sheets || [];

    const peopleOptions = useMemo(() => {
        if (!peopleData?.values || peopleData.values.length < 2) return [];

        const rows = peopleData.values.slice(1); // skip header

        return rows
            .filter((row: any[]) => row[0] && row[1] && row[2]) // filter out rows with missing personal number or names
            .map((row: string[]) => {
                const fullName = `${row[2]} ${row[1]}`; // שם פרטי + שם משפחה
                return {
                    label: fullName,                 // 👈 this will appear in dropdown
                    value: row[0],                   // מספר אישי (personal number)
                    fullName: fullName,
                    personalNumber: Number(row[0]),
                    phone: (row[4] || "").replace(/-/g, ""), // פלאפון
                    group: getGroupIdByName(row[3]),         // פלוגה
                };
            });
    }, [peopleData]);


    function getGroupIdByName(name: string) {
        const match = plugaSheets.find((sheet) => sheet.name === name);
        return match?.id || 0;
    }


    const [serialNumbers, setSerialNumbers] = useState<
        { value: string; rowIndex: number; colIndex: number }[]
    >([]);
    const [opticOptions, setOpticOptions] = useState<
        { label: string; rowIndex: number; colIndex: number }[]
    >([]);

    const modalRef = useRef<HTMLDivElement>(null);
    const sigPadRef = useRef<SignatureCanvas>(null);


    const saveSignature = () => {
        if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
            const dataURL = sigPadRef.current.getCanvas().toDataURL("image/png");
            setFormValues((prev) => ({...prev, signature: dataURL}));
        }
    };


    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onCancel();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [onCancel]);

    useEffect(() => {
        if (!opticsData?.values?.length) return;

        try {
            // @ts-ignore
            const headers = opticsData.values[0];
            const validTypes = ["M5", 'מארס', "מפרו"];
            const newOpticOptions: { label: string; rowIndex: number; colIndex: number }[] = [];

            validTypes.forEach((type) => {
                const colIndex = headers.indexOf(type);
                if (colIndex === -1) return;

                for (let rowIndex = 1; rowIndex < opticsData.values.length; rowIndex++) {
                    // @ts-ignore
                    const cellValue = opticsData.values[rowIndex][colIndex];
                    if (cellValue?.trim()) {
                        newOpticOptions.push({
                            label: `${type}: ${cellValue}`,
                            rowIndex,
                            colIndex,
                        });
                    }
                }
            });

            setOpticOptions(newOpticOptions);
        } catch (error) {
            console.error("Error processing optics data:", error);
        }
    }, [opticsData]);

    useEffect(() => {
        if (!formValues.weaponName || !weaponData?.values?.length) {
            setSerialNumbers([]);
            return;
        }

        // @ts-ignore
        const headers = weaponData.values[0];
        const colIndex = headers.indexOf(formValues.weaponName);
        if (colIndex === -1) {
            setSerialNumbers([]);
            return;
        }
        const serials = weaponData.values
            .slice(1)
            .map((row: any[], i: number) => ({
                value: row[colIndex],
                rowIndex: i + 1,
                colIndex,
            }))
            .filter((s: { value: string; }) => s.value?.trim());

        setSerialNumbers(serials);
    }, [formValues.weaponName, weaponData]);

    const clearSignature = () => {
        sigPadRef.current?.clear();
        setFormValues((prev) => ({...prev, signature: ""}));
    };

    const isFormValid = () =>
        formValues.fullName.trim() &&
        (formValues.personalNumber !== undefined && formValues.personalNumber !== null) &&
        (formValues.phone !== undefined && formValues.phone !== null) &&
        formValues.signature.trim();

    const formatPhone = (raw: string): string => {
        if (raw.length === 10) return `${raw.slice(0, 3)}-${raw.slice(3)}`;
        return raw;
    };

    const handleSubmit = () => {
        if (!peopleData?.values) {
            onConfirm();
            return;
        }
        const phoneStr = formValues.phone.toString();
        const personalNumberStr = formValues.personalNumber.toString();

        const phoneMatch = peopleData.values.some((row: string[]) =>
            row.includes(formatPhone(phoneStr))
        );
        const idMatch = peopleData.values.some((row: string[]) => row.includes(personalNumberStr));

        if (phoneMatch || idMatch) {
            onConfirm();
        } else {
            if (setShowDialog) setShowDialog(true);
            if (setAssignSoldier) setAssignSoldier(false);
        }
    };

    // @ts-ignore
    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 flex items-start sm:items-center justify-center z-50 overflow-y-auto">
            <div
                ref={modalRef}
                className="bg-white p-4 sm:p-6 rounded-lg shadow-lg w-full max-w-md my-4 sm:my-0 max-h-[90vh] overflow-y-auto"
            >
                <h2 className="text-lg font-bold mb-4 text-right">החתמת חייל - {plugaSheets.find(p => p.id === formValues.group)?.name || ''}</h2>
                <div className="space-y-4">
                    {/* Full Name */}
                    <div>
                        <label className="block text-right font-medium">שם מלא של החייל</label>
                        <CreatableSelect
                            options={peopleOptions}
                            getOptionLabel={(option: any) => option.label}
                            getOptionValue={(option: any) => option.value}
                            onChange={(selectedOption) => {
                                if (!selectedOption) {
                                    setFormValues({ ...formValues, fullName: '' });
                                    return;
                                }

                                // If selectedOption is a new value typed by the user (Creatable)
                                if (typeof selectedOption === 'string' || !selectedOption.fullName) {
                                    setFormValues({
                                        ...formValues,
                                        fullName: selectedOption.label || ''
                                    });
                                    return;
                                }

                                // Selected an existing option
                                setFormValues({
                                    ...formValues,
                                    fullName: selectedOption.fullName,
                                    personalNumber: selectedOption.personalNumber,
                                    phone: selectedOption.phone,
                                    group: selectedOption.group,
                                });
                            }}
                            isClearable
                            placeholder="שם החייל"
                        />
                    </div>


                    {/* Personal Number */}
                    <div>
                        <label className="block text-right font-medium">מספר אישי</label>
                        <input
                            type="text"
                            className="w-full border p-2 rounded text-right"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={formValues.personalNumber?.toString() || ""}
                            onChange={(e) => {
                                const value = e.target.value.replace(/\D/g, "");
                                setFormValues((prev) => ({...prev, personalNumber: Number(value)}));
                            }}
                        />
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-right font-medium">פלאפון</label>
                        <input
                            type="text"
                            className="w-full border p-2 rounded text-right"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={formValues.phone || ""}
                            onChange={(e) => {
                                const value = e.target.value;
                                if (/^\d*$/.test(value)) {
                                    setFormValues((prev) => ({...prev, phone: value}));
                                }
                            }}
                        />
                    </div>

                    {/* Group */}
                    <div>
                        <label className="block text-right font-medium">בחר פלוגה</label>
                        <select
                            className="w-full border p-2 rounded text-right"
                            value={formValues.group}
                            onChange={(e) => setFormValues({...formValues, group: Number(e.target.value)})}
                        >
                            <option value={0} disabled>בחר פלוגה</option>
                            {plugaSheets.map(sheet => (
                                <option key={sheet.id} value={sheet.id}>
                                    {sheet.name}
                                </option>
                            ))}
                        </select>
                    </div>


                    {/* Weapon Type */}
                    <div>
                        <label className="block text-right font-medium">סוג נשק</label>
                        <select
                            className="w-full border p-2 rounded text-right"
                            value={formValues.weaponName}
                            onChange={(e) =>
                                setFormValues((prev) => ({...prev, weaponName: e.target.value, serialNumber: ""}))
                            }
                        >
                            <option value="">בחר סוג נשק</option>
                            {weaponData?.values?.[0]?.map((w: string, i: number) => (
                                <option key={i} value={w}>
                                    {w}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-right font-medium">מספר סידורי</label>
                        <Select
                            className="text-right"
                            options={serialNumbers.map((s) => ({value: s.value, label: s.value}))}
                            value={
                                serialNumbers.find((s) => s.value === formValues.serialNumber)
                                    ? {value: formValues.serialNumber, label: formValues.serialNumber}
                                    : null
                            }
                            onChange={(selectedOption) => {
                                if (selectedOption) {
                                    const selected = serialNumbers.find(
                                        (s) => s.value === selectedOption.value
                                    ) || null;
                                    setSelectedSerialInfo(selected);
                                    setFormValues((prev) => ({...prev, serialNumber: selectedOption.value}));
                                } else {
                                    setSelectedSerialInfo(null);
                                    setFormValues((prev) => ({...prev, serialNumber: ""}));
                                }
                            }}
                            isClearable
                            placeholder="בחר מספר סידורי"
                            noOptionsMessage={() => "לא נמצאו אפשרויות"}
                        />
                    </div>

                    <div>
                        <label className="block text-right font-medium">סוג כוונת</label>
                        <Select
                            className="text-right"
                            options={opticOptions.map((opt) => ({
                                value: `${opt.rowIndex}-${opt.colIndex}`,
                                label: opt.label,
                            }))}
                            value={
                                opticOptions.find((s) => s.label === formValues.intentionName)
                                    ? {value: formValues.intentionName, label: formValues.intentionName}
                                    : null
                            }
                            onChange={(selectedOption) => {
                                if (!selectedOption) {
                                    setSelectedOptic(null);
                                    setFormValues((prev) => ({...prev, intentionName: ""}));
                                    return;
                                }

                                const [rowIndexStr, colIndexStr] = selectedOption.value.split("-");
                                const rowIndex = parseInt(rowIndexStr, 10);
                                const colIndex = parseInt(colIndexStr, 10);

                                const chosen = opticOptions.find(
                                    (opt) => opt.rowIndex === rowIndex && opt.colIndex === colIndex
                                );

                                if (chosen) {
                                    setSelectedOptic(chosen);
                                    setFormValues((prev) => ({
                                        ...prev,
                                        intentionName: chosen.label,
                                    }));
                                }
                            }}
                            isClearable
                            placeholder="בחר כוונת"
                            noOptionsMessage={() => "לא נמצאו אפשרויות"}
                        />
                    </div>


                    {/* Signature */}
                    <div>
                        <label className="block text-right font-medium mb-1">חתימה</label>
                        <SignatureCanvas
                            ref={sigPadRef}
                            penColor="black"
                            onEnd={saveSignature}  // Automatically saves when drawing ends
                            canvasProps={{
                                width: 300,
                                height: 150,
                                className: "border border-gray-300 rounded",
                                style: {direction: "ltr"},
                            }}
                            clearOnResize={false}
                            backgroundColor="white"
                        />
                        <div className="mt-2 flex justify-end">
                            <button
                                type="button"
                                onClick={clearSignature}
                                className="text-sm text-red-600 hover:underline"
                            >
                                נקה חתימה
                            </button>
                        </div>
                    </div>


                    {/* Buttons */}
                    <div className="flex justify-between mt-6">
                        <button
                            type="button"
                            className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                            onClick={onCancel}
                        >
                            ביטול
                        </button>
                        <button
                            type="button"
                            disabled={!isFormValid()}
                            className={`px-4 py-2 rounded text-white ${
                                isFormValid() ? "bg-blue-600 hover:bg-blue-700" : "bg-blue-300 cursor-not-allowed"
                            }`}
                            onClick={handleSubmit}
                        >
                            אשר
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssignWeapon;
