import { useState } from 'react'
import type { TokenResponse } from '@react-oauth/google'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import LoginScreen from './components/LoginScreen'
import SheetGroupPage from './components/SheetGroupPage'
import NavBar from './components/NavBar'
import { sheetGroups } from './constants'
import './css/App.css'
import SoldierPage from './components/SoldierPage'
import AdminPage from './components/AdminPage'
import { PermissionsProvider } from './contexts/PermissionsContext'
import DivideComponents from "@/components/route/DivideComponentSections";

function App() {
    const [user, setUser] = useState<TokenResponse | null>(null)

    const handleLoginSuccess = (response: TokenResponse) => {
        setUser(response)
    }

    const handleSignOut = () => {
        localStorage.removeItem('googleAuthToken')
        localStorage.removeItem('userEmail')
        setUser(null)
    }

    return (
        <PermissionsProvider>
            <Router>
                <Routes>
                    <Route
                        path="/login"
                        element={<LoginScreen onLoginSuccess={handleLoginSuccess} />}
                    />

                    {user ? (
                        <>
                            <Route path="/" element={<Navigate to="/group/0" replace />} />
                            <Route
                                path="/sheet/:sheetName/soldier/:soldierIndex"
                                element={
                                    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 w-full" dir="rtl">
                                        <SoldierPage accessToken={user.access_token} />
                                    </div>
                                }
                            />
                            <Route
                                path="/admin"
                                element={
                                    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 w-full" dir="rtl">
                                        <AdminPage />
                                    </div>
                                }
                            />
                            <Route
                                path="/group/:groupId/sheet/:sheetIndex/row/:rowIndex/*"
                                element={
                                    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 w-full" dir="rtl">
                                        <div className="w-full max-w-full md:px-4">
                                            <NavBar
                                                sheetGroups={sheetGroups}
                                                accessToken={user.access_token}
                                                onSignOut={handleSignOut}
                                            />
                                            {/*<SheetGroupPage*/}
                                            {/*    accessToken={user.access_token}*/}
                                            {/*    sheetGroups={sheetGroups}*/}
                                            {/*/>*/}
                                            <DivideComponents accessToken={user.access_token} sheetGroups={sheetGroups} />
                                        </div>
                                    </div>
                                }
                            />
                        </>
                    ) : (
                        <Route path="*" element={<Navigate to="/login" replace />} />
                    )}
                </Routes>
            </Router>
        </PermissionsProvider>
    )
}

export default App
