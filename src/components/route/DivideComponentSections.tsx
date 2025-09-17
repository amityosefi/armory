import type {SheetGroup} from "@/types";
import React, {useState} from "react";
import {useParams} from "react-router-dom";
import TabsNavigation from "@/components/route/TabsNavigation";
import {useNavigate} from "react-router-dom";
import {sheetGroups} from "@/constants";
import SheetGroupPage from "@/components/SheetGroupPage";
import Logistic from "@/components/Logistic";
import Equipment from "@/components/Logistic";
import EquipmentStock from "@/components/EquipmentStock";
import EquipmentSum from "@/components/EquipmentSum";

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




    return (
        <>
            <h2 className="text-xl font-semibold mb-4">{currentGroup.name}</h2>

            <TabsNavigation
                sheets={currentGroup.sheets}
                activeTabIndex={activeTabIndex}
                onTabChange={handleTabChange}
            />

            {/* armory*/}
            {(groupIndex === 0 || groupIndex === 1) && (
                <SheetGroupPage
                    accessToken={accessToken}
                    sheetGroups={sheetGroups}
                />
            )}

            {/* logistic*/}
            {(groupIndex === 2 && (selectedSheet.range === 'גדוד' || selectedSheet.range === 'מחסן')) ? (
                <EquipmentStock selectedSheet={selectedSheet}
                />
            ) : (groupIndex === 2 && selectedSheet.range === 'סיכום') ? (
                <EquipmentSum selectedSheet={selectedSheet}
                />
            ) : (groupIndex === 2) && (
                <Logistic selectedSheet={selectedSheet}
                />
            )
            }


        </>

    );
}
export default DivideComponents;
