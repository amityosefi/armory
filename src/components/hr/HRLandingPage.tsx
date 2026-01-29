import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FileText, ClipboardList, Heart } from 'lucide-react';

const HRLandingPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400" dir="rtl">
            {/* Header */}
            <div className="bg-white/10 backdrop-blur-sm text-white py-6 px-4 shadow-lg">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <Button
                        variant="outline"
                        onClick={() => navigate('/')}
                        className="bg-white/20 text-white border-white/30 hover:bg-white/30"
                    >
                        ← חזרה להתחברות
                    </Button>
                    <h1 className="text-3xl md:text-4xl font-bold text-center">
                        🏢 מערכת טפסים דיגיטליים
                    </h1>
                    <div className="w-32"></div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto p-6 md:p-12">
                <div className="text-center mb-12">
                    <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                        בחר את הטופס שברצונך למלא
                    </h2>
                    <p className="text-white/90 text-lg">
                        כל הטפסים זמינים למילוי דיגיטלי והורדה מיידית
                    </p>
                </div>

                {/* Form Cards */}
                <div className="flex flex-wrap justify-center gap-4">
                    {/* טופס 445 */}
                    <Link
                        to="/hr445"
                        className="w-48 h-48 border-4 border-green-500 rounded-2xl p-4 bg-white hover:bg-green-50 transition-colors flex flex-col items-center justify-center gap-2 shadow-lg"
                    >
                        <div className="text-4xl">🤝</div>
                        <h2 className="text-xl font-bold text-green-800 text-center">
                            טופס 445
                        </h2>
                        <p className="text-gray-600 text-center text-xs">
                            טופס דיגיטלי למילוי טופס 445
                        </p>
                    </Link>

                    {/* בקשה לוועדה ללא נוכחות */}
                    <Link
                        to="/committee-request"
                        className="w-48 h-48 border-4 border-blue-500 rounded-2xl p-4 bg-white hover:bg-blue-50 transition-colors flex flex-col items-center justify-center gap-2 shadow-lg"
                    >
                        <div className="text-4xl">📋</div>
                        <h2 className="text-xl font-bold text-blue-800 text-center">
                            בקשה לוועדה ללא נוכחות
                        </h2>
                        <p className="text-gray-600 text-center text-xs">
                            טופס לבקשת דיון בוועדה ללא נוכחות פיזית
                        </p>
                    </Link>

                    {/* ויתור על סודיות רפואית */}
                    <Link
                        to="/medical-waiver"
                        className="w-48 h-48 border-4 border-orange-500 rounded-2xl p-4 bg-white hover:bg-orange-50 transition-colors flex flex-col items-center justify-center gap-2 shadow-lg"
                    >
                        <div className="text-4xl">🏥</div>
                        <h2 className="text-xl font-bold text-orange-800 text-center">
                            ויתור על סודיות רפואית
                        </h2>
                        <p className="text-gray-600 text-center text-xs">
                            טופס ויתור על סודיות רפואית למטרות רפואיות
                        </p>
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default HRLandingPage;
