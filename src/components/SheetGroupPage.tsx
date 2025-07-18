import React, {useState, useEffect} from 'react';
import {useParams} from 'react-router-dom';
import TabsNavigation from './route/TabsNavigation';
import SheetDataGrid from './SheetDataGrid';
import GoogleSheetsService from '../services/GoogleSheetsService';
import {creditSoldier} from '../services/SoldierService';
import type {SheetGroup} from '../types';
import {useGoogleSheetData} from './hooks/useGoogleSheetData';
import StatusMessageProps from './feedbackFromBackendOrUser/StatusMessageProps';
import AssignWeapon from './AssignWeapon';
import AcceptSoldier from './feedbackFromBackendOrUser/AcceptSoldierWeapon';
import {jsPDF} from 'jspdf';
import googleSheetsService from "../services/GoogleSheetsService";
import autoTable from "jspdf-autotable";

import '../fonts/NotoSansHebrew-normal';
import PromptNewWeaponOrOptic from "./PromptNewWeaponOrOptic";
import PromptNewSerialWeaponOrOptic from "./PromptNewSerialWeaponOrOptic";
import AddOpticToGroupColumn from "./AddOpticToGroupColumn";
import {useNavigate} from "react-router-dom";
import SummaryComponent from "./SummaryComponent";
import Equipment from "./Equipment";

interface SheetGroupPageProps {
    accessToken: string;
    sheetGroups: SheetGroup[];
}

