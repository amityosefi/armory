import React, {useEffect, useRef, useState} from 'react';
import {AgGridReact} from 'ag-grid-react';
import GoogleSheetsService from "../services/GoogleSheetsService";
import ConfirmDialog from "./feedbackFromBackendOrUser/DialogCheckForRemoval";
import StatusMessageProps from "./feedbackFromBackendOrUser/StatusMessageProps";
import type {GridApi, GridReadyEvent} from 'ag-grid-community';
import ComboBoxEditor from './ComboBoxEditor';
import {useGoogleSheetData} from "./hooks/useGoogleSheetData";
import {useParams, useNavigate} from 'react-router-dom';
import type {RowStyle} from 'ag-grid-community';
import {RowIndexWithCheckbox} from './RowIndexWithCheckbox';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';

// Card component for displaying row data
interface SoldierCardProps {
    data: any;
    onClick: () => void;
}

const SoldierCard: React.FC<SoldierCardProps> = ({data, onClick}) => {
    return (
        <div
            className="soldier-card"
            onClick={onClick}
        >
            <h3 className="soldier-name">{data['שם_מלא'] || 'שם לא ידוע'}</h3>
            <div className="soldier-details">
                <span className="soldier-phone">טלפון: {data['פלאפון'] || 'לא זמין'}</span>
                <span className="soldier-id">מ"א: {data['מספר_אישי'] || 'לא זמין'}</span>
            </div>
        </div>
    );
};

// Add CSS styles for the card view
const cardStyles = `
.view-toggle {
    display: flex;
    align-items: center;
    margin-bottom: 1rem;
    gap: 0.5rem;
}

.search-container {
    display: flex;
    align-items: center;
    margin-bottom: 1rem;
}

.search-input {
    width: 100%;
    max-width: 300px;
    padding: 0.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    margin-right: 1rem;
}

.view-toggle-button {
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.2s;
}

.view-toggle-button.active {
    background-color: #2563eb;
    color: white;
}

.view-toggle-button:not(.active) {
    background-color: #e2e8f0;
    color: #1e293b;
}

.card-view-container {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-top: 1rem;
}

.soldier-card {
    background-color: white;
    border: 1px solid #e2e8f0;
    border-radius: 0.5rem;
    padding: 1rem;
    width: calc(25% - 0.75rem);
    min-width: 200px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    transition: transform 0.2s, box-shadow 0.2s;
    cursor: pointer;
}

.soldier-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    background-color: #f8fafc;
}

.soldier-name {
    font-size: 1rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: #1e293b;
}

.soldier-details {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
    color: #64748b;
}

@media (max-width: 1200px) {
    .soldier-card {
        width: calc(33.333% - 0.667rem);
    }
}

@media (max-width: 768px) {
    .soldier-card {
        width: calc(50% - 0.5rem);
    }
}

@media (max-width: 480px) {
    .soldier-card {
        width: 100%;
    }
}
`;

interface SheetDataGridProps {
    accessToken: string;
    columnDefs: any[];
    rowData: any[];
    selectedSheet: {
        name: string
        range: string
        id: number
    };
    onRowSelected?: (row: any) => void;
    refetch: () => void;
}

