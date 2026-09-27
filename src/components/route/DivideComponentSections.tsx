import React, {useState, useEffect} from "react";
import {useParams} from "react-router-dom";
import TabsNavigation from "@/components/route/TabsNavigation";
import {useNavigate} from "react-router-dom";
import Logistic from "@/components/logistics/Logistic";
import LogisticStock from "@/components/logistics/LogisticStock";
import LogisticSum from "@/components/logistics/LogisticSum";
import LogisticDemands from "@/components/logistics/LogisticDemands";
import Ammo from "@/components/ammo/Ammo";
import { sheetGroups } from "@/constants";
import AmmoOrders from "@/components/ammo/AmmoOrders";
import GroupTab from "@/components/ammo/tabs/GroupTab";
import StockTab from "@/components/ammo/tabs/StockTab";
import { GROUP_LOCATIONS, GroupLocation } from "@/components/ammo/types";
import ArmoryGroups from "@/components/armory/ArmoryGroups";
import ArmoryStocks from "@/components/armory/ArmoryStocks";
import ArmorySum from "@/components/armory/ArmorySum";
import ArmoryDocumentation from "@/components/armory/ArmoryDocumentation";
import LogisticDocumentation from "@/components/logistics/LogisticDocumentation";
import AmmoDocumentation from "@/components/ammo/AmmoDocumentation";
import HrPermission from "@/components/hr/hrPermission";
import A15 from "@/components/a15/A15";
import AmmoSum from "@/components/ammo/AmmoSum";


const DivideComponents: React.FC = () => {
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
            case 'נשקיה': return 'armory'
            case 'לוגיסטיקה': return 'logistic'
            case 'שלישות': return 'hr'
            case '15 א': return '15a'
            default: return 'ammo'
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

            {(groupIndex === 0 && (selectedSheet.range === 'גדוד') ? (
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
            ))}

            {/* logistic*/}
            {(groupIndex === 1 && (selectedSheet.range === 'גדוד') ? (
                <LogisticStock selectedSheet={selectedSheet}
                />
            ) : (groupIndex === 1 && selectedSheet.range === 'סיכום') ? (
                <LogisticSum selectedSheet={selectedSheet}
                />
            ) : (groupIndex === 1 && selectedSheet.range === 'דרישות') ? (
                <LogisticDemands selectedSheet={selectedSheet}
                />
            ) : (groupIndex === 1 && selectedSheet.range === 'תיעוד') ? (
                <LogisticDocumentation/>
            ) : (groupIndex === 1) && (
                <Logistic selectedSheet={selectedSheet}
                />
            ))}

            {/* ammo section (v2 — new inventory & request flow) */}
            {groupIndex === 2 && (
                (GROUP_LOCATIONS as readonly string[]).includes(selectedSheet.range) ? (
                    <GroupTab location={selectedSheet.range as GroupLocation} />
                ) : selectedSheet.range === 'גדוד' ? (
                    <StockTab />
                ) : selectedSheet.range === 'סיכום' ? (
                    <AmmoSum/>
                ) : selectedSheet.range === 'שצל' ? (
                    <AmmoOrders selectedSheet={selectedSheet} />
                ) : selectedSheet.range === 'תיעוד' ? (
                    <AmmoDocumentation />
                ) : (
                    <Ammo selectedSheet={selectedSheet} />
                )
            )}

            {(groupIndex === 3) && (
                <HrPermission selectedSheet={selectedSheet}
                />
            )}

            {(groupIndex === 4) && (
                <A15 selectedSheet={selectedSheet}
                />
            )}


        </>

    );
}
export default DivideComponents;
