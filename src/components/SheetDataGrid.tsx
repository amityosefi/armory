import React, {useEffect, useRef, useState} from 'react';
import {AgGridReact} from 'ag-grid-react';
import GoogleSheetsService from "../services/GoogleSheetsService";
import ConfirmDialog from "./feedbackFromBackendOrUser/DialogCheckForRemoval";
import StatusMessageProps from "./feedbackFromBackendOrUser/StatusMessageProps";
import type {GridApi, GridReadyEvent} from 'ag-grid-community';
import ComboBoxEditor from './ComboBoxEditor';
import {useGoogleSheetData} from "./hooks/useGoogleSheetData";
import {useParams} from 'react-router-dom';


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

    // @ts-ignore
    const {
        data: opticsData, refetch: refetchOpticData,
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
        data: weaponData, refetch: refetchweaponData
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

    const comboBoxRef = useRef<HTMLDivElement>(null);
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

    const columnDefs = incomingColumnDefs.map(col => {
        const hoverExcludedFields = ['סוג_נשק', 'שם_מלא', 'הערות'];
        const shouldEnableHover = !hoverExcludedFields.includes(col.field);

        const isPaarColumn = col.field === 'פער';

        return {
            ...col,
            editable: ['חתימה','הערות', 'שם_מלא'].includes(col.field),
            pinned: col.field === 'שם_מלא' || col.field === 'שם_אמצעי' ? 'right' : undefined,
            filterParams: {
                filterOptions: ['contains'],
                suppressAndOrCondition: false,
            },
            cellEditor: ['הערות','חתימה', 'שם_מלא'].includes(col.field) ? 'agTextCellEditor' : undefined,
            cellEditorParams: ['חתימה','הערות', 'שם_מלא'].includes(col.field)
                ? { maxLength: 100 }
                : undefined,
            cellClass: shouldEnableHover && isGroupSheet() ? 'hover-enabled' : undefined,
            cellClassRules: isPaarColumn
                ? {
                    'text-green-600 font-bold': (params: { value: any; }) => Number(params.value) > 0,
                    'text-red-600 font-bold': (params: { value: any; }) => Number(params.value) < 0,
                }
                : undefined,
            hide:
                (col.field === 'חתימה' && selectedSheet.name !== 'טבלת נשקיה') ||
                ['זמן_חתימה', 'פלאפון', 'מספר_אישי'].includes(col.field),
        };
    });



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
        let col = event.colDef.field;
        col = col.replace(/_/g, ' '); // Remove underscores for matching
        let uniqueOptions;
        if (event.colDef.field === 'כוונת') {
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
        } else if (col === 'מסד') {
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
            const valuesForAssign = GoogleSheetsService.findValuesUnderHeader(opticsData.values, col);
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
    async function onClickedOptic(event: any): Promise<boolean> {

        if (!isGroupSheet() || ['סוג_נשק', 'שם_מלא', 'הערות'].includes(event.colDef.field)) { // @ts-ignore
            return;
        }
        setEvent({
            rowIndex: event.data.rowRealIndex,
            colName: event.colDef.field,
            value: event.value,
            oldValue: event.oldValue,
            row: event.data,
            colIndex: event.column
        });
        if (event.value !== undefined && event.value !== null && event.value !== '') {
            // @ts-ignore
            if (event.colDef.field === 'כוונת') {
                // @ts-ignore
                setEvent((prev) => ({...prev, value: "1", colName: prev?.row['כוונת']}));
            } else if (event.colDef.field === 'מסד') {
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
        if (event) {
            const userEmail = localStorage.getItem('userEmail');
            const msg = event.row["שם_מלא"] + " זיכה " + event.colName + " " + event.value + " " + selectedSheet.name;
            const columnFields = columnDefs.map(col => col.field);
            let rowCol;
            let colIndex;
            let sheetid;
            let anotherUpdate;
            if (columnFields.includes(event.colName) || event.colName === "M5" || event.colName === "מפרו" || event.colName === "מארס") {
                rowCol = GoogleSheetsService.findInsertIndex(opticsData.values, event.colName.replace("_", ' '));
                colIndex = event.colName === "M5" || event.colName === "מפרו" || event.colName === 'מארס' ? 'כוונת' : event.colName;
                sheetid = 1158402644;
            } else {
                rowCol = GoogleSheetsService.findInsertIndex(weaponData.values, event.colName);
                colIndex = 'מסד';
                sheetid = 262055601;
                anotherUpdate = {
                    sheetId: selectedSheet.id,
                    rowIndex: event.rowIndex + 1,
                    colIndex: columnDefs.findIndex(col => col.field === 'סוג_נשק'),
                    value: ""
                }
            }
            const update = [
                {
                    sheetId: sheetid,
                    rowIndex: rowCol.row,
                    colIndex: rowCol.col,
                    value: event.value
                },
                {
                    sheetId: selectedSheet.id,
                    rowIndex: event.rowIndex + 1,
                    colIndex: columnDefs.findIndex(col => col.field === colIndex),
                    value: ""
                }];
            if (anotherUpdate)
                update.push(anotherUpdate);

            const response = await GoogleSheetsService.updateCalls({
                accessToken: accessToken,
                updates: update,
                appendSheetId: 1070971626,
                appendValues: [[msg, new Date().toLocaleString('he-IL'), userEmail ? userEmail : ""]]
            });
            setShowMessage(true);
            setIsSuccess(response);
            setMessage(response ? msg : ` בעיה בזיכוי ${event.colName}`);
            refetchOpticData();
            refetchweaponData();
            refetch();
            if (!response) {
                isRevertingNameOrComment.current = true;
            }
            setIsLoading(false);
        }
    }

    async function handleSelectOption(option: { rowIndex: number, colIndex: number, value: string }) {
        setShowComboBox(false);
        setIsLoading(true);
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
            colIndex: columnDefs.findIndex(c => c.field === event.colName),
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
                colIndex: columnDefs.findIndex(c => c.field === "סוג_נשק"),
                value: selectedWeapon
            })
            updates.push({
                sheetId: selectedSheet.id,
                rowIndex: event.rowIndex + 1,
                colIndex: columnDefs.findIndex(c => c.field === "זמן_חתימה"),
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
            appendValues: [[msg, new Date().toLocaleString('he-IL'), userEmail ? userEmail : ""]]
        });
        setShowMessage(true);
        setIsSuccess(response);
        setMessage(response ? msg : ` בעיה בהחתמת האמרל ${event.colName}`);
        refetch();
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
        let msg = '';
        if (selectedSheet.name === 'טבלת נשקיה')
            msg = 'חתימה מול החטיבה שונתה ל' + event.newValue + ' מהערך הקודם ' + event.oldValue;
        else
            msg = "חייל " + event.data["שם_מלא"] + " שינה " + event.colDef.field + ': ' + event.newValue;
        if (event.colDef.field === 'הערות' || event.colDef.field === 'שם_מלא' || event.colDef.field === 'חתימה') {
            const userEmail = localStorage.getItem('userEmail');
            const response = await GoogleSheetsService.updateCalls({
                accessToken: accessToken,
                updates: [{
                    sheetId: selectedSheet.id,
                    rowIndex: event.rowIndex + 1,
                    colIndex: columnDefs.findIndex(c => c.field === event.colDef.field),
                    value: event.newValue ?? ""
                }],
                appendSheetId: 1070971626,
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

    // @ts-ignore
    return (
        <>
            {showComboBoxWeapon && (
                <div
                    ref={comboBoxRef}
                    className="absolute z-50 bg-white shadow-xl rounded-lg w-72 border border-gray-300 animate-fadeIn backdrop-blur-md"
                    style={{top: 100, left: 100}} // Optional: make dynamic later
                    role="listbox"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                            setHighlightedIndexWeapon((prev) => Math.min(prev + 1, filteredOptions.length - 1));
                        } else if (e.key === 'ArrowUp') {
                            setHighlightedIndexWeapon((prev) => Math.max(prev - 1, 0));
                        } else if (e.key === 'Enter' && highlightedIndex >= 0) {
                            // @ts-ignore
                            handleSelectWeaponOption(filteredOptionsWeapon[highlightedIndexWeapon]);
                        } else if (e.key === 'Escape') {
                            setShowComboBoxWeapon(false);
                        }
                    }}
                >
                    <div className="p-2 border-b border-gray-200">
                        <input
                            type="text"
                            placeholder="🔍 חיפוש..."
                            className="w-full p-2 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                            value={searchTextWeapon}
                            onChange={(e) => {
                                setSearchText(e.target.value);
                                setHighlightedIndexWeapon(0);
                            }}
                            autoFocus
                        />
                    </div>
                    <ul className="max-h-60 overflow-y-auto">
                        {filteredOptionsWeapon.map((option, idx) => (
                            <li
                                key={`${option.value}`}
                                className={`p-2 px-4 cursor-pointer transition-colors ${
                                    idx === highlightedIndex
                                        ? 'bg-blue-600 text-white'
                                        : 'hover:bg-gray-100'
                                }`}
                                onMouseEnter={() => setHighlightedIndexWeapon(idx)}
                                onClick={() => {
                                    // @ts-ignore
                                    handleSelectWeaponOption(option);
                                }}
                            >
                                {option.value}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {showComboBox && (
                <div
                    ref={comboBoxRef}
                    className="absolute z-50 bg-white shadow-xl rounded-lg w-72 border border-gray-300 animate-fadeIn backdrop-blur-md"
                    style={{top: 100, left: 100}} // Optional: make dynamic later
                    role="listbox"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                            setHighlightedIndex((prev) => Math.min(prev + 1, filteredOptions.length - 1));
                        } else if (e.key === 'ArrowUp') {
                            setHighlightedIndex((prev) => Math.max(prev - 1, 0));
                        } else if (e.key === 'Enter' && highlightedIndex >= 0) {
                            handleSelectOption(filteredOptions[highlightedIndex]);
                        } else if (e.key === 'Escape') {
                            setShowComboBox(false);
                        }
                    }}
                >
                    <div className="p-2 border-b border-gray-200">
                        <input
                            type="text"
                            placeholder="🔍 חיפוש..."
                            className="w-full p-2 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                            value={searchText}
                            onChange={(e) => {
                                setSearchText(e.target.value);
                                setHighlightedIndex(0);
                            }}
                            autoFocus
                        />
                    </div>
                    <ul className="max-h-60 overflow-y-auto">
                        {filteredOptions.map((option, idx) => (
                            <li
                                key={`${option.value}-${option.rowIndex}-${option.colIndex}`}
                                className={`p-2 px-4 cursor-pointer transition-colors ${
                                    idx === highlightedIndex
                                        ? 'bg-blue-600 text-white'
                                        : 'hover:bg-gray-100'
                                }`}
                                onMouseEnter={() => setHighlightedIndex(idx)}
                                onClick={() => {
                                    handleSelectOption(option);
                                }}
                            >
                                {option.value}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {showMessage && (
                <div>
                    <StatusMessageProps
                        isSuccess={isSuccess}
                        message={message}
                        onClose={() => setMessage('')}
                    />
                </div>
            )}

            {isLoading ? (<div className="flex items-center gap-2 mt-2 text-blue-600">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span>טוען בקשה...</span>
            </div>) : (

                <div className="ag-theme-alpine w-full h-[70vh] ag-rtl">
                    <AgGridReact
                        className="ag-theme-alpine"
                        ref={gridRef}
                        onGridReady={(params: GridReadyEvent) => {
                            gridApiRef.current = params.api;
                        }}
                        components={{
                            comboBoxEditor: ComboBoxEditor,
                        }}
                        getRowClass={(params) => {
                            // @ts-ignore
                            return params.node.rowIndex % 2 === 0 ? 'ag-row-even' : 'ag-row-odd';
                        }}
                        columnDefs={columnDefs}
                        rowData={rowData}
                        stopEditingWhenCellsLoseFocus={true}
                        domLayout="normal"
                        enableRtl={true}
                        defaultColDef={{
                            flex: 1,
                            minWidth: 150,
                            resizable: true,
                            // cellClass: 'ag-center-cell',
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

                    {showConfirmDialog && event && (
                        <div>
                            <ConfirmDialog
                                clickedCellInfo={event}
                                onConfirm={() => handleConfirmOpticCredit()}
                                onCancel={() => setShowConfirmDialog(false)}
                            />
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default SheetDataGrid;