const SheetDataGrid: React.FC<SheetDataGridProps> = ({
                                                         accessToken,
                                                         columnDefs: incomingColumnDefs,
                                                         rowData,
                                                         selectedSheet: selectedSheet,
                                                         onRowSelected,
                                                         refetch
                                                     }) => {

    // View mode state (table or card) - default to card
    const [viewMode, setViewMode] = useState<'table' | 'card'>('card');

    // Search state for card view
    const [searchQuery, setSearchQuery] = useState<string>('');

    // @ts-ignore
    const {
        data: opticsData, refetch: refetchOpticsData
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
        data: weaponData, refetch: refetchWeaponData
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
    const {
        data: sandaData, refetch: refetchSandaData
    } = useGoogleSheetData(
        {
            accessToken,
            range: "תקול לסדנא"
        },
        {
            // Don't process data here, we'll do it with custom logic below
            processData: false,
            enabled: !!accessToken
        }
    );

    const [dropdownOptions, setDropdownOptions] = useState<{ rowIndex: number, colIndex: number, value: string }[]>([]);
    const [dropdownOptionsWeapon, setDropdownOptionsWeapon] = useState<{ value: string }[]>([]);

    const [filteredOptions, setFilteredOptions] = useState<typeof dropdownOptions>([]);
    const [filteredOptionsWeapon, setFilteredOptionsWeapon] = useState<typeof dropdownOptionsWeapon>([]);

    const [showComboBoxWeapon, setShowComboBoxWeapon] = useState(false);
    const [showComboBox, setShowComboBox] = useState(false);

    const [searchText, setSearchText] = useState('');
    const [searchTextWeapon, setSearchTextWeapon] = useState('');

    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [highlightedIndexWeapon, setHighlightedIndexWeapon] = useState(0);

    const [selectedWeapon, setSelectedWeapon] = useState('');

    const {rowIndex} = useParams();
    const navigate = useNavigate();

    const comboBoxRef = useRef<HTMLDivElement>(null);
    const [selectedHeader, setSelectedHeader] = useState('');
    const [headerOptions, setHeaderOptions] = useState<string[]>([]);

    const savedFilterRef = useRef<any>(null);

    useEffect(() => {
        if (incomingColumnDefs && incomingColumnDefs.length > 0) {
            const headers = incomingColumnDefs
                .map((col) => col.headerName)
                .filter(Boolean)
                .sort((a, b) => a.localeCompare(b));

            setHeaderOptions(headers);
        }
    }, [incomingColumnDefs]);

    useEffect(() => {
        if (gridApiRef.current && savedFilterRef.current) {
            gridApiRef.current.setFilterModel(savedFilterRef.current);
            savedFilterRef.current = null; // reset to avoid reapplying
        }
    }, [rowData]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                comboBoxRef.current &&
                !comboBoxRef.current.contains(event.target as Node)
            ) {
                setShowComboBox(false);
            }
        }

        if (showComboBox) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showComboBox]);

    useEffect(() => {
        setFilteredOptionsWeapon(
            dropdownOptionsWeapon.filter(option =>
                option.value.toLowerCase().includes(searchTextWeapon.toLowerCase())
            )
        );
    }, [searchTextWeapon, dropdownOptionsWeapon]);

    useEffect(() => {
        setFilteredOptions(
            dropdownOptions.filter(option =>
                option.value.toLowerCase().includes(searchText.toLowerCase())
            )
        );
    }, [searchText, dropdownOptions]);


    function isStockSheet() {
        return ['מלאי אופטיקה', 'תקול לסדנא', 'מלאי נשקיה'].includes(selectedSheet.range);
    }

    const scrollToColumnByHeader = (headerName: string) => {
        const gridApi = gridApiRef.current;
        if (!gridApi) return;

        const col = gridApi
            .getAllGridColumns()
            .find((c) => c.getColDef().headerName === headerName);

        if (col) {
            gridApi.ensureColumnVisible(col.getColId());
        } else {
            console.warn(`Column with header "${headerName}" not found.`);
        }
    };


    const hoverExcludedFields = ['סוג_נשק', 'הערות'];
    const columnWidths: Record<string, number> = {
        'הודעה': 500,
        'זמן': 170,
        'שם_משתמש': 200,
    };

