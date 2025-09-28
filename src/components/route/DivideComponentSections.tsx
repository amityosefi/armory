import type {SheetGroup} from "@/types";
import React, {useState} from "react";
import {useParams} from "react-router-dom";
import TabsNavigation from "@/components/route/TabsNavigation";
import {useNavigate} from "react-router-dom";
import {sheetGroups} from "@/constants";
import SheetGroupPage from "@/components/SheetGroupPage";
import Logistic from "@/components/logistics/Logistic";
import Equipment from "@/components/logistics/Logistic";
import EquipmentStock from "@/components/logistics/EquipmentStock";
import EquipmentSum from "@/components/logistics/EquipmentSum";
import Ammo from "@/components/ammo/Ammo";
import AmmoStock from "@/components/ammo/AmmoStock";
import AmmoSum from "@/components/ammo/AmmoSum";
import AmmoOrders from "@/components/ammo/AmmoOrders";
import {hasPermission} from "@/utils/permissions";

interface DivideComponentsProps {
    accessToken: string;
    sheetGroups: SheetGroup[];
}

const DivideComponents: React.FC<DivideComponentsProps> = ({accessToken, sheetGroups}) => {
    const {groupId, sheetIndex} = useParams();
    const groupIndex = parseInt(groupId || '0');
    const currentGroup = sheetGroups[groupIndex] || sheetGroups[0];
    const [activeTabIndex, setActiveTabIndex] = useState(parseInt(sheetIndex || '0')); // Initialize from URL
    const selectedSheet = currentGroup.sheets[activeTabIndex] || currentGroup.sheets[0];
    const navigate = useNavigate();

    const handleTabChange = (newSheetIndex: number) => {
        setActiveTabIndex(newSheetIndex);
        navigate(`/group/${groupId}/sheet/${newSheetIndex}/row/0`);
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
            {(groupIndex === 0 ) && (
                <SheetGroupPage
                    accessToken={accessToken}
                    sheetGroups={sheetGroups}
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