const SheetGroupPage: React.FC<SheetGroupPageProps> = ({accessToken, sheetGroups}) => {
    const {groupId, sheetIndex} = useParams();
    const groupIndex = parseInt(groupId || '0');
    const currentGroup = sheetGroups[groupIndex] || sheetGroups[0];
    const [activeTabIndex, setActiveTabIndex] = useState(parseInt(sheetIndex || '0')); // Initialize from URL
    const [selectedRow, setSelectedRow] = useState<any | null>(null);
    const [assignSoldier, setAssignSoldier] = useState(false);
    const [addOpticColumn, setAddOpticColumn] = useState(false);
    const selectedSheet = currentGroup.sheets[activeTabIndex] || currentGroup.sheets[0];

    const [formValues, setFormValues] = useState({
        fullName: '',
        personalNumber: null,
        phone: null,
        group: selectedSheet.id,
        weaponName: '',
        intentionName: '',
        serialNumber: '',
        signature: '',
    });
    const [selectedSerialInfo, setSelectedSerialInfo] = useState<{
        value: string;
        rowIndex: number;
        colIndex: number
    } | null>(null);
    const [selectedOptic, setSelectedOptic] = useState<{
        label: string;
        rowIndex: number;
        colIndex: number
    } | null>(null);
    const encodedRange = selectedSheet ? encodeURIComponent(selectedSheet.range) : '';
    const isGroupSheet = () => ['א', 'ב', 'ג', 'מסייעת', 'מכלול', 'פלסם', 'אלון'].includes(currentGroup.sheets[groupIndex]?.range);

    const {data: sheetQueryData, isLoading, error, refetch} = useGoogleSheetData(
        {accessToken, range: encodedRange},
        {processData: false, enabled: !!accessToken && !!encodedRange}
    );
    const backgroundClass = isGroupSheet() ? `group-bg-${selectedSheet.range}` : '';
    const navigate = useNavigate();
    const [newWeaponOrOpticName, setNewWeaponOrOpticName] = useState('');
    const [newSerialWeaponOrOpticName, setNewSerialWeaponOrOpticName] = useState('');
    const [chosenWeaponOrOptic, setChosenWeaponOrOptic] = useState('');
    const [chosenNewOptic, setChosenNewOptic] = useState('');
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
        refetch: refetchWeapons
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

    const doc = new jsPDF();
    doc.setFont('NotoSansHebrew'); // use your font

    const [columnDefs, setColumnDefs] = useState<any[]>([]);
    const [sheetData, setSheetData] = useState<any[]>([]);
    const [showMessage, setShowMessage] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [message, setMessage] = useState('');
    const [showDialog, setShowDialog] = useState(false);
    const [isCreditingInProgress, setIsCreditingInProgress] = useState(false);

    const [promptNewWeaponOrOptic, setPromptNewWeaponOrOptic] = useState(false);
    const [newSerialWeaponOrOptic, setNewSerialWeaponOrOptic] = useState(false);

    useEffect(() => {
        // Update activeTabIndex if the URL's sheetIndex changes
        const currentSheetIndex = parseInt(sheetIndex || '0');
        if (activeTabIndex !== currentSheetIndex) {
            setActiveTabIndex(currentSheetIndex);
        }
    }, [sheetIndex]); // Depend on sheetIndex from URL

    useEffect(() => {
        if (sheetQueryData && !isLoading) {
            if (!sheetQueryData.values?.length) {
                setSheetData([]);
                setColumnDefs([]);
                return;
            }
            const {columnDefs: cols, rowData} = GoogleSheetsService.processSheetData(sheetQueryData);
            if (cols.length > 0) cols[0] = {
                ...cols[0],
                checkboxSelection: true,
                headerCheckboxSelection: false,
                width: 60,
                flex: 0
            };
            setColumnDefs(cols);
            const processed = rowData.map((row: any, index: any) => ({
                ...row,
                rowRealIndex: index,
            }));
            setSheetData(processed);
        }
    }, [sheetQueryData, isLoading]);


    const handleTabChange = (newSheetIndex: number) => {
        setActiveTabIndex(newSheetIndex);
        setSelectedRow(null);
        // Update the URL when the tab changes
        navigate(`/group/${groupId}/sheet/${newSheetIndex}/row/0`);
    };

    const getSheetNameById = (id: number) => {
        for (const group of sheetGroups) {
            const sheet = group.sheets.find(sheet => sheet.id === id);
            if (sheet) return sheet.name;
        }
        return undefined; // or 'Unknown'
    };

    const handleConfirmNewSoldier = async () => {
        let msg = 'החייל ' + formValues.fullName;
        setShowDialog(false);
        if (formValues.weaponName) {
            msg += ' הוחתם על נשק ' + formValues.weaponName + ' מסד ' + formValues.serialNumber + ' ';
        }
        if (formValues.intentionName)
            msg += ` עם כוונת ${formValues.intentionName} `;
        else
            msg += ' ' + getSheetNameById(formValues.group);
        const userEmail = localStorage.getItem('userEmail');
        let optic = formValues.intentionName;
        const update = [
            {
                sheetId: 262055601,
                rowIndex: selectedSerialInfo?.rowIndex,
                colIndex: selectedSerialInfo?.colIndex,
                value: ''
            },
        ];
        if (optic !== '') {
            const prefixes = ['M5', 'מפרו', 'מארס'];
            optic = prefixes.find(prefix => formValues.intentionName.startsWith(prefix)) || '';

            update.push({
                sheetId: 1158402644,
                rowIndex: selectedOptic?.rowIndex,
                colIndex: selectedOptic?.colIndex,
                value: ''
            });
        }

        // @ts-ignore
        const response = await GoogleSheetsService.updateCalls({
            accessToken,
            updates: update,
            appendSheetId: 1070971626,
            appendValues: [[msg, new Date().toLocaleString('he-IL'), userEmail || '']],
            secondAppendSheetId: formValues.group,
            secondAppendValues: [[formValues.fullName, String(formValues.personalNumber), String(formValues.phone), formValues.signature, new Date().toLocaleString('he-IL'), formValues.weaponName, optic, formValues.serialNumber]]
        });

        setShowMessage(true);
        setAssignSoldier(false);
        setIsSuccess(response);
        setMessage(response ? msg : 'בעיה בהחתמת חייל');
        setFormValues({
            fullName: '',
            personalNumber: null,
            phone: null,
            group: selectedSheet.id,
            weaponName: '',
            intentionName: '',
            serialNumber: '',
            signature: ''
        });
        refetch();
        refetchOptics();
        refetchWeapons();
    };


    const handleCreditSoldier = async (row: any) => {

        let msg = '';
        try {

            msg = Object.entries(row)
                .filter(([_, value]) => value !== '')
                .map(([key, value]) => {
                    if (key !== 'rowIndex' && key !== 'חתימה') {
                        if (key === 'שם_מלא') {
                            return `החייל: ${value} זיכה `;
                        }
                        return `${key}: ${value}`;
                    }
                })
                .join(', ');

            setIsCreditingInProgress(true);
            const colOpticIndex = columnDefs.findIndex(col => col.field === 'הערות');
            const headers = columnDefs.slice(colOpticIndex + 1).map(col => col.field || col.headerName);
            const response = await creditSoldier(accessToken, sheetGroups, row, headers, selectedSheet.range);
            setShowMessage(true);
            setIsSuccess(response);
            setMessage(response ? msg + " " + selectedSheet.name : 'בעיה בזיכוי החייל');
            if (response)
                await googleSheetsService.updateCalls({
                    accessToken: accessToken,
                    updates: [],
                    appendSheetId: 1070971626,
                    appendValues: [[msg, new Date().toLocaleString('he-IL'), localStorage.getItem('userEmail') || '']]
                });
            refetch();
            refetchOptics();
            refetchWeapons();
        } catch (error) {
            console.error('Error crediting soldier:', error);
            setShowMessage(true);
            setIsSuccess(false);
            setMessage('שגיאה בזיכוי החייל');
        } finally {
            setIsCreditingInProgress(false);
        }
    };

    const mirrorHebrewSmart = (str: string): string => {
        if (!str) return '';

        const words = str.trim().split(/\s+/);

        // Check if all words are Hebrew
        const allHebrew = words.every(word =>
            [...word].every(char => /[\u0590-\u05FF"״׳]/.test(char))
        );

        const transformedWords = words.map(word => {
            const isHebrew = [...word].every(char => /[\u0590-\u05FF"״׳]/.test(char));
            return isHebrew ? [...word].reverse().join('') : word;
        });

        // Reverse word order only if all words are Hebrew
        const finalWords = allHebrew ? transformedWords.reverse() : transformedWords;

        return finalWords.join(' ');
    };


    async function handleNewWeaponOrOptic() {
        setIsCreditingInProgress(true);
        const updates = [{
            sheetId: selectedSheet.id,
            rowIndex: 0,
            colIndex: sheetQueryData.values[0].length,
            value: newWeaponOrOpticName
        }];
        const msg = 'ל ' + selectedSheet.range + 'נוסף סוג חדש בשם: ' + newWeaponOrOpticName;
        let response = false;
        const flag = await GoogleSheetsService.executeBatchUpdate(accessToken, [
            {
                "updateSheetProperties": {
                    "properties": {
                        "sheetId": selectedSheet.id,
                        "gridProperties": {
                            "columnCount": sheetQueryData.values[0].length + 5
                        }
                    },
                    "fields": "gridProperties.columnCount"
                }
            }
        ])
        if (flag) {
            response = await GoogleSheetsService.updateCalls({
                    accessToken: accessToken,
                    updates: updates,
                    appendSheetId: 1070971626,
                    appendValues: [[msg, new Date().toLocaleString('he-IL'), localStorage.getItem('userEmail') || '']],

                }
            );
        }
        setShowMessage(true);
        setMessage(response && response ? msg : 'בעיה בהוספת נשק או כוונת');
        setIsSuccess(response && response);
        setPromptNewWeaponOrOptic(false);
        setNewWeaponOrOpticName('')
        setIsCreditingInProgress(false);
        refetch();
        refetchOptics();
        refetchWeapons();

    }

    async function handleConfirmNewOptic() {

        const msg = 'ל' + selectedSheet.name + ' נוסף אמרל חדש: ' + chosenNewOptic;
        setIsCreditingInProgress(true);
        // @ts-ignore
        let response = false;
        const flag = await GoogleSheetsService.executeBatchUpdate(accessToken, [
            {
                "updateSheetProperties": {
                    "properties": {
                        "sheetId": selectedSheet.id,
                        "gridProperties": {
                            "columnCount": sheetQueryData.values[0].length + 1
                        }
                    },
                    "fields": "gridProperties.columnCount"
                }
            }
        ])
        if (flag) {
            response = await GoogleSheetsService.updateCalls({
                    accessToken: accessToken,
                    updates: [{

                        sheetId: selectedSheet.id,
                        rowIndex: 0,
                        colIndex: columnDefs.map(row => row.headerName).length,
                        value: chosenNewOptic
                    }],
                    appendSheetId: 1070971626,
                    appendValues: [[msg, new Date().toLocaleString('he-IL'), localStorage.getItem('userEmail') || '']],

                }
            );
        }
        setChosenNewOptic('');
        setShowMessage(true);
        setMessage(response ? msg : 'בעיה בהוספת אמרל לפלוגה');
        setIsSuccess(response);
        setAddOpticColumn(false);
        setIsCreditingInProgress(false);
        refetch();
        refetchOptics();
        refetchWeapons();
    }

    async function handleNewSerialWeaponOrOptic() {
        let res: { sheetName: string; cellValue: string; }[] = [];
        // @ts-ignore
        const isWeaponSight = ['M5', 'מפרו', 'מארס', 'מצפן', 'משקפת'].includes(chosenWeaponOrOptic);
        if (!isWeaponSight)
            res = await GoogleSheetsService.searchAcrossAllSheets({
                searchValue: newSerialWeaponOrOpticName,
                accessToken,
            });
        const excludeSheets = ["'תיעוד'", "'דוח1'", "'טבלת נשקיה'"];

        let count = res.filter(v =>
            v.cellValue === newSerialWeaponOrOpticName &&
            !excludeSheets.some(sheet => v.sheetName.includes(sheet))
        );
        // @ts-ignore
        if (count.length > 0 && !isWeaponSight) {
            setNewSerialWeaponOrOptic(false);
            setChosenWeaponOrOptic('');
            setNewSerialWeaponOrOpticName('');
            setIsCreditingInProgress(false);
            setShowMessage(true);
            setMessage('מסד זה כבר קיים');
            setIsSuccess(false);
            return;
        }

        const rowCol = GoogleSheetsService.findInsertIndex(sheetQueryData.values, chosenWeaponOrOptic);
        setIsCreditingInProgress(true);

        const updates = [{
            sheetId: selectedSheet.id,
            rowIndex: rowCol.row, //need to change
            colIndex: rowCol.col, // need to change
            value: newSerialWeaponOrOpticName
        }];
        const msg = 'ל' + selectedSheet.name + ' נוסף צ חדש: ' + newSerialWeaponOrOpticName + ' תחת ' + chosenWeaponOrOptic;
        const response = await GoogleSheetsService.updateCalls({
                accessToken: accessToken,
                updates: updates,
                appendSheetId: 1070971626,
                appendValues: [[msg, new Date().toLocaleString('he-IL'), localStorage.getItem('userEmail') || '']],

            }
        );
        setShowMessage(true);
        setMessage(response ? msg : 'בעיה בהוספת נשק או כוונת');
        setIsSuccess(response);
        setNewSerialWeaponOrOptic(false);
        setChosenWeaponOrOptic('');
        setNewSerialWeaponOrOpticName('');
        setIsCreditingInProgress(false);
        refetch();
        refetchOptics();
        refetchWeapons();
    }

    async function handleStoredSoldier(selectedRow: any) {

//         const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
//
//         doc.addFont('NotoSansHebrew-normal.ttf', 'NotoSansHebrew', 'normal');
//         doc.setFont('NotoSansHebrew');
//
//         const tablesPerPage = 12;
//         const tablesPerColumn = 4;
//         const rowHeight = 65; // height per table including margin between
//         const columnX = [10, 75, 140]; // X positions for 3 columns
//
//         const data = sheetQueryData.values;
//
//         data.forEach((row, index) => {
//             const indexInPage = index % tablesPerPage;
//             const column = Math.floor(indexInPage / tablesPerColumn);
//             const positionInColumn = indexInPage % tablesPerColumn;
//
//             if (indexInPage === 0 && index !== 0) {
//                 doc.addPage();
//             }
//             const startY = 10 + positionInColumn * rowHeight;
//             const startX = columnX[column];
//
//             autoTable(doc, {
//                 startY,
//                 margin: { left: startX },
//                 tableLineWidth: 0.4,
//                 body: [
//                     [mirrorHebrewSmart(selectedSheet.name)],
//                     [mirrorHebrewSmart(row[0])],
//                     [mirrorHebrewSmart(row[5])],
//                     [row[7]],
//                     [mirrorHebrewSmart(row[6])],
//                     [String(index)],
//                 ],
//                 styles: {
//                     font: 'NotoSansHebrew',
//                     fontSize: 15,
//                     halign: 'right',
//                     textColor: 0,
//                     lineWidth: 0.4,
//                 },
//                 bodyStyles: {
//                     textDirection: 'rtl',
//                     valign: 'middle',
//                 },
//                 tableWidth: 60,
//                 theme: 'grid',
//             });
//         });
//
//         doc.save('soldiers.pdf');


        setIsCreditingInProgress(true);
        let msg = 'החייל ' + selectedRow['שם_מלא'] + ' ';
        let comment = '';
        if (selectedRow['הערות'] === 'מאופסן') {
            msg += 'לקח נשק ' + selectedRow['סוג_נשק'] + ' ' + selectedRow['מסד'] + ' מאפסון';
        } else {
            msg += 'איפסן נשק ' + selectedRow['סוג_נשק'] + ' ' + selectedRow['מסד'];
            comment = 'מאופסן';
        }
        const userEmail = localStorage.getItem('userEmail');
        const response = await GoogleSheetsService.updateCalls({
            accessToken: accessToken,
            updates: [{
                sheetId: selectedSheet.id,
                rowIndex: selectedRow['rowRealIndex'] + 1,
                colIndex: sheetQueryData.values[0].findIndex((c: string) => c === 'הערות'),
                value: comment
            }],
            appendSheetId: 1070971626,
            appendValues: [[msg, new Date().toLocaleString('he-IL'), userEmail ? userEmail : ""]]
        });

        setShowMessage(true);
        setIsSuccess(response);
        setMessage(response ? msg : `בעיה בעדכון אפסון`);
        await refetch();
        setIsCreditingInProgress(false);
    }

    const creditButton = selectedRow && groupIndex === 0 && (
        <button
            className="px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors text-sm"
            onClick={() => handleCreditSoldier(selectedRow)}
            disabled={isCreditingInProgress}
        >
            {isCreditingInProgress ? (
                <span className="flex items-center">
                    מעבד...
                    <span
                        className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></span>
                </span>
            ) : 'זיכוי חייל'}
        </button>
    );

    const storedButton = selectedRow && groupIndex === 0 && (
        <button
            className="px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors text-sm"
            onClick={() => handleStoredSoldier(selectedRow)}
            disabled={isCreditingInProgress}
        >
            {isCreditingInProgress ? (
                <span className="flex items-center">
                    מעבד...
                    <span
                        className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></span>
                </span>
            ) : 'איפסון'}
        </button>
    );

    const addOpticToGroup = isGroupSheet() && !selectedRow && (
        <button
            className="px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors text-sm"
            onClick={() => setAddOpticColumn(true)}
        >
            {isCreditingInProgress ? (
                <span className="flex items-center">
                    מעבד...
                    <span
                        className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></span>
                </span>
            ) : 'הוספת אמרל'}
        </button>
    );

    const assignWeaponButton = isGroupSheet() && !selectedRow && (
        <button
            className="px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors text-sm"
            onClick={() => setAssignSoldier(true)}
        >
            {isCreditingInProgress ? (
                <span className="flex items-center">
                    מעבד...
                    <span
                        className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></span>
                </span>
            ) : 'החתמת חייל'}
        </button>
    );

    const addWeaponOrOptic = ['מלאי נשקיה', 'מלאי אופטיקה'].includes(selectedSheet.range) && (
        <button
            className="px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors text-sm"
            onClick={() => setPromptNewWeaponOrOptic(true)}
        >
            {isCreditingInProgress ? (
                <span className="flex items-center">
                    מעבד...
                    <span
                        className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></span>
                </span>
            ) : selectedSheet.range === 'מלאי נשקיה' ? 'הוספת נשק חדש' : 'הוספת אמרל חדש'}
        </button>
    );

    const addNewSerialWeaponOrOptic = ['מלאי נשקיה', 'מלאי אופטיקה'].includes(selectedSheet.range) && (
        <button
            className="px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors text-sm"
            onClick={() => setNewSerialWeaponOrOptic(true)}
        >
            {isCreditingInProgress ? (
                <span className="flex items-center">
                    מעבד...
                    <span
                        className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></span>
                </span>
            ) : 'הוספת מסד חדש'}
        </button>
    );

    const downloadSadbaData = selectedSheet.range === 'תקול לסדנא' && (
        <button
            className="px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors text-sm"
            onClick={async () => {
                if (!sheetQueryData?.values?.length) return;

                const headers = sheetQueryData.values[0];
                const rows = sheetQueryData.values.slice(1);

                const doc = new jsPDF({orientation: "portrait"});

                // ✅ Load and set Hebrew font
                doc.addFont('NotoSansHebrew-normal.ttf', 'NotoSansHebrew', 'normal');
                doc.setFont('NotoSansHebrew');
                doc.setFontSize(14);

                let currentY = 20;

                for (const [colIndex, header] of headers.entries()) {
                    const values = rows
                        .map((row: { [x: string]: any; }) => row[colIndex])
                        .filter((value: string) => value && value.trim() !== "");

                    if (values.length > 0) {
                        const mirroredHeader = mirrorHebrewSmart(header);
                        doc.text(mirroredHeader, 100, currentY, {align: 'center'}); // Align right for Hebrew
                        currentY += 5;

                        autoTable(doc, {
                            startY: currentY,
                            head: ["#"],
                            body: values.map((val: string) => [
                                mirrorHebrewSmart(val)
                            ]),
                            theme: "grid",
                            styles: {
                                font: 'NotoSansHebrew', // ✅ Set font inside table too
                                fontSize: 12,
                                halign: 'right',        // Align Hebrew values
                            },
                            headStyles: {
                                font: 'NotoSansHebrew',
                                fillColor: [0, 102, 204],
                                textColor: 255,
                                halign: 'right',
                            },
                            margin: {left: 14, right: 14},
                            didDrawPage: (data: { cursor: { y: number; }; }) => {
                                currentY = data.cursor.y + 10;
                            },
                        });
                    }
                }

                doc.save("סיכום סדנא.pdf");
            }}


        >
            {isCreditingInProgress ? (
                <span className="flex items-center">
                מעבד...
                <span
                    className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full"></span>
            </span>
            ) : 'הורדת טופס'}
        </button>
    );

    return (
        // <div className={`page-container ${backgroundClass}`}>
        <div>
            <h2 className="text-xl font-semibold mb-4">{currentGroup.name}</h2>

            <TabsNavigation sheets={currentGroup.sheets} activeTabIndex={activeTabIndex} onTabChange={handleTabChange}
                            creditButton={creditButton}
                            storedButton={storedButton}
                            assignWeaponButton={assignWeaponButton} addWeaponOrOptic={addWeaponOrOptic}
                            addNewSerialWeaponOrOptic={addNewSerialWeaponOrOptic} addOpticToGroup={addOpticToGroup}
                            downloadSadbaData={downloadSadbaData}
                // showSoldierModal={showSoldierModal}
            />

            {addOpticColumn && (
                <AddOpticToGroupColumn
                    headerGroup={columnDefs.map(row => row.headerName)}
                    opticsHeaders={opticsData.values[0]}
                    chosenNewOptic={chosenNewOptic}
                    setChosenNewOptic={setChosenNewOptic}
                    onClose={() => {
                        setAddOpticColumn(false);
                        setChosenNewOptic('');
                    }}
                    onConfirm={handleConfirmNewOptic}
                />
            )}

            {assignSoldier && (
                <AssignWeapon
                    accessToken={accessToken}
                    formValues={formValues}
                    setFormValues={setFormValues}
                    onConfirm={handleConfirmNewSoldier}
                    onCancel={() => {
                        setFormValues({
                            fullName: '',
                            personalNumber: null,
                            phone: null,
                            group: selectedSheet.id,
                            weaponName: '',
                            intentionName: '',
                            serialNumber: '',
                            signature: ''
                        });
                        setAssignSoldier(false);
                    }}
                    setSelectedSerialInfo={setSelectedSerialInfo}
                    setSelectedOptic={setSelectedOptic}
                    setShowDialog={setShowDialog}
                    setAssignSoldier={setAssignSoldier}
                />
            )}

            {promptNewWeaponOrOptic && (
                <PromptNewWeaponOrOptic
                    sheetName={selectedSheet.range}
                    accessToken={accessToken}
                    newWeaponOrOpticName={newWeaponOrOpticName}
                    setNewWeaponOrOpticName={setNewWeaponOrOpticName}
                    onCancel={() => {
                        setPromptNewWeaponOrOptic(false);
                        setNewWeaponOrOpticName('');
                    }}
                    onConfirm={handleNewWeaponOrOptic}
                />
            )}

            {newSerialWeaponOrOptic && (
                <PromptNewSerialWeaponOrOptic
                    sheetName={selectedSheet.range}
                    chosenWeaponOrOptic={chosenWeaponOrOptic}
                    setChosenWeaponOrOptic={setChosenWeaponOrOptic}
                    accessToken={accessToken}
                    newSerialWeaponOrOpticName={newSerialWeaponOrOpticName}
                    setNewSerialWeaponOrOpticName={setNewSerialWeaponOrOpticName}
                    onCancel={() => {
                        setNewSerialWeaponOrOptic(false);
                        setNewSerialWeaponOrOpticName('');
                        setNewSerialWeaponOrOpticName('')
                    }}
                    onConfirm={handleNewSerialWeaponOrOptic}
                />
            )}


            {showDialog && (
                <AcceptSoldier
                    onConfirm={handleConfirmNewSoldier}
                    onCancel={() => {
                        setFormValues({
                            fullName: '',
                            personalNumber: null,
                            phone: null,
                            group: selectedSheet.id,
                            weaponName: '',
                            intentionName: '',
                            serialNumber: '',
                            signature: ''
                        });
                        setAssignSoldier(false);
                    }}
                />
            )}

            {showMessage && (
                <StatusMessageProps isSuccess={isSuccess} message={message} onClose={() => setMessage('')}/>
            )}

            {isLoading ? (
                <div className="flex flex-col justify-center items-center h-64">
                    <div
                        className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                    <p className="text-gray-700">טוען מידע...</p>
                </div>
            ) : error ? (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    <p className="font-bold">Error:</p>
                    <p>{error.message ? 'Failed to fetch sheet data' : ''}</p>
                </div>
            ) : ['טבלת נשקיה'].includes(selectedSheet.name) ? (
                <SummaryComponent accessToken={accessToken}/>
            ) : selectedSheet.name.includes('ציוד') ? (
                <Equipment accessToken={accessToken} selectedSheet={selectedSheet}
                />
            ) : sheetData.length > 0 || isCreditingInProgress ? (
                <SheetDataGrid accessToken={accessToken} columnDefs={columnDefs} rowData={sheetData}
                               selectedSheet={selectedSheet} onRowSelected={setSelectedRow}
                               refetch={refetch}/>
            ) : (
                <div className="bg-white shadow-lg rounded-lg p-6 text-center">
                    <p className="text-gray-700">אין מידע זמין עבור גליון זה.</p>
                </div>
            )}
        </div>
    );
};

export default SheetGroupPage;
