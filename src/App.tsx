import { useState } from 'react'
import type { TokenResponse } from '@react-oauth/google'
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import LoginScreen from './components/LoginScreen'
import NavBar from './components/route/NavBar'
import './css/App.css'
import AdminPage from './components/AdminPage'
import { PermissionsProvider } from './contexts/PermissionsContext'
import DivideComponents from "@/components/route/DivideComponentSections"
import SoldierArmoryPage from './components/armory/SoldierArmoryPage';

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
                            <Route path="/" element={<Navigate to="/armory/0" replace />} />
                            <Route
                                path="/soldier/:soldierID"
                                element={
                                    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 w-full" dir="rtl">
                                        <SoldierArmoryPage />
                                    </div>
                                }
                            />
                            <Route
                                path="/admin"
                                element={
                                    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 w-full" dir="rtl">
                                        <div className="w-full max-w-full md:px-4">
                                            <NavBar
                                                onSignOut={handleSignOut}
                                            />
                                            <AdminPage />
                                        </div>
                                    </div>
                                }
                            />
                            <Route
                                path="/:groupName/:tabIndex"
                                element={
                                    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 w-full" dir="rtl">
                                        <div className="w-full max-w-full md:px-4">
                                            <NavBar
                                                onSignOut={handleSignOut}
                                            />
                                            <DivideComponents />
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
