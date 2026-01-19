import React, { useState, useEffect, useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { supabase } from "@/lib/supabaseClient";
import { ColDef } from "ag-grid-community";
import { usePermissions } from "@/contexts/PermissionsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import AddSoldierModal from "./AddSoldierModal";
import StatusMessage from "@/components/feedbackFromBackendOrUser/StatusMessageProps";
import { Download, LayoutGrid, Table, List } from "lucide-react";
import { exportMultipleSoldiersPDF } from "./SoldierPDFExport";

interface ArmoryGroupsProps {
    selectedSheet: {
        name: string;
        range: string;
        id: number;
    };
};

type ArmoryItem = {
    id: number;
    name: string;
    kind: string;
    location: string;
    is_save: boolean;
    people_sign: string;
    sign_time: string;
    logistic_sign: string;
    logistic_name: string;
    logistic_id?: string | number;
};

type PersonData = {
    id: string;
    name: string;
    phone: string;
    location: string;
    items: ArmoryItem[];
};

type PersonWithItems = PersonData & {
    אמצעים: string;
};

const ArmoryGroups: React.FC<ArmoryGroupsProps> = ({ selectedSheet }) => {
    const { permissions, isPermissionsLoaded } = usePermissions();
    const navigate = useNavigate();
    const [peopleData, setPeopleData] = useState<PersonData[]>([]);
    const [loading, setLoading] = useState(true);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState({ text: "", isSuccess: false });
    const [viewMode, setViewMode] = useState<"cards" | "table" | "summary">("cards");
    const [searchQuery, setSearchQuery] = useState("");
    const [isAddSoldierModalOpen, setIsAddSoldierModalOpen] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    // Check permissions
    const hasPermission = permissions[selectedSheet.range] || permissions['armory'];

    // Fetch data from Supabase
    const fetchData = async () => {
        if (!isPermissionsLoaded) {
            return;
        }
        
        if (!hasPermission) {
            setLoading(false);
            setStatusMessage({
                text: "אין לך הרשאה לצפות בנתונים אלה",
                isSuccess: false
            });
            return;
        }

        try {
            setLoading(true);

            // 1. Fetch people data where location=selectedSheet.range
            const { data: people, error: peopleError } = await supabase
                .from("people")
                .select("*")
                .eq("location", selectedSheet.range);

            if (peopleError) {
                console.error("Error fetching people data:", peopleError);
                setStatusMessage({
                    text: `שגיאה בטעינת נתוני אנשים: ${peopleError.message}`,
                    isSuccess: false
                });
                setLoading(false);
                return;
            }

            // Show people cards immediately with empty items
            const initialPeopleList: PersonData[] = (people || []).map((person: any) => ({
                name: person.name,
                id: person.id,
                phone: person.phone || '',
                location: person.location,
                items: []
            }));
            
            setPeopleData(initialPeopleList);
            setLoading(false);
            setItemsLoading(true);

            // 2. Fetch only armory_items that belong to these people (with pagination)
            let allItems: ArmoryItem[] = [];
            
            if (people && people.length > 0) {
                const peopleIds = people.map((person: any) => person.id.toString());
                
                const CHUNK_SIZE = 1000;
                let offset = 0;
                let hasMore = true;

                while (hasMore) {
                    const { data: items, error: itemsError } = await supabase
                        .from("armory_items")
                        .select("*")
                        .in("location", peopleIds)
                        .range(offset, offset + CHUNK_SIZE - 1);

                    if (itemsError) {
                        console.error("Error fetching armory items:", itemsError);
                        setStatusMessage({
                            text: `שגיאה בטעינת נתוני אמצעים: ${itemsError.message}`,
                            isSuccess: false
                        });
                        return;
                    }

                    if (items && items.length > 0) {
                        allItems = [...allItems, ...(items as ArmoryItem[])];
                        offset += CHUNK_SIZE;
                        hasMore = items.length === CHUNK_SIZE;
                    } else {
                        hasMore = false;
                    }
                }

                // 3. Update people with their items after fetching all items
                const peopleWithItemsList: PersonData[] = (people || []).map((person: any) => {
                    const personItems = allItems.filter(item => item.location.toString() === person.id.toString());
                    return {
                        name: person.name,
                        id: person.id,
                        phone: person.phone || '',
                        location: person.location,
                        items: personItems
                    };
                });

                setPeopleData(peopleWithItemsList);
                setItemsLoading(false);
            }

            // Don't clear statusMessage here - let it be cleared by user action or timeout
        } catch (err: any) {
            console.error("Unexpected error:", err);
            setStatusMessage({
                text: `שגיאה לא צפויה: ${err.message}`,
                isSuccess: false
            });
            setLoading(false);
            setItemsLoading(false);
        }
    };

    // Handle download all PDFs
    const handleDownloadAllPDFs = async () => {
        if (peopleData.length === 0) {
            setStatusMessage({
                text: "אין חיילים להורדה",
                isSuccess: false
            });
            return;
        }

        setIsDownloading(true);
        setStatusMessage({
            text: `מכין PDF עם ${peopleData.length} חיילים...`,
            isSuccess: true
        });

        try {
            // Prepare data for all soldiers
            const soldiersData = peopleData.map(person => ({
                soldier: {
                    id: parseInt(person.id),
                    name: person.name,
                    phone: person.phone,
                    location: person.location
                },
                items: person.items
            }));

            // Generate filename with location and date
            const date = new Date().toLocaleDateString('he-IL').replace(/\//g, '-');
            const filename = `${selectedSheet.name}_${date}.pdf`;

            // Export all soldiers in one PDF
            exportMultipleSoldiersPDF(soldiersData, filename);

            setStatusMessage({
                text: `הורד PDF עם ${peopleData.length} חיילים בהצלחה`,
                isSuccess: true
            });
        } catch (error: any) {
            console.error("Error downloading PDF:", error);
            setStatusMessage({
                text: `שגיאה בהורדת קובץ: ${error.message}`,
                isSuccess: false
            });
        } finally {
            setIsDownloading(false);
        }
    };

    // Initial data fetch
    useEffect(() => {
        fetchData();
    }, [selectedSheet.range, hasPermission, isPermissionsLoaded]);

    // Create display data with items as string for UI
    const peopleWithItems = useMemo<PersonWithItems[]>(() => {
        return peopleData.map(person => {
            // Create items string from person.items array
            const itemsString = person.items
                .map(item => `${item.name} (${item.id})`)
                .join(', ');

            return {
                ...person,
                אמצעים: itemsLoading && !itemsString ? 'אמצעים בטעינה...' : (itemsString || '')
            };
        });
    }, [peopleData]);

    // Filter people based on search query
    const filteredPeople = useMemo(() => {
        if (!searchQuery.trim()) return peopleWithItems;
        
        const query = searchQuery.toLowerCase();
        return peopleWithItems.filter(person => {
            return (
                person.name.toLowerCase().includes(query) ||
                person.id.toString().toLowerCase().includes(query) ||
                (person.phone && person.phone.toLowerCase().includes(query)) ||
                person.אמצעים.toLowerCase().includes(query)
            );
        });
    }, [peopleWithItems, searchQuery]);

    // Create summary data - group items by kind, then by name and count
    const summaryData = useMemo(() => {
        const kindGroups: Record<string, Record<string, { count: number; isSaveCount: number }>> = {};
        
        peopleData.forEach(person => {
            person.items.forEach(item => {
                if (!kindGroups[item.kind]) {
                    kindGroups[item.kind] = {};
                }
                if (kindGroups[item.kind][item.name]) {
                    kindGroups[item.kind][item.name].count++;
                    if (item.is_save) {
                        kindGroups[item.kind][item.name].isSaveCount++;
                    }
                } else {
                    kindGroups[item.kind][item.name] = {
                        count: 1,
                        isSaveCount: item.is_save ? 1 : 0
                    };
                }
            });
        });

        // Convert to array format and sort
        return Object.entries(kindGroups).map(([kind, items]) => ({
            kind,
            items: Object.entries(items)
                .map(([name, data]) => ({ name, count: data.count, isSaveCount: data.isSaveCount }))
                .sort((a, b) => b.count - a.count)
        })).sort((a, b) => a.kind.localeCompare(b.kind));
    }, [peopleData]);

    // Column definitions for table view
    const columnDefs = useMemo<ColDef<PersonWithItems>[]>(() => {
        if (peopleWithItems.length === 0) return [];

        // Running number column
        const numberColumn: ColDef<PersonWithItems> = {
            headerName: '#',
            valueGetter: (params) => {
                return params.node?.rowIndex != null ? params.node.rowIndex + 1 : '';
            },
            sortable: false,
            filter: false,
            width: 70,
            pinned: 'right',
        };

        const samplePerson = peopleWithItems[0];
        const personKeys = Object.keys(samplePerson).filter(key => key !== 'אמצעים' && key !== 'items' && key !== 'location' && key !== 'id' && key !== 'phone');

        const personColumns: ColDef<PersonWithItems>[] = personKeys.map(key => ({
            field: key as keyof PersonWithItems,
            headerName: key === "id" ? "מספר אישי" :
                        key === "name" ? "שם" :
                        key === "phone" ? "פלאפון" : key,
            sortable: true,
            filter: 'agTextColumnFilter',
            filterParams: {
                filterOptions: ['contains'],
                defaultOption: 'contains',
            },
            width: key === "id" ? 130 : key === "name" ? 150 : key === "phone" ? 130 : 100,
            cellStyle: key === "name" ? { textAlign: 'right' } : undefined,
        }));

        // Add items column at the end
        const itemsColumn: ColDef<PersonWithItems> = {
            field: 'אמצעים',
            headerName: 'אמצעים',
            sortable: true,
            filter: 'agTextColumnFilter',
            filterParams: {
                filterOptions: ['contains'],
                defaultOption: 'contains',
            },
            flex: 2,
            minWidth: 200,
            wrapText: true,
            autoHeight: true,
            cellStyle: { textAlign: 'right' },
            headerClass: 'ag-right-aligned-header',
        };

        return [numberColumn, ...personColumns, itemsColumn];
    }, [peopleWithItems]);

    // Default column definition for AG Grid
    const defaultColDef = {
        headerClass: 'ag-right-aligned-header',
        cellStyle: { textAlign: 'center' },
        resizable: true,
    };

    if (loading) {
        return (
            <div className="container mx-auto p-4">
                <div className="flex flex-col items-center justify-center h-[60vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                    <p className="text-center p-4">טוען נתונים...</p>
                </div>
            </div>
        );
    }

    if (!hasPermission) {
        return (
            <div className="container mx-auto p-4">
                <div className="flex flex-col items-center justify-center h-[60vh]">
                    <p className="text-center p-4 text-red-600 text-xl">אין לך הרשאה לצפות בנתונים אלה</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 space-y-4">
            {/* Status Message */}
            {statusMessage.text && (
                <div className="mb-4">
                    <StatusMessage
                        isSuccess={statusMessage.isSuccess}
                        message={statusMessage.text}
                        onClose={() => setStatusMessage({ text: "", isSuccess: false })}
                    />
                </div>
            )}

            {/* Add Soldier Button and Download Button */}
            {permissions['armory'] && (
                <div className="flex justify-center gap-4 mb-4">
                    <Button
                        onClick={() => setIsAddSoldierModalOpen(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg"
                    >
                        ➕ הוספת חייל
                    </Button>
                    <Button
                        onClick={handleDownloadAllPDFs}
                        disabled={isDownloading || peopleData.length === 0}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg shadow-lg flex items-center gap-2"
                    >
                        <Download className="w-5 h-5" />
                        {isDownloading ? 'מוריד...' : 'הורדה לקלסר'}
                    </Button>
                </div>
            )}

            {/* Header with title and view toggle */}
            <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
                <h2 className="text-2xl font-bold text-right">{selectedSheet.name}</h2>
                <div className="flex flex-wrap gap-2">
                    <Button
                        onClick={() => setViewMode("cards")}
                        variant={viewMode === "cards" ? "default" : "outline"}
                        size="icon"
                    >
                        <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                        onClick={() => setViewMode("table")}
                        variant={viewMode === "table" ? "default" : "outline"}
                        size="icon"
                    >
                        <Table className="h-4 w-4" />
                    </Button>
                    <Button
                        onClick={() => setViewMode("summary")}
                        variant={viewMode === "summary" ? "default" : "outline"}
                        size="icon"
                    >
                        <List className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Search bar - only show for cards view */}
            {viewMode === "cards" && (
                <div className="mb-4">
                    <Input
                        type="text"
                        placeholder="חיפוש..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="max-w-md text-right"
                        dir="rtl"
                    />
                </div>
            )}


            {peopleData.length === 0 ? (
                <div className="text-center p-8 text-gray-500">
                    <p className="text-xl">אין נתונים להצגה עבור {selectedSheet.range}</p>
                </div>
            ) : (
                <>
                    {/* Card View */}
                    {viewMode === "cards" && (
                        <>
                            {filteredPeople.length === 0 ? (
                                <div className="text-center p-8 text-gray-500">
                                    <p className="text-lg">לא נמצאו תוצאות עבור "{searchQuery}"</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
                                    {filteredPeople.map((person) => (
                                        <div
                                            key={person.id}
                                            onClick={() => navigate(`/soldier/${person.id}`)}
                                            className="border-2 border-blue-300 rounded-lg p-2 bg-white shadow-md hover:shadow-xl hover:scale-105 hover:border-blue-500 transition-all duration-200 cursor-pointer"
                                        >
                                            {/* Header - Name */}
                                            <div className="mb-2 pb-1 border-b-2 border-blue-200">
                                                <h3 className="text-base font-bold text-right text-blue-800">
                                                    {person.name}
                                                </h3>
                                            </div>

                                            {/* ID and Phone */}
                                            <div className="space-y-1 mb-2 text-right text-xs">
                                                <div>
                                                    <span className="font-semibold text-gray-700">מספר אישי: </span>
                                                    <span className="text-gray-900">{person.id}</span>
                                                </div>
                                                {person.phone && (
                                                    <div>
                                                        <span className="font-semibold text-gray-700">פלאפון: </span>
                                                        <span className="text-gray-900">{person.phone}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Items */}
                                            <div className="mt-2 pt-1 border-t border-gray-200">
                                                <p className="font-semibold text-gray-700 text-right mb-1 text-xs">אמצעים:</p>
                                                <p className="text-xs text-gray-600 text-right break-words">
                                                    {person.אמצעים}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}

                    {/* Summary View */}
                    {viewMode === "summary" && (
                        <div className="space-y-6">
                            {summaryData.map((kindGroup, kindIndex) => (
                                <div key={kindIndex} className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50">
                                    <h3 className="text-xl font-bold text-right text-blue-800 mb-4">
                                        {kindGroup.kind}
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                        {kindGroup.items.map((item, itemIndex) => (
                                            <div
                                                key={itemIndex}
                                                className="border border-blue-300 rounded-lg p-2 bg-white shadow-sm text-right"
                                                dir="rtl"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold text-gray-800">{item.name}</span>
                                                    <span className="text-base font-bold text-blue-600">({item.count})</span>
                                                </div>
                                                {kindGroup.kind === 'נשק' && (
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <span className="text-xs font-semibold text-green-600">מאופסנים: {item.isSaveCount}</span>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Table View */}
                    {viewMode === "table" && (
                        <div className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50">
                            <div
                                className="ag-theme-alpine rtl"
                                style={{ height: "60vh", width: "100%", direction: "rtl" }}
                            >
                                <AgGridReact
                                    rowData={filteredPeople}
                                    columnDefs={columnDefs}
                                    defaultColDef={defaultColDef}
                                    enableRtl={true}
                                    domLayout="normal"
                                    getRowStyle={(params) => {
                                        if (params.node.rowIndex != null && params.node.rowIndex % 2 === 1) {
                                            return { background: '#e3f2fd' };
                                        }
                                        return undefined;
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Add Soldier Modal */}
            <AddSoldierModal
                isOpen={isAddSoldierModalOpen}
                onClose={() => setIsAddSoldierModalOpen(false)}
                onSuccess={(message: string, isSuccess: boolean) => {
                    setStatusMessage({
                        text: message,
                        isSuccess: isSuccess
                    });
                    setIsAddSoldierModalOpen(false);
                    fetchData(); // Refresh data after adding soldier
                }}
                currentLocation={selectedSheet.range}
            />
        </div>
    );
};

export default ArmoryGroups;
