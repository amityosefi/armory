import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore } from "@/stores/useAuthStore";
import Shayarot from "./Shayarot";

interface A15Props {
    selectedSheet: {
        name: string;
        range: string;
        id: number;
    };
}

const A15: React.FC<A15Props> = ({selectedSheet}) => {
    const [activeTab, setActiveTab] = useState("binuy");
    const permissions = useAuthStore((state) => state.permissions);

    const permissionKeys = ["א", "ב", "ג", "מסייעת", "אלון", "מכלול", "פלסם", "15a"];
    const activePermission = permissionKeys.find(key => permissions[key] === true);

    return (
        <div className="container mx-auto p-4">
            <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-4">
                    <TabsTrigger value="binuy" className="text-sm">דוח פערי בינוי</TabsTrigger>
                    <TabsTrigger value="shayarot" className="text-sm">שיירות כ״א</TabsTrigger>
                    <TabsTrigger value="tazqiqim" className="text-sm">דוח תזקיקים</TabsTrigger>
                    <TabsTrigger value="otzma" className="text-sm">דוח עוצמה</TabsTrigger>
                </TabsList>

                <TabsContent value="binuy" className="mt-4">
                    <div className="p-4 border rounded-lg bg-gray-50">
                        <h3 className="text-lg font-semibold mb-2 text-right">דוח פערי בינוי</h3>
                        <p className="text-right text-gray-600">תוכן דוח פערי בינוי יופיע כאן</p>
                    </div>
                </TabsContent>

                <TabsContent value="shayarot" className="mt-4">
                    <div className="p-4 border rounded-lg bg-gray-50">
                        <Shayarot activePermission={activePermission} />
                    </div>
                </TabsContent>

                <TabsContent value="tazqiqim" className="mt-4">
                    <div className="p-4 border rounded-lg bg-gray-50">
                        <h3 className="text-lg font-semibold mb-2 text-right">דוח תזקיקים</h3>
                        <p className="text-right text-gray-600">תוכן דוח תזקיקים יופיע כאן</p>
                    </div>
                </TabsContent>

                <TabsContent value="otzma" className="mt-4">
                    <div className="p-4 border rounded-lg bg-gray-50">
                        <h3 className="text-lg font-semibold mb-2 text-right">דוח עוצמה</h3>
                        <p className="text-right text-gray-600">תוכן דוח עוצמה יופיע כאן</p>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

export default A15;