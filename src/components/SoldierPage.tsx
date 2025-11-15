// src/pages/SoldierPage.tsx
import React, {useEffect, useState, Fragment} from "react";
import { useNavigate, useParams} from "react-router-dom";
import {useGoogleSheetData} from "./hooks/useGoogleSheetData";
import Spinner from "./Spinner";
import {sheetGroups} from "../constants";
import GoogleSheetsService from "../services/GoogleSheetsService";
import {jsPDF} from "jspdf";
import autoTable from "jspdf-autotable";
import StatusMessageProps from "./feedbackFromBackendOrUser/StatusMessageProps";
import StandaloneComboBox from "./StandaloneComboBox";
import {usePermissions} from "@/contexts/PermissionsContext";

interface SoldierCardPageProps {
    accessToken: string;
}

const SoldierPage: React.FC<SoldierCardPageProps> = ({accessToken}) => {
        // const location = useLocation();

        // @ts-ignore
        const {
            data: opticsData, refetch: refetchOptics
        } = useGoogleSheetData(
            {
                accessToken,
                range: "מלאי אופטיקה"
            },
            {
                // Don't process data here, we'll do it with custom logic below
                processData: false,
                enabled: !!accessToken
            }
        );
        const {
            data: weaponsData, refetch: refetchWeapons
        } = useGoogleSheetData(
            {
                accessToken,
                range: "מלאי נשקיה"
            },
            {
                // Don't process data here, we'll do it with custom logic below
                processData: false,
                enabled: !!accessToken
            }
        );

        const [showMessage, setShowMessage] = useState(false);
        const [isSuccess, setIsSuccess] = useState(false);
        const [message, setMessage] = useState('');
        const { permissions } = usePermissions();
        const userEmail = localStorage.getItem('userEmail')

        const [selectedOpticColumn, setSelectedOpticColumn] = useState<{
            value: string;
            colIndex: number;
            rowIndex: number;
        } | null>(null);
        const [selectedOpticPair, setSelectedOpticPair] = useState<string>('');

        const [secondOptions, setSecondOptions] = useState<
            { value: string; rowIndex: number; colIndex: number }[]
        >([]);
        const [selectedSecondOption, setSelectedSecondOption] = useState<{
            value: string;
            rowIndex: number;
            colIndex: number;
        } | null>(null);
        const [dropdownOptions, setDropdownOptions] = useState<{ rowIndex: number, colIndex: number, value: string }[]>([]);
        const [filteredOpticOptions, setFilteredOpticOptions] = useState<typeof dropdownOptions>([]);
        const [soldierOptics, setSoldierOptics] = useState<{ key: string; value: string }[]>([]);

        const navigate = useNavigate();
        const {sheetName, soldierIndex} = useParams();

        const comboBoxOptions = filteredOpticOptions.map(opt => ({
            label: opt.value,
            value: opt.value,
        }));


        const soldierRange = sheetName ? `${sheetName}!A${soldierIndex}:BBB${soldierIndex}` : '';
        const {data, isLoading: isLoadingSoldier, refetch} = useGoogleSheetData(
            {accessToken, range: soldierRange},
            {processData: false, enabled: !!accessToken}
        );

        const [opticRows, setOpticRows] = useState<{ name: string; masad: string }[]>([]);

        const headerRange = sheetName ? `${sheetName}!A1:BBB1` : '';
        const {data: headerData, isLoading: isLoadingHeaders} = useGoogleSheetData(
            {accessToken, range: headerRange},
            {processData: false, enabled: !!accessToken && !!headerRange}
        );


        const [isMutating, setIsMutating] = useState(false);
        const isLoading = isLoadingSoldier || isLoadingHeaders || isMutating;
        let row: Record<string, any> = {};

        if (data?.values && data.values.length > 0) {
            // Fetch headers for mapping

            const headers = headerData?.values?.[0] || [];
            const values = data.values[0];
            headers.forEach((header: string, idx: number) => {
                row[header] = values[idx] || '';
            });
        }

        useEffect(() => {
            if (selectedOpticColumn !== null && opticsData?.values?.length && weaponsData.values?.length) {
                let values;
                // @ts-ignore
                if (weaponsData.values[0].includes(selectedOpticColumn.value)) {
                    values = weaponsData.values.slice(1)
                        .map((row: any[], i: number) => ({
                            value: row[selectedOpticColumn.colIndex],
                            rowIndex: i + 1,
                            colIndex: selectedOpticColumn.colIndex
                        }))
                        .filter((opt: { value: string; }) => opt.value?.trim());
                } else {
                    values = opticsData.values
                        .slice(1)
                        .map((row: any[], i: number) => ({
                            value: row[selectedOpticColumn.colIndex],
                            rowIndex: i + 1,
                            colIndex: selectedOpticColumn.colIndex
                        }))
                        .filter((opt: { value: string; }) => opt.value?.trim());
                }

                // Sort alphabetically by value
                values.sort((a: { value: string; }, b: { value: any; }) => a.value.localeCompare(b.value));

                setSecondOptions(values);
            }
        }, [selectedOpticColumn, opticsData, weaponsData]);



        async function changeNameOrComment(fieldName: string) {
            setIsMutating(true);
            // @ts-ignore
            const val = editableFields[fieldName] || '';
            const rowIndex = parseInt(soldierIndex || '0', 10) - 1;
            const sheetId = sheetGroups.flatMap(group => group.sheets)
                .find(sheet => sheet.range === sheetName)?.id;
            let msg;
            if (sheetName === 'טבלת נשקיה')
                msg = 'חתימה מול החטיבה שונתה ל' + val;
            else
                msg = "חייל " + row["שם מלא"] + " שינה " + fieldName + ': ' + val;
            if (fieldName === 'הערות' || fieldName === 'שם מלא' || fieldName === 'פלאפון' || fieldName === 'מספר אישי') {
                const userEmail = localStorage.getItem('userEmail');
                // Find colIndex dynamically from headers
                const headers = headerData?.values?.[0] || [];
                const colIndex = headers.indexOf(fieldName);
                if (colIndex === -1) {
                    alert('שגיאה: לא נמצא עמודה עבור ' + fieldName);
                    return;
                }

                await GoogleSheetsService.updateCalls({
                    accessToken: accessToken,
                    updates: [{
                        sheetId: sheetId,
                        rowIndex,
                        colIndex,
                        value: editableFields[fieldName] ?? ""
                    }],
                    isArmory: true,
                    appendSheetId: 1070971626,
                    appendValues: [[msg, new Date().toLocaleString('he-IL'), userEmail ? userEmail : ""]]
                });
                refetch();
                setIsMutating(false);
            }

        }

        const mirrorHebrewSmart = (str: string) => {
            if (str === null || str === undefined || str === '') return '';
            return str
                .split(/\s+/)
                .map(word =>
                    /[\u0590-\u05FF]/.test(word) ? word.split('').reverse().join('') : word
                )
                .reverse() // Reverse word order too
                .join(' ');
        };

        const handleDownload = () => {
            const doc = new jsPDF();
            const pageWidth = doc.internal.pageSize.getWidth();
            const margin = 10;
            let y = 10;

            doc.addFont('NotoSansHebrew-normal.ttf', 'NotoSansHebrew', 'normal');
            doc.setFont('NotoSansHebrew');
            doc.setFontSize(12);

            // Title in the center
            doc.setFontSize(18);
            doc.text(mirrorHebrewSmart('טופס חתימת חייל גדוד .1018'), pageWidth / 2, y, {align: 'center'});
            y += 10;

            // Right-up: date and time
            const dateStr = new Date().toLocaleString('he-IL').split(' ');
            doc.setFontSize(10);
            doc.text(mirrorHebrewSmart(`${row['שם מלא'] || ''}`), pageWidth - margin, y, {align: 'right'});
            doc.text(mirrorHebrewSmart('תאריך נוכחי: '), margin, y, {align: 'left'});

            y += 10;
            doc.text(row['מספר אישי'] || '' + " " + mirrorHebrewSmart(`מספר אישי: `), pageWidth - margin, y, {align: 'right'});
            doc.text(dateStr[1] + ' ' + dateStr[0], margin, y, {align: 'left'});

            y += 10;
            doc.text(mirrorHebrewSmart('תאריך חתימה: '), margin, y, {align: 'left'});

            y += 10;
            doc.text(mirrorHebrewSmart(row['זמן חתימה']), margin, y, {align: 'left'});

            // Section: פלוגה + פלאפון
            y += 15;
            // Table with user info

            autoTable(doc, {
                startY: y,
                body: [[
                    mirrorHebrewSmart('שם מלא'),
                    mirrorHebrewSmart('מספר אישי'),
                    mirrorHebrewSmart('פלוגה'),
                    mirrorHebrewSmart('פלאפון')
                ],
                    [
                        mirrorHebrewSmart(row['שם מלא'] || ''),
                        mirrorHebrewSmart(row['מספר אישי'] || ''),
                        mirrorHebrewSmart(String(sheetName)),
                        mirrorHebrewSmart(row['פלאפון'] || '')
                    ]],
                styles: {
                    font: 'NotoSansHebrew',
                    halign: 'right',
                },
                headStyles: {
                    halign: 'right',
                },
                margin: {left: margin, right: margin},
            });

            // Dot notes
            // @ts-ignore
            y = doc.lastAutoTable.finalY + 15;
            const notes = [
                'הנני מצהיר/ה כי ביצעתי מטווח יום + לילה בסוג הנשק הנ״ל שעליו אני חותם.',
                'הנני בקיא בהפעלתו ובהוראות הבטיחות בנושא אחזקת הנשק כולל שימוש במק פורק.',
                'הנשק יוחזר לנשקייה נקי ומשומן - ואחת לחודש יבצע בדיקת נשק.',
                'החייל/ת ביצע/ה בוחן לנשק אישי ובוחן למק פורק.',
                'הנשק ינופק באישור השלישות.',
            ];

            doc.setFontSize(12);
            notes.forEach((line, i) => {
                doc.text(`${mirrorHebrewSmart(line)} •`, pageWidth - margin, y + i * 8, {align: 'right'});
            });


            // Signature label
            // @ts-ignore
            y = doc.lastAutoTable.finalY + 65;
            doc.setFontSize(12);
            doc.text(mirrorHebrewSmart('חתימת החייל'), pageWidth / 2, y, {align: 'center'});

            // Add signature image if available
            // y += 5;
            if (row['חתימה']) {
                try {
                    doc.addImage(row['חתימה'], 'PNG', pageWidth / 2 - 40, y, 80, 50); // Bigger and centered
                } catch (e) {
                    console.error('Error adding signature:', e);
                }
            }

            // Table of all nonempty values (excluding keys we already used)
            y += 55;
            const kvPairs = Object.entries(row)
                .filter(([key, val]) =>
                    val &&
                    !['חתימה', 'rowIndex', 'rowRealIndex', 'מסד', 'מספר אישי', 'שם מלא', 'פלאפון', 'זמן חתימה'].includes(key)
                )
                .map(([key, val]) => {
                        if (key === 'סוג נשק') {
                            const weaponType = String(val).replace(/_/g, ' ');
                            const serialNumber = row['מסד'] || '';
                            return [
                                mirrorHebrewSmart(String(serialNumber)),
                                mirrorHebrewSmart(weaponType)
                            ];
                        }
                            return [
                                mirrorHebrewSmart(String(val)),
                                mirrorHebrewSmart(String(key).replace(/_/g, ' '))
                            ];
                    }
                )
            ;

            autoTable(doc, {
                startY: y,
                body: [...[[mirrorHebrewSmart('מסד'), mirrorHebrewSmart('אמצעי')]], ...kvPairs],
                styles: {font: 'NotoSansHebrew', halign: 'right'},
                margin: {left: margin, right: margin},
            });

            // Save PDF
            const filename = `${row['שם מלא'] || 'חייל'}_${row['מספר אישי'] || 'טופס'}.pdf`;
            doc.save(filename);
        };

        const handleCredit = () => {
            // credit logic here
        };

// Editable fields state
        const [editableFields, setEditableFields] = useState({
            פלאפון: row['פלאפון'] || '',
            הערות: row['הערות'] || '',
            'שם מלא': row['שם מלא'] || '',
            'מספר אישי': row['מספר אישי'] || '',
        });
        const [editingField, setEditingField] = useState<string | null>(null);

// Sync editableFields with row when data loads
        React.useEffect(() => {
            setEditableFields({
                פלאפון: row['פלאפון'] || '',
                הערות: row['הערות'] || '',
                'שם מלא': row['שם מלא'] || '',
                'מספר אישי': row['מספר אישי'] || '',
            });
        }, [row['פלאפון'], row['הערות'], row['שם מלא'], row['מספר אישי']]);

        const handleFieldChange = (field: string, value: string) => {
            setEditableFields(prev => ({...prev, [field]: value}));
        };

        const handleEditField = (field: string) => setEditingField(field);
        const handleSaveField = (field: string) => {
            // Here you would update the data in Google Sheets or backend
            changeNameOrComment(editingField || '');
            setEditingField(null);
        };

        function handleSignOptic() {
            if (!opticsData?.values?.length) return;

            const excludedKeys = [
                "שם מלא",
                "מספר אישי",
                "פלאפון",
                "חתימה",
                "זמן חתימה",
                "כוונת",
                "מסד",
                "הערות"
            ];

            const headerRow = opticsData.values[0];

            // Step 1: find optic keys in the row that are empty
            const nonEmptyFilteredKeys = Object.keys(row).filter(
                key => !excludedKeys.includes(key) && row[key]?.toString().trim() === ''
            );

            // Step 2: get matching optics from header row
            const filteredFromOptics: typeof dropdownOptions = nonEmptyFilteredKeys.map(label => {
                const colIndex = headerRow.indexOf(label);
                return colIndex !== -1 ? {
                    value: label,
                    rowIndex: -1,
                    colIndex,
                } : null;
            }).filter(Boolean) as typeof dropdownOptions;

            // Step 3: if 'סוג נשק' is empty, add weapon options
            let weaponDropdownOptions: typeof dropdownOptions = [];
            if (row['סוג נשק']?.toString().trim() === '' && weaponsData?.values?.length) {
                const weaponHeaders = weaponsData.values[0]; // assuming first row is headers
                weaponDropdownOptions = weaponHeaders.map((weapon: string, colIndex: number) => ({
                    value: weapon,
                    rowIndex: -1,
                    colIndex,
                }));
            }
            // Step 4: update dropdown with merged options
            setFilteredOpticOptions([...filteredFromOptics, ...weaponDropdownOptions]);
            setSelectedOpticColumn(null);
            setSelectedSecondOption(null);
        }


        const sheetId = (name: string | undefined): number | undefined =>
            sheetGroups.flatMap(group => group.sheets).find(sheet => sheet.range === name)?.id;


        async function handleChosenOpticToSign(selected: { value: string; rowIndex: number; colIndex: number }) {
            if (!selected || !selectedOpticColumn) return;
            const msg = 'החייל ' + row['שם מלא'] + ' חתם על ' + selectedOpticColumn?.value + ' עם מספר סידורי ' + selected?.value + ' מפלוגה ' + sheetName;
            const updates = [];
            // @ts-ignore
            let colIndex = Object.keys(row).findIndex(c => c === selectedOpticColumn.value);
            let sheetToDelete;
            if (weaponsData.values[0].includes(selectedOpticColumn.value)) {
                sheetToDelete = sheetId('מלאי נשקיה');
                colIndex = Object.keys(row).findIndex(c => c === 'מסד');
                updates.push({
                    sheetId: sheetId(sheetName),
                    rowIndex: parseInt(soldierIndex || '0', 10) - 1,
                    colIndex: colIndex,
                    value: selected.value
                });
                updates.push({
                    sheetId: sheetId(sheetName),
                    rowIndex: parseInt(soldierIndex || '0', 10) - 1,
                    colIndex: Object.keys(row).findIndex(c => c === 'סוג נשק'),
                    value: selectedOpticColumn.value
                })
            } else {
                // @ts-ignore
                const firstUpdate = {
                    sheetId: sheetId(sheetName),
                    rowIndex: parseInt(soldierIndex || '0', 10) - 1,
                    colIndex: colIndex,
                    value: selected.value
                };
                updates.push(firstUpdate)
                sheetToDelete = sheetId('מלאי אופטיקה');
            }

            // @ts-ignore
            const secondUpdate = {
                sheetId: sheetToDelete,
                rowIndex: selected.rowIndex,
                colIndex: selected.colIndex,
                value: ''
            };
            updates.push(secondUpdate);

            const response = await GoogleSheetsService.updateCalls({
                accessToken: accessToken,
                updates: updates,
                appendSheetId: 1070971626,
                isArmory: true,
                appendValues: [[msg, new Date().toLocaleString('he-IL'), userEmail ? userEmail : ""]]
            });

            setFilteredOpticOptions([]);
            setSelectedOpticColumn(null);
            setShowMessage(true);
            setIsSuccess(response);
            setMessage(response ? msg : `בעיה בהחתמת האמרל`);
            refetch();
            refetchOptics();
            refetchWeapons();
        }

        function handleCreditOptic() {
            if (!opticsData?.values?.length) return;

            const excludedKeys = [
                "שם מלא",
                "מספר אישי",
                "פלאפון",
                "חתימה",
                "זמן חתימה",
                "סוג נשק",
                "כוונת",
                "מסד",
                "הערות"
            ];
            const soldierOptics = Object.entries(row)
                .filter(
                    ([key, value]) =>
                        !excludedKeys.includes(key) && value?.toString().trim() !== ''
                )
                .map(([key, value]) => ({
                    key,
                    value,
                }));
            setSoldierOptics(soldierOptics);
        }

        async function handleChosenOpticToCredit(selected: string) {
            const [opticKey, opticValue] = selected.split(' - ');
            if (!opticKey || !opticValue) return;
            const msg = 'החייל ' + row['שם מלא'] + ' זיכה אמרל ' + opticKey + ' עם מספר סידורי ' + opticValue + ' מפלוגה ' + sheetName;

            const updates = [];

            const colIndex = Object.keys(row).findIndex(c => c === opticKey);
            const rowCol = GoogleSheetsService.findInsertIndex(opticsData.values, opticKey);
            // @ts-ignore
            const firstUpdate = {
                sheetId: sheetId(sheetName),
                rowIndex: parseInt(soldierIndex || '0', 10) - 1,
                colIndex: colIndex,
                value: ''
            };
            updates.push(firstUpdate)

            // @ts-ignore
            const secondUpdate = {
                sheetId: sheetId('מלאי אופטיקה'),
                rowIndex: rowCol.row,
                colIndex: rowCol.col,
                value: opticValue
            };
            // updates.push(secondUpdate);

            const response = await GoogleSheetsService.updateCalls({
                accessToken: accessToken,
                updates: updates,
                appendSheetId: 1070971626,
                isArmory: true,
                appendValues: [[msg, new Date().toLocaleString('he-IL'), userEmail ? userEmail : ""]],
                secondAppendSheetId: sheetId('מלאי אופטיקה'),
                secondAppendValues: [GoogleSheetsService.generatePaddedArray(rowCol.col, opticValue)]
            });

            refetch();
            refetchOptics();
            refetchWeapons();
            setSoldierOptics([]);
            setShowMessage(true);
            setIsSuccess(response);
            setMessage(response ? msg : `בעיה בהחתמת האמרל`);

        }

        return isLoading ? (
            <Spinner/>
        ) : (
            <div
                className="flex flex-col items-center justify-start w-full min-h-screen max-w-6xl px-4 py-6 overflow-y-auto">
                <div className="bg-white shadow-lg rounded-lg p-6 w-full">
                    {/* Top Section */}
                    <div className="flex justify-between items-center mb-8 flex-wrap gap-2">
                        <button
                            onClick={() => navigate(-1)}
                            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-6 rounded"
                        >
                            חזור
                        </button>

                        <h2 className="text-2xl font-bold text-center mx-auto">
                            <EditableWithPencil
                                title
                                label="שם מלא"
                                value={editableFields['שם מלא']}
                                displayValue={row['שם מלא'] || '-'}
                                isEditing={editingField === 'שם מלא' && !permissions['Plugot']}
                                onEdit={() => {
                                    if (!permissions['Plugot']) {
                                        handleEditField('שם מלא');
                                    }
                                }}
                                onChange={(val) => {
                                    if (!permissions['Plugot']) {
                                        handleFieldChange('שם מלא', val);
                                    }
                                }}
                                onSave={() => {
                                    if (!permissions['Plugot']) {
                                        handleSaveField('שם מלא');
                                    }
                                }}
                            />
                        </h2>

                        <span className="text-gray-600 text-sm opacity-0 pointer-events-none">a</span>
                    </div>

                    <div className="flex flex-row-reverse gap-4 justify-center mt-8">

                        {!permissions['Plugot'] && (
                            <button
                                onClick={handleCreditOptic}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                            >
                                זיכוי אמרל
                            </button>
                        )}

                        {!permissions['Plugot'] && (
                            <button
                                onClick={handleSignOptic}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                            >
                                החתמת אמרל
                            </button>
                        )}


                    </div>
                    {showMessage && (
                        <div>
                            <StatusMessageProps
                                isSuccess={isSuccess}
                                message={message}
                                onClose={() => setMessage('')}
                            />
                        </div>
                    )}
                    {soldierOptics.length > 0 && (
                        <div className="mt-4">
                            <label className="block text-right font-medium">בחר אמצעי שתרצה לזכות</label>
                            <select
                                className="border p-2 rounded text-right w-full max-w-xs"
                                value={selectedOpticPair}
                                onChange={async (e) => {
                                    const selected = e.target.value;
                                    setSelectedOpticPair(selected);
                                    await handleChosenOpticToCredit(selected);
                                    refetch();
                                }}
                            >
                                <option value="">בחר אמרל לזכות</option>
                                {soldierOptics.map((optic: {
                                    key: any;
                                    value: any;
                                }, idx: React.Key | null | undefined) => (
                                    <option key={idx} value={`${optic.key} - ${optic.value}`}>
                                        {`${optic.key} - ${optic.value}`}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {filteredOpticOptions.length > 0 && (
                        <StandaloneComboBox
                            label="בחר סוג אמצעי"
                            placeholder="בחר אמצעי"
                            options={filteredOpticOptions}
                            value={selectedOpticColumn} // type: { rowIndex, colIndex, value } | null
                            onChange={(opt) => setSelectedOpticColumn(opt)}
                        />

                    )}

                    {selectedOpticColumn && secondOptions.length > 0 && (
                        <StandaloneComboBox
                            label="בחר מספר סידורי"
                            placeholder="בחר מספר"
                            options={secondOptions} // pass full objects, not just strings
                            value={selectedSecondOption} // full option object or null
                            onChange={async (selected) => {
                                setSelectedSecondOption(selected);
                                await handleChosenOpticToSign(selected);
                                refetch();
                                refetchOptics();
                            }}
                        />

                    )}
                    {/* Info Card */}
                    <div className="mb-6 grid grid-cols-3 md:grid-cols-2 gap-6">
                        <EditableWithPencil
                            label="מספר אישי"
                            value={editableFields['מספר אישי']}
                            displayValue={row['מספר אישי'] || '-'}
                            isEditing={editingField === 'מספר אישי' && !permissions['Plugot']}
                            onEdit={() => {
                                if (!permissions['Plugot']) {
                                    handleEditField('מספר אישי');
                                }
                            }}
                            onChange={val => {
                                if (!permissions['Plugot']) {
                                    handleFieldChange('מספר אישי', val);
                                }
                            }}
                            onSave={() => {
                                if (!permissions['Plugot']) {
                                    handleSaveField('מספר אישי');
                                }
                            }}
                        />

                        <InfoField label="פלוגה" value={sheetName || ''}/>
                        <EditableWithPencil
                            label="פלאפון"
                            value={editableFields['פלאפון']}
                            displayValue={row['פלאפון'] || '-'}
                            isEditing={editingField === 'פלאפון' && !permissions['Plugot']} // only allow editing if NOT Plugot
                            onEdit={() => {
                                if (!permissions['Plugot']) {
                                    handleEditField('פלאפון');
                                }
                            }}
                            onChange={val => {
                                if (!permissions['Plugot']) {
                                    handleFieldChange('פלאפון', val);
                                }
                            }}
                            onSave={() => {
                                if (!permissions['Plugot']) {
                                    handleSaveField('פלאפון');
                                }
                            }}
                        />

                        <InfoField label="תאריך חתימה" value={row['זמן חתימה'] || '-'}/>
                        <EditableWithPencil
                            label="הערות"
                            value={editableFields['הערות']}
                            displayValue={row['הערות'] || '-'}
                            isEditing={editingField === 'הערות' && !permissions['Plugot']}
                            onEdit={() => {
                                if (!permissions['Plugot']) {
                                    handleEditField('הערות');
                                }
                            }}
                            onChange={val => {
                                if (!permissions['Plugot']) {
                                    handleFieldChange('הערות', val);
                                }
                            }}
                            onSave={() => {
                                if (!permissions['Plugot']) {
                                    handleSaveField('הערות');
                                }
                            }}
                        />
                    </div>

                    <div className="overflow-x-auto mt-4">
                        <table className="min-w-full border border-collapse text-right">
                            <thead className="bg-gray-200">
                            <tr>
                                <th className="border px-4 py-2">שם אמצעי</th>
                                <th className="border px-4 py-2">מסד</th>
                            </tr>
                            </thead>
                            <tbody>
                            {/* Original data from row */}
                            {Object.entries(row)
                                .filter(([key, value]) => {
                                    const skipKeys = ['שם מלא', 'מספר אישי', 'מסד', 'פלאפון', 'חתימה', 'זמן חתימה', 'הערות'];
                                    return !skipKeys.includes(key) && value?.toString().trim();
                                })
                                .map(([key, value], index) => {
                                    const name = key === 'סוג נשק' ? value : key;
                                    const masad = key === 'סוג נשק' ? row['מסד'] : value;
                                    return (
                                        <tr key={`row-${index}`}>
                                            <td className="border px-4 py-2">{name}</td>
                                            <td className="border px-4 py-2">{masad}</td>
                                        </tr>
                                    );
                                })}

                            {/* New data added manually */}
                            {opticRows.map((optic, index) => (
                                <tr key={`optic-${index}`}>
                                    <td className="border px-4 py-2">{optic.name}</td>
                                    <td className="border px-4 py-2">{optic.masad}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>


                    {/* Action Buttons */}
                    <div className="flex flex-row-reverse gap-4 justify-center mt-8">
                        <button
                            onClick={handleDownload}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded"
                        >
                            הורד דף חייל
                        </button>

                        {/*<button*/}
                        {/*    onClick={handleCredit}*/}
                        {/*    className="bg-red-400 hover:bg-red-500 text-white font-bold py-2 px-4 rounded"*/}
                        {/*>*/}
                        {/*    זיכוי חייל*/}
                        {/*</button>*/}
                    </div>
                </div>
            </div>
        );

// Helper component for field display
        function InfoField({label, value}: { label: string, value: string }) {
            return (
                <div className="flex flex-col">
                    <span className="text-xs text-gray-600">{label}</span>
                    <span className="font-medium text-base">{value}</span>
                </div>
            );
        }

// Editable field with pencil icon
        function EditableWithPencil({label, value, displayValue, isEditing, onEdit, onChange, onSave, title}: {
            label: string,
            value: string,
            displayValue: string,
            isEditing: boolean,
            onEdit: () => void,
            onChange: (val: string) => void,
            onSave: () => void,
            title?: boolean
        }) {
            // Store the original value to revert on Escape
            const [originalValue, setOriginalValue] = useState(value);
            React.useEffect(() => {
                if (isEditing) setOriginalValue(value);
            }, [isEditing]);

            const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
                if (e.key === 'Escape') {
                    onChange(originalValue); // revert
                    setEditingField(null); // exit edit mode
                } else if (e.key === 'Enter') {
                    onSave();
                }
            };

            return (
                <div className="flex flex-col relative">
                    {!title && <span className="text-xs text-gray-600">{label}</span>}
                    {isEditing ? (
                        <div className="flex items-center gap-2">
                            <input
                                className="font-medium text-base border rounded px-2 py-1"
                                value={value}
                                onChange={e => onChange(e.target.value)}
                                autoFocus
                                onKeyDown={handleKeyDown}
                            />
                            <button
                                onClick={onSave}
                                className="text-green-600 hover:text-green-800 text-lg font-bold"
                                title="שמור"
                            >
                                ✔
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className={`${title ? 'text-2xl' : 'font-medium text-base'} `}>{displayValue}</span>
                            <button
                                onClick={() => {
                                    setOriginalValue(value);
                                    onEdit();
                                }}
                                className="text-gray-400 hover:text-gray-700"
                                title="ערוך"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5}
                                     stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round"
                                          d="M16.862 4.487a2.1 2.1 0 1 1 2.97 2.97L7.5 19.789l-4 1 1-4 12.362-12.302z"/>
                                </svg>
                            </button>
                        </div>
                    )}
                </div>

            );
        }
    }
;

export default SoldierPage;