// Get the index of 'הערות'
    const heaarotIndex = incomingColumnDefs.findIndex(c => c.field === 'הערות');

    const columnDefs = [
        // Map and hide all columns after 'הערות' if isGroupSheet
        ...incomingColumnDefs
            .filter(col => col.field !== 'שם_מלא')
            .map((col, idx) => {
                const shouldEnableHover = !hoverExcludedFields.includes(col.field);
                const width = columnWidths[col.field] ?? 120;
                const isAfterHeaarot = idx >= heaarotIndex;

                return {
                    ...col,
                    editable: ['חתימה', 'הערות'].includes(col.field),
                    pinned: col.field === 'שם_אמצעי' ? 'right' : undefined,
                    filterParams: {
                        filterOptions: ['contains'],
                        suppressAndOrCondition: false,
                    },
                    cellEditor: ['הערות', 'חתימה'].includes(col.field) ? 'agTextCellEditor' : undefined,
                    cellEditorParams: ['חתימה', 'הערות'].includes(col.field)
                        ? {maxLength: 100}
                        : undefined,
                    cellClass: shouldEnableHover && (isGroupSheet() || isStockSheet()) ? 'hover-enabled' : undefined,
                    hide: (
                        (col.field === 'חתימה' && selectedSheet.name !== 'טבלת נשקיה') ||
                        ['זמן_חתימה', 'פלאפון', 'מספר_אישי'].includes(col.field) ||
                        (isGroupSheet() && isAfterHeaarot)
                    ),
                    width: width,
                };
            }),

        // Add one custom column that summarizes the hidden ones
        ...(isGroupSheet()
            ? [
                {
                    field: 'אמצעים',
                    headerName: 'אמצעים',
                    width: 600,
                    filter: true,
                    filterParams: {
                        filterOptions: ['contains'],
                        suppressAndOrCondition: false,
                    },
                    valueGetter: (params: any) => {
                        const rowData = params.data;
                        const result: string[] = [];

                        incomingColumnDefs
                            .slice(heaarotIndex + 1) // only columns after הערות
                            .forEach(col => {
                                const val = rowData?.[col.field];
                                if (val?.toString().trim()) {
                                    result.push(`${col.headerName || col.field}: ${val}`);
                                }
                            });

                        return result.join(' | ');
                    },
                },
                {
                    field: 'rowRealIndex',
                    headerName: 'מס',
                    pinned: 'right',
                    width: 60,
                    suppressMovable: true,
                    sortable: false,
                    filter: false,
                    editable: false,
                    valueGetter: (params: { data: { rowRealIndex: number; }; }) => params.data.rowRealIndex + 1,
                    cellRenderer: RowIndexWithCheckbox,
                },
                {
                    field: 'שם_מלא',
                    headerName: 'שם מלא',
                    pinned: 'right',
                    width: 130,
                    filter: true,
                    editable: true,
                    filterParams: {
                        filterOptions: ['contains'],
                        suppressAndOrCondition: false,
                    },
                    cellEditor: 'agTextCellEditor',
                    cellEditorParams: {maxLength: 100},
                    cellClass: isGroupSheet() || isStockSheet() ? 'hover-enabled' : undefined,
                },
            ]
            : []),
    ];


    const gridApiRef = useRef<GridApi | null>(null);


    useEffect(() => {
        // Only try to scroll if gridApi is ready and rowData is loaded
        if (gridApiRef.current && rowData && rowData.length > 0) {
            if (rowIndex) {
                const rowIndexNumber = parseInt(rowIndex, 10);
                if (!isNaN(rowIndexNumber) && rowIndexNumber >= 0 && rowIndexNumber < rowData.length) {
                    gridApiRef.current.ensureIndexVisible(rowIndexNumber, 'middle');
                }
            }
        }
    }, [rowIndex, rowData, gridApiRef.current]);

    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [event, setEvent] = useState<{
        rowIndex: number;
        colName: string;
        value: any;
        oldValue: any;
        row: any;
        colIndex: number;
    } | null>(null);


    const gridRef = useRef<AgGridReact>(null);
    const isRevertingNameOrComment = useRef(false);
    const [showMessage, setShowMessage] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);


    function isGroupSheet() {
        const groupName = selectedSheet.range;
        const groupNames = ['א', 'ב', 'ג', 'מסייעת', 'מכלול', 'פלסם', 'אלון']; // List your פלוגות sheets here
        return groupNames.includes(groupName);
    }

    // @ts-ignore
    async function handleEmptyCellClicked(event: any): Promise<boolean> {
        if (isStockSheet()) {
            // @ts-ignore
            return;
        }
        let uniqueOptions;
        if (event.colName === 'כוונת') {
            const valuesForAssign = GoogleSheetsService.findValuesUnderHeader(opticsData.values, 'מפרו');
            const valuesForAssign2 = GoogleSheetsService.findValuesUnderHeader(opticsData.values, 'M5');
            const valuesForAssign3 = GoogleSheetsService.findValuesUnderHeader(opticsData.values, 'מארס');
            const uniqueOptionsMap = new Map<string, { rowIndex: number, colIndex: number, value: string }>();
            valuesForAssign.forEach(item => {
                if (!uniqueOptionsMap.has('מפרו ' + item.value)) {
                    uniqueOptionsMap.set('מפרו ' + item.value, {...item, value: 'מפרו ' + item.value});
                }
            });
            valuesForAssign2.forEach(item => {
                if (!uniqueOptionsMap.has('M5 ' + item.value)) {
                    uniqueOptionsMap.set('M5 ' + item.value, {...item, value: 'M5 ' + item.value});
                }
            });
            valuesForAssign3.forEach(item => {
                if (!uniqueOptionsMap.has('מארס ' + item.value)) {
                    uniqueOptionsMap.set('מארס ' + item.value, {...item, value: 'מארס ' + item.value});
                }
            });
            uniqueOptions = Array.from(uniqueOptionsMap.values());
            // feel here the missing input
        } else if (event.colName === 'מסד') {
            const headers = weaponData.values[0];
            const headerOptions = headers.map((h: any) => ({value: h}));
            setDropdownOptionsWeapon(headerOptions)
            setFilteredOptionsWeapon(headerOptions);
            setShowComboBoxWeapon(true);
            setHighlightedIndexWeapon(0);
            setSearchTextWeapon('');
            // @ts-ignore
            return;

        } else {
            // @ts-ignore
            const valuesForAssign = GoogleSheetsService.findValuesUnderHeader(opticsData.values, event.colName);
            const uniqueOptionsMap = new Map<string, { rowIndex: number, colIndex: number, value: string }>();
            valuesForAssign.forEach(item => {
                if (!uniqueOptionsMap.has(item.value)) {
                    uniqueOptionsMap.set(item.value, item);
                }
            });
            uniqueOptions = Array.from(uniqueOptionsMap.values());
        }
        setDropdownOptions(uniqueOptions);
        setFilteredOptions(uniqueOptions);
        setShowComboBox(true);
        setHighlightedIndex(0); // reset highlighted index
        setSearchText('');

    }

    // @ts-ignore
    async function onClickedOptic(event1: any): Promise<boolean> {
        // Redirect if first column is clicked
        if (event1.colDef && event1.colDef.field === 'שם_מלא') {
            navigate(`/sheet/${selectedSheet.range}/soldier/${event1.data['rowRealIndex'] + 2}`);
            return false;
        }
        if (!isGroupSheet() && !isStockSheet() || ['סוג_נשק', 'rowRealIndex', 'שם_מלא', 'אמצעים', 'הערות'].includes(event1.colDef.field)) { // @ts-ignore
            return;
        }
        setEvent({
            rowIndex: event1.data.rowRealIndex,
            colName: event1.colDef.headerName,
            value: event1.value,
            oldValue: event1.oldValue,
            row: event1.data,
            colIndex: event1.column
        });

        if (event1.value !== undefined && event1.value !== null && event1.value !== '') {
            // @ts-ignore
            if (event1.colDef.field === 'כוונת') {
                // @ts-ignore
                setEvent((prev) => ({...prev, value: "1", colName: prev?.row['כוונת']}));
            } else if (event1.colDef.field === 'מסד') {
                // @ts-ignore
                setEvent((prev) => ({...prev, colName: prev?.row['סוג_נשק']}));
            }
            setShowConfirmDialog(true);
        } else
            await handleEmptyCellClicked(event);

    }

    async function handleConfirmOpticCredit() {
        setShowConfirmDialog(false);
        setIsLoading(true);

        if (gridApiRef.current) {
            savedFilterRef.current = gridApiRef.current.getFilterModel();
        }

        if (event) {

            const userEmail = localStorage.getItem('userEmail');
            const msg = event.row["שם_מלא"] + " זיכה " + event.colName + " " + event.value + " " + selectedSheet.name;
            const columnFields = columnDefs.map(col => col.headerName);
            const update = [];
            let rowCol;
            let colIndex;
            let sheetid;
            let anotherUpdate;
            if (columnFields.includes(event.colName) || event.colName === "M5" || event.colName === "מפרו" || event.colName === "מארס") {
                rowCol = GoogleSheetsService.findInsertIndex(opticsData.values, event.colName);
                colIndex = event.colName === "M5" || event.colName === "מפרו" || event.colName === 'מארס' ? 'כוונת' : event.colName;
                sheetid = 1158402644;
            } else {
                rowCol = GoogleSheetsService.findInsertIndex(weaponData.values, event.colName);
                colIndex = 'מסד';
                sheetid = 262055601;
                anotherUpdate = {
                    sheetId: selectedSheet.id,
                    rowIndex: event.rowIndex + 1,
                    colIndex: incomingColumnDefs.findIndex(col => col.field === 'סוג_נשק'),
                    value: ""
                }
            }
            update.push(
                {
                    sheetId: selectedSheet.id,
                    rowIndex: event.rowIndex + 1,
                    colIndex: incomingColumnDefs.findIndex(col => col.headerName === colIndex),
                    value: ""
                });
            if (anotherUpdate)
                update.push(anotherUpdate);

            const response = await GoogleSheetsService.updateCalls({
                accessToken: accessToken,
                updates: update,
                appendSheetId: 1070971626,
                appendValues: [[msg, new Date().toLocaleString('he-IL'), userEmail ? userEmail : ""]],
                secondAppendSheetId: sheetid,
                secondAppendValues: [GoogleSheetsService.generatePaddedArray(rowCol.col, event.value)],

            });
            setShowMessage(true);
            setIsSuccess(response);
            setMessage(response ? msg : ` בעיה בזיכוי ${event.colName}`);
            refetch();
            refetchOpticsData();
            refetchWeaponData();
            if (!response) {
                isRevertingNameOrComment.current = true;
            }
            setIsLoading(false);
        }
    }

    async function handleSelectOption(option: { rowIndex: number, colIndex: number, value: string }) {
        setShowComboBox(false);
        setIsLoading(true);

        if (gridApiRef.current) {
            savedFilterRef.current = gridApiRef.current.getFilterModel();
        }

        const userEmail = localStorage.getItem('userEmail');
        if (!event) {
            console.error("event is null");
            return;
        }
        const updates = [];
        if (option.value === 'M5 1' || option.value === 'מפרו 1' || option.value === 'מארס 1') {
            option.value = option.value.split(' ')[0]; // Remove the "1" suffix

        }
        const firstUpdate = {
            sheetId: selectedSheet.id,
            rowIndex: event.rowIndex + 1,
            colIndex: incomingColumnDefs.findIndex(c => c.headerName === event.colName),
            value: option.value
        };
        updates.push(firstUpdate)

        let msg;
        let anotherUpdate;
        if (event.colName == 'מסד') {
            msg = `הנשק ${event.colName} ${option.value} הוחתם בהצלחה לחייל ${event.row["שם_מלא"]} ` + " " + selectedSheet.name;
            anotherUpdate = {
                sheetId: 262055601,
                rowIndex: option.rowIndex,
                colIndex: option.colIndex,
                value: ""
            };
            updates.push({
                sheetId: selectedSheet.id,
                rowIndex: event.rowIndex + 1,
                colIndex: incomingColumnDefs.findIndex(c => c.field === "סוג_נשק"),
                value: selectedWeapon
            })
            updates.push({
                sheetId: selectedSheet.id,
                rowIndex: event.rowIndex + 1,
                colIndex: incomingColumnDefs.findIndex(c => c.field === "זמן_חתימה"),
                value: new Date().toLocaleString('he-IL')
            })

        } else {
            msg = `האמרל ${event.colName} ${option.value} הוחתם בהצלחה לחייל ${event.row["שם_מלא"]} ` + " " + selectedSheet.name;
            anotherUpdate = {
                sheetId: 1158402644,
                rowIndex: option.rowIndex,
                colIndex: option.colIndex,
                value: ""
            };

        }
        updates.push(anotherUpdate);
        const response = await GoogleSheetsService.updateCalls({
            accessToken: accessToken,
            updates: updates,
            appendSheetId: 1070971626,
            isArmory: true,
            appendValues: [[msg, new Date().toLocaleString('he-IL'), userEmail ? userEmail : ""]]
        });
        setShowMessage(true);
        setIsSuccess(response);
        setMessage(response ? msg : ` בעיה בהחתמת האמרל ${event.colName}`);
        refetch();
        refetchOpticsData();
        refetchWeaponData();
        setIsLoading(false);
    }

    async function handleSelectWeaponOption(option: { value: string }) {
        setSelectedWeapon(option.value)
        setShowComboBoxWeapon(false);
        const valuesForAssign = GoogleSheetsService.findValuesUnderHeader(weaponData.values, option.value);
        const uniqueOptionsMap = new Map<string, { rowIndex: number, colIndex: number, value: string }>();
        valuesForAssign.forEach(item => {
            if (!uniqueOptionsMap.has(item.value)) {
                uniqueOptionsMap.set(item.value, item);
            }
        });
        let uniqueOptions = Array.from(uniqueOptionsMap.values());
        setDropdownOptions(uniqueOptions);
        setFilteredOptions(uniqueOptions);
        setShowComboBox(true);
        setHighlightedIndex(0); // reset highlighted index
        setSearchText('');
    }

    async function changeNameOrComment(event: any) {
        if (isRevertingNameOrComment.current) {
            isRevertingNameOrComment.current = false;
            return;
        }
        let msg;
        if (selectedSheet.name === 'טבלת נשקיה')
            msg = 'חתימה מול החטיבה שונתה ל' + event.newValue;
        else
            msg = "חייל " + event.data["שם_מלא"] + " שינה " + event.colDef.field + ': ' + event.newValue;
        if (event.colDef.field === 'הערות') {
            const userEmail = localStorage.getItem('userEmail');
            const response = await GoogleSheetsService.updateCalls({
                accessToken: accessToken,
                updates: [{
                    sheetId: selectedSheet.id,
                    rowIndex: event.data.rowRealIndex + 1,
                    colIndex: incomingColumnDefs.findIndex(c => c.field === event.colDef.field),
                    value: event.newValue ?? ""
                }],
                appendSheetId: 1070971626,
                isArmory: true,
                appendValues: [[msg, new Date().toLocaleString('he-IL'), userEmail ? userEmail : ""]]
            });


            setShowMessage(true);
            setIsSuccess(response);
            setMessage(response ? msg : ` בעיה בעדכון ${event.colDef.field}`);
            refetch();
            if (!response) {
                isRevertingNameOrComment.current = true;
                event.node.setDataValue(event.column.getId(), event.oldValue);
            }
        }

    }

    async function handleConfirmOpticSadna() {
        setShowConfirmDialog(false);
        setIsLoading(true);
        if (event) {
            const userEmail = localStorage.getItem('userEmail');
            const msg = event.colName + " " + event.value + " הועבר לתקול לסדנא מ" + selectedSheet.name;

            const rowCol = GoogleSheetsService.findInsertIndex(sandaData.values, event.colName);
            const update = [
                // {
                //     sheetId: 1689612813,
                //     rowIndex: rowCol.row,
                //     colIndex: rowCol.col,
                //     value: event.value
                // },
                {
                    sheetId: selectedSheet.id,
                    rowIndex: event.rowIndex + 1,
                    colIndex: columnDefs.findIndex(col => col.headerName === event.colName),
                    value: ""
                }];

            const response = await GoogleSheetsService.updateCalls({
                accessToken: accessToken,
                updates: update,
                appendSheetId: 1070971626,
                isArmory: true,
                appendValues: [[msg, new Date().toLocaleString('he-IL'), userEmail ? userEmail : ""]],
                secondAppendSheetId: 1689612813,
                secondAppendValues: [GoogleSheetsService.generatePaddedArray(rowCol.col, event.value)],
            });
            setShowMessage(true);
            setIsSuccess(response);
            setMessage(response ? msg : `בעיה בהעברה לתקול לסדנא`);
            refetch();
            refetchOpticsData();
            refetchWeaponData();
            refetchSandaData();
            if (!response) {
                isRevertingNameOrComment.current = true;
            }
            setIsLoading(false);
        }
    }

    async function handleConfirmOpticStock() {
        setShowConfirmDialog(false);
        setIsLoading(true);
        if (event) {
            const userEmail = localStorage.getItem('userEmail');
            let sheetTofireName = 'מלאי אופטיקה';
            let sheetTofireId = 1158402644;
            if (weaponData.values[0].includes(event.colName)) {
                sheetTofireName = 'מלאי נשקיה';
                sheetTofireId = 262055601;
            }
            const msg = event.colName + " " + event.value + " הועבר מתקול לסדנא ל" + sheetTofireName;
            const rowCol = GoogleSheetsService.findInsertIndex(opticsData.values, event.colName);
            const update = [
                {
                    sheetId: 1689612813,
                    rowIndex: event.rowIndex + 1,
                    colIndex: incomingColumnDefs.findIndex(col => col.headerName === event.colName),
                    value: ""
                }];

            const response = await GoogleSheetsService.updateCalls({
                accessToken: accessToken,
                updates: update,
                appendSheetId: 1070971626,
                isArmory: true,
                appendValues: [[msg, new Date().toLocaleString('he-IL'), userEmail ? userEmail : ""]],
                secondAppendSheetId: sheetTofireId,
                secondAppendValues: [GoogleSheetsService.generatePaddedArray(rowCol.col, event.value)],
            });
            setShowMessage(true);
            setIsSuccess(response);
            setMessage(response ? msg : `בעיה בהעברה למלאי`);
            refetch();
            refetchOpticsData();
            refetchWeaponData();
            refetchSandaData();
            if (!response) {
                isRevertingNameOrComment.current = true;
            }
            setIsLoading(false);
        }
    }

    async function handleConfirmOpticDelete() {
        setShowConfirmDialog(false);
        setIsLoading(true);
        if (event) {
            const userEmail = localStorage.getItem('userEmail');
            const msg = event.colName + " " + event.value + "זוכה מול החטיבה";
            const response = await GoogleSheetsService.updateCalls({
                accessToken: accessToken,
                updates: [
                    {
                        sheetId: selectedSheet.id,
                        rowIndex: event.row.rowRealIndex + 1,
                        colIndex: incomingColumnDefs.findIndex(c => c.headerName === event.colName),
                        value: ""
                    }
                ],
                appendSheetId: 1070971626,
                isArmory: true,
                appendValues: [[msg, new Date().toLocaleString('he-IL'), userEmail ? userEmail : ""]]
            });
            setShowMessage(true);
            setIsSuccess(response);
            setMessage(response ? msg : `בעיה בהעברה למלאי`);
            refetch();
            refetchOpticsData();
            refetchWeaponData();
            refetchSandaData();
            if (!response) {
                isRevertingNameOrComment.current = true;
            }
            setIsLoading(false);
        }
    }

    // @ts-ignore
    return (
        <>
            {showMessage && (
                <div>
                    <StatusMessageProps
                        isSuccess={isSuccess}
                        message={message}
                        onClose={() => setMessage('')}
                    />
                </div>
            )}
            <style>{cardStyles}</style>
            {isGroupSheet() && (
                <div className="view-toggle">
                    <Button
                        className={`view-toggle-button ${viewMode === 'table' ? 'active' : ''}`}
                        onClick={() => setViewMode('table')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
                             viewBox="0 0 16 16">
                            <path
                                d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm15 0a1 1 0 0 0-1-1H2a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V2z"/>
                            <path
                                d="M0 3.5A.5.5 0 0 1 .5 3h15a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5H.5a.5.5 0 0 1-.5-.5v-1zm0 4A.5.5 0 0 1 .5 7h15a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5H.5a.5.5 0 0 1-.5-.5v-1zm0 4A.5.5 0 0 1 .5 11h15a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5H.5a.5.5 0 0 1-.5-.5v-1z"/>
                        </svg>
                    </Button>
                    <Button
                        className={`view-toggle-button ${viewMode === 'card' ? 'active' : ''}`}
                        onClick={() => setViewMode('card')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor"
                             viewBox="0 0 16 16">
                            <path
                                d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z"/>
                        </svg>
                    </Button>
                </div>
            )}

            {/* Show table view if viewMode is 'table' */}
            {viewMode === 'table' && isGroupSheet() && (
                <div className="overflow-x-auto">
                    <div className="ag-theme-alpine w-full h-[70vh] ag-rtl">
                        <AgGridReact
                            ref={gridRef}
                            columnDefs={columnDefs}
                            onCellValueChanged={(event) => {
                                if (event.colDef.field === 'שם_מלא' || event.colDef.field === 'הערות') {
                                    changeNameOrComment(event);
                                }
                            }}
                            onCellClicked={(event) => {
                                if (event.column && event.column.getColDef().field === 'אמצעים') {
                                    const rowRealIndex = event.data?.rowRealIndex;
                                    navigate(`/sheet/${selectedSheet.range}/soldier/${rowRealIndex + 2}`);
                                } else if (isGroupSheet()) {
                                    onClickedOptic(event);
                                }
                            }}
                            onGridReady={(params) => {
                                gridApiRef.current = params.api;
                            }}
                            getRowStyle={(params): RowStyle | undefined => {
                                if (params.data?.הערות === 'מאופסן') {
                                    return {backgroundColor: '#ffe5e5'}; // This now matches RowStyle
                                }
                                return undefined;
                            }}
                            defaultColDef={{resizable: true}}
                            rowData={selectedSheet.range === 'תיעוד' ? [...rowData].reverse() : rowData}
                            rowHeight={24} // Shrink row height
                            headerHeight={28}
                            rowSelection="single"
                            stopEditingWhenCellsLoseFocus={true}
                            domLayout="normal"
                            animateRows={true}
                            enableRtl={true}
                        />
                    </div>
                </div>
            )}

            {/* Card view */}
            {viewMode === 'card' && isGroupSheet() && (
                <div className="search-container">
                    <Input
                        type="text"
                        placeholder="🔍 חיפוש..."
                        className="search-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            )}
            {viewMode === 'card' && isGroupSheet() && (
                <div className="card-view-container">
                    {(() => {
                        // Group rows by מספר_אישי
                        const groupedData: { [key: string]: any[] } = {};

                        // Only process rows with valid rowRealIndex
                        const validRows = rowData.filter(row => row && row.rowRealIndex !== undefined);

                        // Group by מספר_אישי
                        validRows.forEach(row => {
                            const userId = row['מספר_אישי'] || 'unknown';
                            if (!groupedData[userId]) {
                                groupedData[userId] = [];
                            }
                            groupedData[userId].push(row);
                        });

                        // Create card for each unique מספר_אישי
                        return Object.entries(groupedData).map(([userId, rows]) => {
                            // Use the first row for display
                            const firstRow = rows[0];
                            return (
                                <SoldierCard
                                    key={userId}
                                    data={firstRow}
                                    onClick={() => navigate(`/sheet/${selectedSheet.range}/soldier/${firstRow.rowRealIndex + 2}`)}
                                />
                            );
                        }).filter((card, index) => {
                            if (!searchQuery) return true;

                            // Get the search query and convert to lowercase
                            const searchLower = searchQuery.toLowerCase();
                            const rowData = card.props.data;

                            // Check if any field in the row data contains the search query
                            return Object.entries(rowData).some(([key, value]) => {
                                // Skip internal fields and null/undefined values
                                if (
                                    key === 'rowRealIndex' ||
                                    key === '$$hashKey' ||
                                    key === '__v' ||
                                    key === '_id' ||
                                    value === null ||
                                    value === undefined ||
                                    value === ''
                                ) {
                                    return false;
                                }

                                // Convert key and value to lowercase strings for comparison
                                const keyStr = String(key).toLowerCase();
                                const valueStr = String(value).toLowerCase();

                                // Check if the key or value contains the search query
                                return keyStr.includes(searchLower) || valueStr.includes(searchLower);
                            });
                        });
                    })()}
                </div>
            )}

            {isStockSheet() && (
                <div className="mb-2">
                    <select
                        value={selectedHeader}
                        onChange={(e) => {
                            const value = e.target.value;
                            setSelectedHeader(value);
                            scrollToColumnByHeader(value);
                        }}
                        className="p-2 border border-gray-300 rounded w-64 text-sm"
                    >
                        <option value="">🔽 בחר כותרת עמודה...</option>
                        {headerOptions.map((header) => (
                            <option key={header} value={header}>
                                {header}
                            </option>
                        ))}
                    </select>
                </div>
            )}


            {isLoading ? (<div className="flex items-center gap-2 mt-2 text-blue-600">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span>טוען בקשה...</span>
            </div>) : (!isGroupSheet() && (
                <div className="overflow-x-auto">
                    <div className="ag-theme-alpine w-full h-[70vh] ag-rtl">
                        <AgGridReact
                            className="ag-theme-alpine"
                            ref={gridRef}
                            onGridReady={(params: GridReadyEvent) => {
                                gridApiRef.current = params.api;
                            }}

                            // components={{
                            //     comboBoxEditor: ComboBoxEditor,
                            // }}
                            getRowClass={(params) => {
                                // @ts-ignore
                                return params.node.rowIndex % 2 === 0 ? 'ag-row-even' : 'ag-row-odd';
                            }}
                            getRowStyle={(params): RowStyle | undefined => {
                                if (params.data?.הערות === 'מאופסן') {
                                    return {backgroundColor: '#ffe5e5'}; // This now matches RowStyle
                                }
                                return undefined;
                            }}
                            columnDefs={columnDefs}
                            rowData={selectedSheet.range === 'תיעוד' ? [...rowData].reverse() : rowData}
                            rowHeight={24} // Shrink row height
                            headerHeight={28}
                            stopEditingWhenCellsLoseFocus={true}
                            domLayout="normal"
                            enableRtl={true}
                            defaultColDef={{
                                // flex: 1,
                                minWidth: 10,
                                sortable: true,
                                resizable: true,
                            }}
                            rowSelection="single"
                            isRowSelectable={() => isGroupSheet()}
                            suppressRowClickSelection={true}
                            onCellClicked={(event) => {
                                onClickedOptic(event);
                            }}
                            onCellValueChanged={async (event) => {
                                await changeNameOrComment(event);
                            }}
                            onRowSelected={(event) => {
                                if (event.node && event.node.isSelected()) {
                                    const rowData = event.data;
                                    rowData['rowIndex'] = event.rowIndex; // Add index to rowData
                                    if (onRowSelected) {
                                        onRowSelected(rowData);
                                    }
                                } else {
                                    // When a checkbox is unchecked, check if any other row is selected
                                    // before clearing the selectedRow state
                                    if (gridRef.current) {
                                        const selectedNodes = gridRef.current.api.getSelectedNodes();
                                        if (selectedNodes.length === 0) {
                                            if (onRowSelected) {
                                                onRowSelected(null);
                                            }
                                        }
                                    }
                                }
                            }}
                        />
                    </div>
                </div>
            ))}


            {
                showConfirmDialog && event && (
                    <div>
                        <ConfirmDialog
                            isGroupSheet={isGroupSheet() ? 0 : selectedSheet.range === 'תקול לסדנא' ? 2 : 1}
                            clickedCellInfo={event}
                            onConfirm={() => {
                                if (isGroupSheet())
                                    handleConfirmOpticCredit()
                                else if (selectedSheet.range === 'תקול לסדנא')
                                    handleConfirmOpticStock()
                                else handleConfirmOpticSadna()
                            }}
                            onCancel={() => setShowConfirmDialog(false)}
                            onRemoveItem={handleConfirmOpticDelete}
                        />
                    </div>
                )
            }
        </>
    );
};


export default SheetDataGrid;
