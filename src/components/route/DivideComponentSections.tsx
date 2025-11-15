import type {SheetGroup} from "@/types";
import React, {useState, useEffect} from "react";
import {useParams} from "react-router-dom";
import TabsNavigation from "@/components/route/TabsNavigation";
import {useNavigate} from "react-router-dom";
import SheetGroupPage from "@/components/SheetGroupPage";
import Logistic from "@/components/logistics/Logistic";
import EquipmentStock from "@/components/logistics/EquipmentStock";
import EquipmentSum from "@/components/logistics/EquipmentSum";
import Ammo from "@/components/ammo/Ammo";
import AmmoStock from "@/components/ammo/AmmoStock";
import AmmoSum from "@/components/ammo/AmmoSum";
import AmmoOrders from "@/components/ammo/AmmoOrders";
import ArmoryGroups from "@/components/armory/ArmoryGroups";
import ArmoryStocks from "@/components/armory/ArmoryStocks";
import ArmorySum from "@/components/armory/ArmorySum";
import ArmoryDocumentation from "@/components/armory/ArmoryDocumentation";

interface DivideComponentsProps {
    accessToken: string;
    sheetGroups: SheetGroup[];
}

const DivideComponents: React.FC<DivideComponentsProps> = ({accessToken, sheetGroups}) => {
    const {groupName, tabIndex} = useParams();
    const currentGroup = sheetGroups.find(group => group.pathName === groupName) || sheetGroups[0];
    const groupIndex = sheetGroups.findIndex(group => group.pathName === groupName);
    const [activeTabIndex, setActiveTabIndex] = useState(parseInt(tabIndex || '0')); // Initialize from URL
    const selectedSheet = currentGroup.sheets[activeTabIndex] || currentGroup.sheets[0];
    const navigate = useNavigate();

    // Sync activeTabIndex with URL parameter changes
    useEffect(() => {
        const newTabIndex = parseInt(tabIndex || '0');
        if (newTabIndex !== activeTabIndex) {
            setActiveTabIndex(newTabIndex);
        }
    }, [tabIndex]);

    const handleTabChange = (newSheetIndex: number) => {
        setActiveTabIndex(newSheetIndex);
        navigate(`/${groupName}/${newSheetIndex}`);
    };

    const whichSection = () => {
        switch (currentGroup.name){
            case 'נשקיה': return 'Armory'
            case 'לוגיסטיקה': return 'Logistic'
            default: return 'munitions'
        }
    }

    return (
        <>
            <h2 className="text-xl font-semibold mb-4">{currentGroup.name}</h2>

            <TabsNavigation
                sheets={currentGroup.sheets}
                activeTabIndex={activeTabIndex}
                onTabChange={handleTabChange}
                section={whichSection()}
            />

            {/* armory*/}
            {/*{(groupIndex === 0 ) && (*/}
            {/*    <SheetGroupPage*/}
            {/*        accessToken={accessToken}*/}
            {/*        sheetGroups={sheetGroups}*/}
            {/*    />*/}
            {/*)}*/}

            {(groupIndex === 0 && (selectedSheet.range === 'גדוד' || selectedSheet.range === 'מחסן') || selectedSheet.range === 'סדנא') ? (
                <ArmoryStocks selectedSheet={selectedSheet}
                />
            ) : (groupIndex === 0 && selectedSheet.range === 'סיכום') ? (
                <ArmorySum selectedSheet={selectedSheet}
                />
            ) : (groupIndex === 0 && selectedSheet.range === 'תיעוד') ? (
                < ArmoryDocumentation/>
            ) : (groupIndex === 0) && (
                <ArmoryGroups selectedSheet={selectedSheet}
                />
            )}

            {/* logistic*/}
            {(groupIndex === 1 && (selectedSheet.range === 'גדוד' || selectedSheet.range === 'מחסן')) ? (
                <EquipmentStock selectedSheet={selectedSheet}
                />
            ) : (groupIndex === 1 && selectedSheet.range === 'סיכום') ? (
                <EquipmentSum selectedSheet={selectedSheet}
                />
            ) : (groupIndex === 1) && (
                <Logistic selectedSheet={selectedSheet}
                />
            )}

            {/* ammo section */}
            {(groupIndex === 2 && (selectedSheet.range === 'גדוד' || selectedSheet.range === 'מחסן')) ? (
                <AmmoStock selectedSheet={selectedSheet}
                />
            ) : (groupIndex === 2 && selectedSheet.range === 'סיכום') ? (
                <AmmoSum selectedSheet={selectedSheet}
                />
            ) : (groupIndex === 2 && selectedSheet.range === 'שצל') ? (
                <AmmoOrders selectedSheet={selectedSheet}
                />
            ) : (groupIndex === 2) && (
                <Ammo selectedSheet={selectedSheet}
                />
            )}


        </>

    );
}
export default DivideComponents;
