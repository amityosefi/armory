import {useState} from 'react';
import useIsMobile from '../../hooks/useIsMobile';
import {usePermissions} from "@/contexts/PermissionsContext";

interface TabsNavigationProps {
    sheets: Array<{ name: string, range: string }>;
    activeTabIndex: number;
    onTabChange: (index: number) => void;
    section: string,
    creditButton?: React.ReactNode;
    storedButton?: React.ReactNode;
    downloadedData?: React.ReactNode;
    assignWeaponButton?: React.ReactNode;
    addWeaponOrOptic?: React.ReactNode;
    addNewSerialWeaponOrOptic?: React.ReactNode;
    addOpticToGroup?: React.ReactNode;
    downloadSadbaData?: React.ReactNode;
    downloadGroupData?: React.ReactNode;

}

function TabsNavigation({
                            sheets,
                            activeTabIndex,
                            onTabChange,
                            section,
                            creditButton,
                            storedButton,
                            downloadedData,
                            assignWeaponButton,
                            addWeaponOrOptic,
                            addNewSerialWeaponOrOptic,
                            addOpticToGroup,
                            downloadSadbaData,
                            downloadGroupData

                        }: TabsNavigationProps) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const isMobile = useIsMobile();
    const {permissions} = usePermissions();

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

    return (
        <div className="mb-4 border-b border-gray-200 flex justify-between items-center">
            {isMobile ? (
                <div className="relative w-full md:w-auto">
                    <button
                        onClick={toggleDropdown}
                        className="flex items-center justify-between w-full p-4 text-left border-b-2 border-transparent text-blue-600"
                    >
                        <span>{sheets[activeTabIndex]?.name || "Select Tab"}</span>
                        <svg className={`w-5 h-5 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
                             fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd"
                                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                  clipRule="evenodd"/>
                        </svg>
                    </button>

                    {isDropdownOpen && (
                        <ul className="absolute left-0 z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
                            {sheets
                                .map((sheet, idx) => ({ sheet, idx }))
                                .filter(({ sheet }) => permissions[sheet.range] || permissions[section])
                                .map(({ sheet, idx }) => (
                                    <li key={idx}>
                                        <button
                                            className={`w-full text-left p-3 ${activeTabIndex === idx ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
                                            onClick={() => {
                                                onTabChange(idx);
                                                setIsDropdownOpen(false);
                                            }}
                                        >
                                            {sheet.name}
                                        </button>
                                    </li>
                                ))}
                        </ul>
                    )}
                </div>
            ) : (
                <ul className="flex flex-wrap -mb-px">
                    {sheets
                        .map((sheet, idx) => ({ sheet, idx }))
                        .filter(({ sheet }) => permissions[sheet.range] || permissions[section])
                        .map(({ sheet, idx }) => (
                            <li key={idx} className="mr-2">
                                <button
                                    className={`inline-block p-4 ${activeTabIndex === idx
                                        ? 'text-blue-600 border-b-2 border-blue-600 rounded-t-lg'
                                        : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent'}`}
                                    onClick={() => onTabChange(idx)}
                                >
                                    {sheet.name}
                                </button>
                            </li>
                        ))}
                </ul>
            )}

            <div className="flex items-center space-x-2">
                {downloadedData}
                {storedButton}
                {creditButton}
                {assignWeaponButton}
                {addWeaponOrOptic}
                {addNewSerialWeaponOrOptic}
                {addOpticToGroup}
                {downloadSadbaData}
                {downloadGroupData}
            </div>
        </div>
    );
}

export default TabsNavigation;
