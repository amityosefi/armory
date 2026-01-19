import React, {useMemo, useCallback, useState, useRef, useEffect} from "react";
import {AgGridReact} from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import {supabase} from "@/lib/supabaseClient";
import {ColDef, ICellRendererParams} from "ag-grid-community";
import {usePermissions} from "@/contexts/PermissionsContext";
import EditItemModal from "./EditItemModal";
import AddNewItemModal from "./AddNewItemModal";
import AddItemIdModal from "./AddItemIdModal";
import StatusMessage from "@/components/feedbackFromBackendOrUser/StatusMessageProps";
import jsPDF from "jspdf";
import "@/fonts/NotoSansHebrew-normal.js";
import logoImage from "@/assets/logo.jpeg";

interface ArmoryStocksProps {
    selectedSheet: {
        name: string;
        range: string;
        id: number;
    };
}

type ArmoryItem = {
    id: number;
    name: string;
    kind: string;
    location: string;
};

const ArmoryStocks: React.FC<ArmoryStocksProps> = ({selectedSheet}) => {
    const {permissions} = usePermissions();
    const [gedudData, setGedudData] = useState<ArmoryItem[]>([]);
    const [mahsanData, setMahsanData] = useState<ArmoryItem[]>([]);
    const [sadnaData, setSadnaData] = useState<ArmoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState({text: "", type: ""});
    
    // Modal states
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
    const [selectedItemLocation, setSelectedItemLocation] = useState<string>("");
    const [selectedItemName, setSelectedItemName] = useState<string>("");
    const [selectedItemKind, setSelectedItemKind] = useState<string>("");
    const [addNewItemModalOpen, setAddNewItemModalOpen] = useState(false);
    const [addItemIdModalOpen, setAddItemIdModalOpen] = useState(false);
    
    // Global search state
    const [globalSearch, setGlobalSearch] = useState("");
    
    // Validation states
    const [validationItemName, setValidationItemName] = useState("");
    const [validationNumber, setValidationNumber] = useState("");
    const [validationMessage, setValidationMessage] = useState({ text: "", type: "" });
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [filteredNames, setFilteredNames] = useState<string[]>([]);
    
    // Item search modal states
    const [itemSearchModalOpen, setItemSearchModalOpen] = useState(false);
    const [searchItemName, setSearchItemName] = useState("");
    const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
    const [filteredSearchNames, setFilteredSearchNames] = useState<string[]>([]);
    const [searchedItems, setSearchedItems] = useState<ArmoryItem[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);

    // Helper function to log actions to armory_document
    const logAction = async (message: string) => {
        try {
            await supabase.from("armory_document").insert([{
                תאריך: new Date().toLocaleString('he-IL'),
                משתמש: permissions['name'],
                הודעה: message
            }]);
        } catch (err) {
            console.error("Error logging action:", err);
            // Don't show error to user for logging failures
        }
    };

    // Fetch data from Supabase
    const fetchData = async () => {
        try {
            setLoading(true);
            
            // Fetch all data without pagination limits
            let allItems: ArmoryItem[] = [];
            let from = 0;
            const batchSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const {data, error, count} = await supabase
                    .from("armory_items")
                    .select("id, name, kind, location", { count: 'exact' })
                    .in("location", ["גדוד", "מחסן", "סדנא"])
                    .range(from, from + batchSize - 1);

                if (error) {
                    console.error("Error fetching data:", error);
                    setStatusMessage({
                        text: `שגיאה בטעינת נתונים: ${error.message}`,
                        type: "error"
                    });
                    break;
                }

                if (data && data.length > 0) {
                    allItems = [...allItems, ...(data as ArmoryItem[])];
                    from += batchSize;
                    hasMore = data.length === batchSize;
                } else {
                    hasMore = false;
                }
            }

            // Filter by location
            const gedud = allItems.filter((item) => item.location === "גדוד");
            const mahsan = allItems.filter((item) => item.location === "מחסן");
            const sadna = allItems.filter((item) => item.location === "סדנא");
            
            setGedudData(gedud);
            setMahsanData(mahsan);
            setSadnaData(sadna);
        } catch (err: any) {
            console.error("Unexpected error:", err);
            setStatusMessage({
                text: `שגיאה לא צפויה: ${err.message}`,
                type: "error"
            });
        } finally {
            setLoading(false);
        }
    };

    // Initial data fetch
    useEffect(() => {
        fetchData();
    }, []);

    // Helper function to process data into pivot table format with IDs
    const createPivotData = (data: ArmoryItem[]) => {
        if (data.length === 0) return {};

        const pivotByKind: { [kind: string]: { [name: string]: { ids: number[], count: number } } } = {};

        data.forEach(item => {
            const kind = item.kind || "לא מסווג";
            const name = item.name || "ללא שם";

            if (!pivotByKind[kind]) {
                pivotByKind[kind] = {};
            }

            if (!pivotByKind[kind][name]) {
                pivotByKind[kind][name] = {ids: [], count: 0};
            }

            pivotByKind[kind][name].ids.push(item.id);
            pivotByKind[kind][name].count += 1;
        });

        return pivotByKind;
    };

    // Process data into pivot table format with IDs for each location
    const gedudPivotData = useMemo(() => createPivotData(gedudData), [gedudData]);
    const mahsanPivotData = useMemo(() => createPivotData(mahsanData), [mahsanData]);
    const sadnaPivotData = useMemo(() => createPivotData(sadnaData), [sadnaData]);

    // Handle ID click
    const handleIdClick = (id: number, location: string, name: string, kind: string) => {
        setSelectedItemId(id);
        setSelectedItemLocation(location);
        setSelectedItemName(name);
        setSelectedItemKind(kind);
        setEditModalOpen(true);
    };
    
    // ID List renderer component factory
    const createIdListRenderer = (location: string, searchKey: string) => {
        return (props: ICellRendererParams) => {
            const ids = props.value || [];
            const rowData = props.data;
            
            // Show all IDs if the row matches by name or kind
            // Only filter IDs if searching specifically for an ID number
            let filteredIds = ids;
            if (searchTerms[searchKey]) {
                const searchLower = searchTerms[searchKey].toLowerCase();
                const nameMatch = rowData.name.toLowerCase().includes(searchLower);
                const kindMatch = rowData.kind.toLowerCase().includes(searchLower);
                
                // If name or kind matches, show all IDs
                // Otherwise, filter to show only matching IDs
                if (!nameMatch && !kindMatch) {
                    filteredIds = ids.filter((id: number) => id.toString().includes(searchTerms[searchKey]));
                }
            }

            return (
                <div className="text-right">
                    <div className="flex flex-wrap gap-1 justify-end overflow-y-auto p-1 max-h-16">
                        {filteredIds.map((id: number) => (
                            <button
                                key={id}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleIdClick(id, location, rowData.name, rowData.kind);
                                }}
                                className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded whitespace-nowrap hover:bg-blue-200 cursor-pointer"
                            >
                                {id}
                            </button>
                        ))}
                    </div>
                </div>
            );
        };
    };

    // Create row data for each kind (generic for all locations)
    const createRowData = (kind: string, items: { [name: string]: { ids: number[], count: number } }) => {
        const names = Object.keys(items);
        return names.map(name => ({
            name,
            quantity: items[name].count,
            ids: items[name].ids,
            kind
        }));
    };

    // Update search terms based on global search
    useEffect(() => {
        setSearchTerms({
            gedud: globalSearch,
            mahsan: globalSearch,
            sadna: globalSearch
        });
    }, [globalSearch]);
    
    // State for search terms and section visibility
    const [searchTerms, setSearchTerms] = useState<{ [key: string]: string }>({
        gedud: '',
        mahsan: '',
        sadna: ''
    });

    // Track which sections have matching search results
    const [visibleSections, setVisibleSections] = useState<{ [key: string]: boolean }>({
        gedud: true,
        mahsan: true,
        sadna: true
    });

    // Update section visibility based on search results
    useEffect(() => {
        const updateVisibility = () => {
            const newVisibility = {...visibleSections};
            let hasSearch = false;

            // Check if there's any search term
            Object.values(searchTerms).forEach(term => {
                if (term.trim() !== '') {
                    hasSearch = true;
                }
            });

            if (!hasSearch) {
                // If no search, show all sections
                setVisibleSections({
                    gedud: true,
                    mahsan: true,
                    sadna: true
                });
                return;
            }

            // Gedud section is always visible (even with no matches)
            newVisibility.gedud = true;

            // Check Mahsan section
            if (searchTerms.mahsan) {
                const hasMatches = Object.entries(mahsanPivotData).some(([kind, items]) => {
                    return createRowData(kind, items).some(item =>
                        item.name.toLowerCase().includes(searchTerms.mahsan.toLowerCase()) ||
                        item.kind.toLowerCase().includes(searchTerms.mahsan.toLowerCase()) ||
                        item.ids.some(id => id.toString().includes(searchTerms.mahsan))
                    );
                });
                newVisibility.mahsan = hasMatches;
            }

            // Check Sadna section
            if (searchTerms.sadna) {
                const hasMatches = Object.entries(sadnaPivotData).some(([kind, items]) => {
                    return createRowData(kind, items).some(item =>
                        item.name.toLowerCase().includes(searchTerms.sadna.toLowerCase()) ||
                        item.kind.toLowerCase().includes(searchTerms.sadna.toLowerCase()) ||
                        item.ids.some(id => id.toString().includes(searchTerms.sadna))
                    );
                });
                newVisibility.sadna = hasMatches;
            }

            setVisibleSections(newVisibility);
        };

        updateVisibility();
    }, [searchTerms, gedudPivotData, mahsanPivotData, sadnaPivotData]);

    // Handle search input changes
    const handleSearchChange = useCallback((value: string) => {
        setGlobalSearch(value);
    }, []);

    // Get unique sorted item names from gedudData
    const uniqueGedudNames = useMemo(() => {
        const names = new Set(gedudData.map(item => item.name));
        return Array.from(names).sort((a, b) => a.localeCompare(b, 'he'));
    }, [gedudData]);
    
    // Get unique sorted item names from all locations
    const uniqueAllItemNames = useMemo(() => {
        const allData = [...gedudData, ...mahsanData, ...sadnaData];
        const names = new Set(allData.map(item => item.name));
        return Array.from(names).sort((a, b) => a.localeCompare(b, 'he'));
    }, [gedudData, mahsanData, sadnaData]);

    // Handle validation item name input change with filtering
    const handleValidationNameChange = (value: string) => {
        setValidationItemName(value);
        setValidationMessage({ text: "", type: "" });
        
        if (value.trim() === "") {
            setFilteredNames(uniqueGedudNames);
            setShowSuggestions(true);
        } else {
            const filtered = uniqueGedudNames.filter(name => 
                name.toLowerCase().includes(value.toLowerCase())
            );
            setFilteredNames(filtered);
            setShowSuggestions(filtered.length > 0);
        }
    };

    // Handle selecting a suggestion
    const handleSelectSuggestion = (name: string) => {
        setValidationItemName(name);
        setShowSuggestions(false);
        setFilteredNames([]);
    };

    // Handle search item name input change with filtering
    const handleSearchItemNameChange = (value: string) => {
        setSearchItemName(value);
        
        if (value.trim() === "") {
            setFilteredSearchNames(uniqueAllItemNames);
            setShowSearchSuggestions(true);
        } else {
            const filtered = uniqueAllItemNames.filter(name => 
                name.toLowerCase().includes(value.toLowerCase())
            );
            setFilteredSearchNames(filtered);
            setShowSearchSuggestions(filtered.length > 0);
        }
    };
    
    // Handle selecting a search suggestion
    const handleSelectSearchSuggestion = (name: string) => {
        setSearchItemName(name);
        setShowSearchSuggestions(false);
        setFilteredSearchNames([]);
    };
    
    // Fetch all items with the selected name from the API
    const fetchItemsByName = async (itemName: string) => {
        setSearchLoading(true);
        try {
            const { data, error } = await supabase
                .from("armory_items")
                .select("id, name, kind, location")
                .eq("name", itemName)
                .order("id", { ascending: true });

            if (error) {
                console.error("Error fetching items:", error);
                setStatusMessage({
                    text: `שגיאה בטעינת נתונים: ${error.message}`,
                    type: "error"
                });
                setSearchedItems([]);
                return;
            }

            if (data) {
                console.log(data.length);
                // Sort by ID ascending
                const sortedData = (data as ArmoryItem[]).sort((a, b) => a.id - b.id);
                setSearchedItems(sortedData);
            }
        } catch (err: any) {
            console.error("Unexpected error:", err);
            setStatusMessage({
                text: `שגיאה לא צפויה: ${err.message}`,
                type: "error"
            });
            setSearchedItems([]);
        } finally {
            setSearchLoading(false);
        }
    };
    
    // Open item search modal with selected item
    const handleOpenItemSearchModal = async () => {
        if (!searchItemName) {
            setStatusMessage({
                text: "נא לבחור שם פריט",
                type: "error"
            });
            return;
        }
        await fetchItemsByName(searchItemName);
        setItemSearchModalOpen(true);
    };
    
    // Calculate total count for the searched item
    const totalItemCount = useMemo(() => {
        return searchedItems.length;
    }, [searchedItems]);
    
    // Validate item name and number
    const handleValidation = () => {
        if (!validationItemName || !validationNumber) {
            setValidationMessage({
                text: "נא לבחור שם ולהזין מספר",
                type: "error"
            });
            return;
        }

        const numberToCheck = parseInt(validationNumber);
        if (isNaN(numberToCheck)) {
            setValidationMessage({
                text: "נא להזין מספר תקין",
                type: "error"
            });
            return;
        }

        // Count how many items with this name exist in gedudData
        const itemsWithName = gedudData.filter(item => item.name === validationItemName);
        const actualCount = itemsWithName.length;

        if (actualCount === 0) {
            setValidationMessage({
                text: `השם "${validationItemName}" לא נמצא בגדוד`,
                type: "error"
            });
        } else if (actualCount === numberToCheck) {
            setValidationMessage({
                text: `✓`,
                type: "success"
            });
        } else {
            setValidationMessage({
                text: `"${validationItemName}" - קיימים ${actualCount}`,
                type: "error"
            });
        }
    };
    // Helper function to mirror Hebrew text for PDF
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

    // Export Sadna data to PDF
    const exportSadnaToPDF = () => {
        try {
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            // Set Hebrew font (already registered via import)
            doc.setFont('NotoSansHebrew');

            // Get page dimensions
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 15;
            const today = new Date().toLocaleDateString('he-IL');

            let y = margin;

            // Add logo to top left
            const logoWidth = 30;
            const logoHeight = 30;
            doc.addImage(logoImage, 'JPEG', margin, y, logoWidth, logoHeight);

            // Add header
            doc.setFontSize(18);
            doc.text(mirrorHebrewSmart('דוח סדנא 1018'), pageWidth/2, y, {align: 'center'});

            // Add date label
            y += 10;
            doc.setFontSize(12);
            doc.text(mirrorHebrewSmart('תאריך:'), pageWidth - margin, y, {align: 'right'});
            
            // Add date value on next line
            y += 7;
            doc.text(today, pageWidth - margin, y, {align: 'right'});

            // Add table header
            y += 15;
            doc.setFillColor(240, 240, 240);
            doc.rect(margin, y, pageWidth - (2 * margin), 10, 'F');

            doc.setFontSize(12);
            doc.text(mirrorHebrewSmart('שם'), pageWidth - margin - 10, y + 7, {align: 'right'});
            doc.text(mirrorHebrewSmart('מסד'), pageWidth / 2, y + 7, {align: 'right'});

            // Add items
            y += 15;
            sadnaData.forEach((item, i) => {
                // Check if we need a new page
                if (y > pageHeight - 30) {
                    doc.addPage();
                    y = margin;
                    
                    // Repeat header on new page
                    doc.setFillColor(240, 240, 240);
                    doc.rect(margin, y, pageWidth - (2 * margin), 10, 'F');
                    doc.setFontSize(12);
                    doc.text(mirrorHebrewSmart('שם'), pageWidth - margin - 10, y + 7, {align: 'right'});
                    doc.text(mirrorHebrewSmart('מסד'), pageWidth / 2, y + 7, {align: 'right'});
                    y += 15;
                }

                doc.text(mirrorHebrewSmart(item.name || ''), pageWidth - margin - 10, y, {align: 'right'});
                doc.text(item.id.toString(), pageWidth / 2, y, {align: 'right'});
                y += 8;

                // Add a light separator line
                if (i < sadnaData.length - 1) {
                    doc.setDrawColor(200, 200, 200);
                    doc.line(margin, y - 4, pageWidth - margin, y - 4);
                }
            });

            // Save the PDF
            doc.save(`סדנא_${today}.pdf`);
            
            setStatusMessage({
                text: 'הקובץ הורד בהצלחה',
                type: 'success'
            });
        } catch (error: any) {
            console.error('Error generating PDF:', error);
            setStatusMessage({
                text: `שגיאה ביצירת PDF: ${error.message}`,
                type: 'error'
            });
        }
    };

    // Column definitions factory (for all locations)
    const createColumnDefs = (location: string, searchKey: string): ColDef[] => [
        {
            field: "name",
            headerName: "שם",
            sortable: true,
            filter: true,
            width: 100,
            cellStyle: {textAlign: 'right'}
        },
        {
            field: "quantity",
            headerName: "כמות",
            sortable: true,
            filter: true,
            width: 80,
            cellStyle: {textAlign: 'center'}
        },
        {
            field: "ids",
            headerName: "מסד",
            sortable: false,
            filter: false,
            flex: 1,
            minWidth: 200,
            cellRenderer: createIdListRenderer(location, searchKey),
            cellStyle: {padding: '8px 4px'}
        }
    ];

    const gedudColumnDefs = useMemo(() => createColumnDefs("גדוד", "gedud"), [searchTerms]);
    const mahsanColumnDefs = useMemo(() => createColumnDefs("מחסן", "mahsan"), [searchTerms]);
    const sadnaColumnDefs = useMemo(() => createColumnDefs("סדנא", "sadna"), [searchTerms]);

    // Default column definition for AG Grid
    const defaultColDef = {
        headerClass: 'ag-right-aligned-header',
        cellStyle: {textAlign: 'center'},
        resizable: true,
    };

    if (loading) {
        return (
            <div className="container mx-auto p-4">
                <div className="flex flex-col items-center justify-center h-[60vh]">
                    <div
                        className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                    <p className="text-center p-4">טוען נתונים...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 space-y-6">
            {/* Validation Section */}
            <div className="bg-blue-100 border border-blue-300 rounded p-2">
                <div className="flex flex-row gap-2 items-center flex-wrap">
                    <div className="relative w-32">
                        <input
                            type="text"
                            value={validationItemName}
                            onChange={(e) => handleValidationNameChange(e.target.value)}
                            onFocus={() => {
                                if (validationItemName === "") {
                                    setFilteredNames(uniqueGedudNames);
                                }
                                setShowSuggestions(true);
                            }}
                            onClick={() => {
                                if (validationItemName === "") {
                                    setFilteredNames(uniqueGedudNames);
                                }
                                setShowSuggestions(true);
                            }}
                            onBlur={() => {
                                // Delay to allow click on suggestion
                                setTimeout(() => setShowSuggestions(false), 200);
                            }}
                            placeholder="חפש אמצעי"
                            className="w-full pl-5 pr-1 py-1 text-xs border border-blue-300 rounded text-right"
                            dir="rtl"
                        />
                        <svg 
                            className="absolute left-1 top-1/2 transform -translate-y-1/2 w-3 h-3 text-blue-600 pointer-events-none"
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        {showSuggestions && filteredNames.length > 0 && (
                            <div className="absolute z-50 w-auto min-w-full mt-1 bg-white border border-blue-300 rounded shadow-lg max-h-40 overflow-y-auto">
                                {filteredNames.map((name) => (
                                    <div
                                        key={name}
                                        onClick={() => handleSelectSuggestion(name)}
                                        className="px-2 py-1 text-xs hover:bg-blue-100 cursor-pointer text-right whitespace-nowrap"
                                    >
                                        {name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <input
                        type="number"
                        value={validationNumber}
                        onChange={(e) => {
                            setValidationNumber(e.target.value);
                            setValidationMessage({ text: "", type: "" });
                        }}
                        placeholder="כמות"
                        className="w-16 px-1 py-1 text-xs border border-blue-300 rounded text-right"
                        dir="rtl"
                    />
                    <button
                        onClick={handleValidation}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 font-semibold whitespace-nowrap"
                    >
                        בדוק
                    </button>
                    {validationMessage.text && (
                        <div className={`flex-1 px-1 py-1 text-xs rounded text-right ${
                            validationMessage.type === 'success' 
                                ? 'bg-green-200 text-green-900' 
                                : 'bg-red-200 text-red-900'
                        }`}>
                            {validationMessage.text}
                        </div>
                    )}
                </div>
            </div>
            
            {/* Item Search Section */}
            <div className="bg-purple-100 border border-purple-300 rounded p-3">
                <div className="flex flex-row gap-2 items-center flex-wrap">
                    <span className="text-sm font-semibold text-purple-900">הזן אמצעי לכל המסדים:</span>
                    <div className="relative w-48">
                        <input
                            type="text"
                            value={searchItemName}
                            onChange={(e) => handleSearchItemNameChange(e.target.value)}
                            onFocus={() => {
                                if (searchItemName === "") {
                                    setFilteredSearchNames(uniqueAllItemNames);
                                }
                                setShowSearchSuggestions(true);
                            }}
                            onClick={() => {
                                if (searchItemName === "") {
                                    setFilteredSearchNames(uniqueAllItemNames);
                                }
                                setShowSearchSuggestions(true);
                            }}
                            onBlur={() => {
                                setTimeout(() => setShowSearchSuggestions(false), 200);
                            }}
                            placeholder="בחר פריט"
                            className="w-full pl-5 pr-2 py-1.5 text-sm border border-purple-300 rounded text-right"
                            dir="rtl"
                        />
                        <svg 
                            className="absolute left-1 top-1/2 transform -translate-y-1/2 w-4 h-4 text-purple-600 pointer-events-none"
                            fill="none" 
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        {showSearchSuggestions && filteredSearchNames.length > 0 && (
                            <div className="absolute z-50 w-auto min-w-full mt-1 bg-white border border-purple-300 rounded shadow-lg max-h-60 overflow-y-auto">
                                {filteredSearchNames.map((name) => (
                                    <div
                                        key={name}
                                        onClick={() => handleSelectSearchSuggestion(name)}
                                        className="px-3 py-2 text-sm hover:bg-purple-100 cursor-pointer text-right whitespace-nowrap"
                                    >
                                        {name}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handleOpenItemSearchModal}
                        className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 font-semibold whitespace-nowrap"
                    >
                        הצג מיקומים
                    </button>
                </div>
            </div>

            {/* Top Action Buttons and Search */}
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50 p-4 rounded-lg">

                {statusMessage.text && (
                    <StatusMessage
                        isSuccess={statusMessage.type === 'success'}
                        message={statusMessage.text}
                        onClose={() => setStatusMessage({text: "", type: ""})}
                    />
                )}

                <div className="flex gap-2 w-full md:w-auto">
                    <button
                        onClick={() => setAddNewItemModalOpen(true)}
                        className="flex-1 md:flex-none px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 font-semibold whitespace-nowrap"
                    >
                        הוספת פריט חדש
                    </button>
                    <button
                        onClick={() => setAddItemIdModalOpen(true)}
                        className="flex-1 md:flex-none px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 font-semibold whitespace-nowrap"
                    >
                        הוספת צ
                    </button>
                </div>
                <div className="w-full md:w-1/2">
                    <input
                        type="text"
                        placeholder="חיפוש בכל המיקומים..."
                        className="w-full p-2 border rounded-md text-right"
                        value={globalSearch}
                        onChange={(e) => handleSearchChange(e.target.value)}
                    />
                </div>
            </div>

            {/* Gedud Section - Grouped by Kind */}
            {visibleSections.gedud && (
                <div className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-4">
                            <h2 className="text-2xl font-bold text-right text-blue-800">גדוד</h2>
                        </div>
                    </div>

                    {Object.keys(gedudPivotData).length === 0 ? (
                        <p className="text-center text-gray-500 p-4">אין נתונים להצגה</p>
                    ) : (
                        <div className="space-y-6">
                            {Object.entries(gedudPivotData).map(([kind, items]) => {
                                const allRows = createRowData(kind, items);
                                const filteredRows = allRows.filter(item => {
                                    if (!searchTerms.gedud) return true;
                                    
                                    const searchLower = searchTerms.gedud.toLowerCase();
                                    const nameMatch = item.name.toLowerCase().includes(searchLower);
                                    const kindMatch = item.kind.toLowerCase().includes(searchLower);
                                    const idMatch = item.ids.some(id => id.toString().includes(searchTerms.gedud));
                                    
                                    return nameMatch || kindMatch || idMatch;
                                });
                                
                                // Only show the kind section if it has matching items or no search
                                if (filteredRows.length === 0 && searchTerms.gedud) {
                                    return null;
                                }
                                
                                return (
                                    <div key={kind} className="border border-blue-200 rounded-md p-3 bg-white">
                                        <h3 className="text-lg font-semibold mb-3 text-right text-blue-700">
                                            סוג: {kind}
                                        </h3>
                                        <div
                                            className="ag-theme-alpine rtl"
                                            style={{height: "200px", width: "100%", direction: "rtl"}}
                                        >
                                            <AgGridReact
                                                rowData={filteredRows}
                                                columnDefs={gedudColumnDefs}
                                                defaultColDef={defaultColDef}
                                                pagination={false}
                                                enableRtl={true}
                                                domLayout="normal"
                                                rowHeight={80}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                            {searchTerms.gedud && Object.entries(gedudPivotData).every(([kind, items]) => {
                                const filteredRows = createRowData(kind, items)
                                    .filter(item =>
                                        item.name.toLowerCase().includes(searchTerms.gedud.toLowerCase()) ||
                                        item.kind.toLowerCase().includes(searchTerms.gedud.toLowerCase()) ||
                                        item.ids.some(id => id.toString().includes(searchTerms.gedud))
                                    );
                                return filteredRows.length === 0;
                            }) && (
                                <p className="text-center text-gray-500 p-4">לא נמצאו תוצאות עבור החיפוש</p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Mahsan Section - Grouped by Kind */}
            {visibleSections.mahsan && (
                <div className="border-2 border-green-300 rounded-lg p-4 bg-green-50">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-4">
                            <h2 className="text-2xl font-bold text-right text-green-800">מחסן</h2>
                        </div>
                    </div>

                    {Object.keys(mahsanPivotData).length === 0 ? (
                        <p className="text-center text-gray-500 p-4">אין נתונים להצגה</p>
                    ) : (
                        <div className="space-y-6">
                            {Object.entries(mahsanPivotData).map(([kind, items]) => {
                                const allRows = createRowData(kind, items);
                                const filteredRows = allRows.filter(item => {
                                    if (!searchTerms.mahsan) return true;
                                    
                                    const searchLower = searchTerms.mahsan.toLowerCase();
                                    const nameMatch = item.name.toLowerCase().includes(searchLower);
                                    const kindMatch = item.kind.toLowerCase().includes(searchLower);
                                    const idMatch = item.ids.some(id => id.toString().includes(searchTerms.mahsan));
                                    
                                    return nameMatch || kindMatch || idMatch;
                                });
                                
                                // Only show the kind section if it has matching items or no search
                                if (filteredRows.length === 0 && searchTerms.mahsan) {
                                    return null;
                                }
                                
                                return (
                                    <div key={kind} className="border border-green-200 rounded-md p-3 bg-white">
                                        <h3 className="text-lg font-semibold mb-3 text-right text-green-700">
                                            סוג: {kind}
                                        </h3>
                                        <div
                                            className="ag-theme-alpine rtl"
                                            style={{height: "200px", width: "100%", direction: "rtl"}}
                                        >
                                            <AgGridReact
                                                rowData={[...filteredRows].reverse()}
                                                columnDefs={mahsanColumnDefs}
                                                defaultColDef={defaultColDef}
                                                pagination={false}
                                                enableRtl={true}
                                                domLayout="normal"
                                                rowHeight={80}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                            {searchTerms.mahsan && Object.entries(mahsanPivotData).every(([kind, items]) => {
                                const filteredRows = createRowData(kind, items)
                                    .filter(item =>
                                        item.name.toLowerCase().includes(searchTerms.mahsan.toLowerCase()) ||
                                        item.kind.toLowerCase().includes(searchTerms.mahsan.toLowerCase()) ||
                                        item.ids.some(id => id.toString().includes(searchTerms.mahsan))
                                    );
                                return filteredRows.length === 0;
                            }) && (
                                <p className="text-center text-gray-500 p-4">לא נמצאו תוצאות עבור החיפוש</p>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Sadna Section - Grouped by Kind */}
            {visibleSections.sadna && (
                <div className="border-2 border-orange-300 rounded-lg p-4 bg-orange-50">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-4">
                            <h2 className="text-2xl font-bold text-right text-orange-800">סדנא</h2>
                            <button
                                onClick={exportSadnaToPDF}
                                className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 font-semibold text-sm whitespace-nowrap"
                            >
                                הורד PDF
                            </button>
                        </div>
                    </div>

                    {Object.keys(sadnaPivotData).length === 0 ? (
                        <p className="text-center text-gray-500 p-4">אין נתונים להצגה</p>
                    ) : (
                        <div className="space-y-6">
                            {Object.entries(sadnaPivotData).map(([kind, items]) => {
                                const allRows = createRowData(kind, items);
                                const filteredRows = allRows.filter(item => {
                                    if (!searchTerms.sadna) return true;
                                    
                                    const searchLower = searchTerms.sadna.toLowerCase();
                                    const nameMatch = item.name.toLowerCase().includes(searchLower);
                                    const kindMatch = item.kind.toLowerCase().includes(searchLower);
                                    const idMatch = item.ids.some(id => id.toString().includes(searchTerms.sadna));
                                    
                                    return nameMatch || kindMatch || idMatch;
                                });
                                
                                // Only show the kind section if it has matching items or no search
                                if (filteredRows.length === 0 && searchTerms.sadna) {
                                    return null;
                                }
                                
                                return (
                                    <div key={kind} className="border border-orange-200 rounded-md p-3 bg-white">
                                        <h3 className="text-lg font-semibold mb-3 text-right text-orange-700">
                                            סוג: {kind}
                                        </h3>
                                        <div
                                            className="ag-theme-alpine rtl"
                                            style={{height: "200px", width: "100%", direction: "rtl"}}
                                        >
                                            <AgGridReact
                                                rowData={filteredRows}
                                                columnDefs={sadnaColumnDefs}
                                                defaultColDef={defaultColDef}
                                                pagination={false}
                                                enableRtl={true}
                                                domLayout="normal"
                                                rowHeight={80}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                            {searchTerms.sadna && Object.entries(sadnaPivotData).every(([kind, items]) => {
                                const filteredRows = createRowData(kind, items)
                                    .filter(item =>
                                        item.name.toLowerCase().includes(searchTerms.sadna.toLowerCase()) ||
                                        item.kind.toLowerCase().includes(searchTerms.sadna.toLowerCase()) ||
                                        item.ids.some(id => id.toString().includes(searchTerms.sadna))
                                    );
                                return filteredRows.length === 0;
                            }) && (
                                <p className="text-center text-gray-500 p-4">לא נמצאו תוצאות עבור החיפוש</p>
                            )}
                        </div>
                    )}
                </div>
            )}
            
            {/* Modals */}
            <EditItemModal
                isOpen={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                itemId={selectedItemId || 0}
                currentLocation={selectedItemLocation}
                itemName={selectedItemName}
                itemKind={selectedItemKind}
                onSuccess={(message: string) => {
                    logAction(message);
                    fetchData();
                    setStatusMessage({text: message, type: "success"});
                }}
                onError={(message: string) => {
                    setStatusMessage({text: message, type: "error"});
                }}
            />
            
            <AddNewItemModal
                isOpen={addNewItemModalOpen}
                onClose={() => setAddNewItemModalOpen(false)}
                onSuccess={(message: string) => {
                    logAction(message);
                    fetchData();
                    setStatusMessage({text: message, type: "success"});
                }}
                onError={(message: string) => {
                    setStatusMessage({text: message, type: "error"});
                }}
            />
            
            <AddItemIdModal
                isOpen={addItemIdModalOpen}
                onClose={() => setAddItemIdModalOpen(false)}
                onSuccess={(message: string) => {
                    logAction(message);
                    fetchData();
                    setStatusMessage({text: message, type: "success"});
                }}
                onError={(message: string) => {
                    setStatusMessage({text: message, type: "error"});
                }}
            />
            
            {/* Item Search Results Modal */}
            {itemSearchModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="bg-purple-600 text-white p-4 flex justify-between items-center">
                            <button
                                onClick={() => setItemSearchModalOpen(false)}
                                className="text-white hover:text-gray-200 text-2xl font-bold"
                            >
                                ×
                            </button>
                            <div className="text-right">
                                <h2 className="text-xl font-bold">{searchItemName}</h2>
                                <p className="text-sm">סה"כ: {totalItemCount}</p>
                            </div>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-1">
                            {searchLoading ? (
                                <div className="flex flex-col items-center justify-center py-8">
                                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mb-4"></div>
                                    <p className="text-center text-gray-500">טוען נתונים...</p>
                                </div>
                            ) : searchedItems.length === 0 ? (
                                <p className="text-center text-gray-500 p-4">לא נמצאו פריטים</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full border-collapse">
                                        <thead>
                                            <tr className="bg-purple-600 text-white">
                                                <th className="border border-purple-400 px-4 py-2 text-center font-semibold">מסד</th>
                                                <th className="border border-purple-400 px-4 py-2 text-center font-semibold">מיקום</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {searchedItems.map((item, index) => (
                                                <tr
                                                    key={item.id}
                                                    className={`${index % 2 === 0 ? 'bg-white' : 'bg-purple-50'} hover:bg-purple-100 cursor-pointer`}
                                                    onClick={() => {
                                                        handleIdClick(item.id, item.location, item.name, item.kind);
                                                        setItemSearchModalOpen(false);
                                                    }}
                                                >
                                                    <td className="border border-purple-200 px-4 py-2 text-center font-medium">{item.id}</td>
                                                    <td className="border border-purple-200 px-4 py-2 text-center">{item.location}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                        
                        <div className="bg-gray-100 p-4 flex justify-center">
                            <button
                                onClick={() => setItemSearchModalOpen(false)}
                                className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 font-semibold"
                            >
                                סגור
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ArmoryStocks;