import {useEffect, useMemo, useState} from 'react';
import useIsMobile from '../../hooks/useIsMobile';
import {usePermissions} from "@/contexts/PermissionsContext";

interface TabsNavigationProps {
    sheets: Array<{ name: string, range: string }>;
    activeTabIndex: number;
    onTabChange: (index: number) => void;
    section: string
}

function TabsNavigation({
                            sheets,
                            activeTabIndex,
                            onTabChange,
                            section

                        }: TabsNavigationProps) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const isMobile = useIsMobile();
    const {permissions, isPermissionsLoaded} = usePermissions();

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

    // Build visible tabs with original indices BEFORE filtering
    const visibleTabs = useMemo(
        () => {
            if (!isPermissionsLoaded) return [];
            return sheets
                .map((sheet, idx) => ({sheet, idx}))
                .filter(({sheet}) => permissions[sheet.range] || permissions[section]);
        },
        [sheets, permissions, section, isPermissionsLoaded]
    );

    // Ensure activeTabIndex always points to a permitted tab
    const isActivePermitted = useMemo(
        () => visibleTabs.some(t => t.idx === activeTabIndex),
        [visibleTabs, activeTabIndex]
    );

    useEffect(() => {
        if (isPermissionsLoaded && !isActivePermitted && visibleTabs.length > 0) {
            // Snap to first permitted tab using original index
            onTabChange(visibleTabs[0].idx);
        }
    }, [isActivePermitted, visibleTabs, onTabChange, isPermissionsLoaded]);

    // Compute label for mobile header from permitted tabs
    const activeLabel = useMemo(() => {
        const active = visibleTabs.find(t => t.idx === activeTabIndex);
        return active?.sheet.name ?? visibleTabs[0]?.sheet.name ?? 'Select Tab';
    }, [visibleTabs, activeTabIndex]);

    if (!isPermissionsLoaded) {
        return null;
    }

    return (
        <div className="mb-4 border-b border-gray-200 flex justify-between items-center">
            {isMobile ? (
                <div className="relative w-full md:w-auto">
                    <button
                        onClick={toggleDropdown}
                        className="flex items-center justify-between w-full p-4 text-left border-b-2 border-transparent text-blue-600"
                    >
                        <span>{activeLabel}</span>
                        <svg className={`w-5 h-5 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
                             fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd"
                                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                  clipRule="evenodd"/>
                        </svg>
                    </button>

                    {isDropdownOpen && (
                        <ul className="absolute left-0 z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
                            {visibleTabs
                                .map(({ sheet, idx }) => (
                                    <li key={idx}>
                                        <button
                                            className={`w-full text-left p-3 ${activeTabIndex === idx ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                                            onClick={() => {
                                                onTabChange(idx);
                                                setIsDropdownOpen(false);
                                            }}
                                        >
                                            {sheet.range}
                                        </button>
                                    </li>
                                ))}
                        </ul>
                    )}
                </div>
            ) : (
                <ul className="flex flex-wrap -mb-px">
                    {visibleTabs
                        .map(({ sheet, idx }) => (
                            <li key={idx} className="mr-2">
                                <button
                                    className={`inline-block p-4 ${activeTabIndex === idx
                                        ? 'text-blue-600 border-b-2 border-blue-600 rounded-t-lg'
                                        : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent'}`}
                                    onClick={() => onTabChange(idx)}
                                >
                                    {sheet.range}
                                </button>
                            </li>
                        ))}
                </ul>
            )}
        </div>
    );
}

export default TabsNavigation;
