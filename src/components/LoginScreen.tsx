import React, {useEffect, useState} from 'react'
import {TokenResponse, useGoogleLogin} from '@react-oauth/google'
import {useAuthStore} from '@/stores/useAuthStore'
import {usePermissions} from '@/contexts/PermissionsContext'
import {supabase} from '@/lib/supabaseClient' // <-- your supabase client
import logo from '@/assets/logo.jpeg' // Import the logo
import {Navigate, Link} from "react-router-dom";
import RegistrationForm from '@/components/RegistrationForm';

interface LoginScreenProps {
    onLoginSuccess: (response: TokenResponse) => void
}

const SESSION_TIMEOUT = 600000; // 10 minutes in milliseconds

const LoginScreen: React.FC<LoginScreenProps> = ({onLoginSuccess}) => {
    const [isLoading, setIsLoading] = useState(true)
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [authChecked, setAuthChecked] = useState(false)
    const [showRegistration, setShowRegistration] = useState(false)

    const setAuth = useAuthStore((state) => state.setAuth)
    const {setPermissions, permissions, setIsPermissionsLoaded} = usePermissions()

    // Helper function to determine redirect path based on permissions
    const getRedirectPath = () => {
        
        // Check for Plugot permissions (company-level access)
        // Map company names to their tab indices in the armory section
        const plugotMapping: { [key: string]: number } = {
            'א': 0,
            'ב': 1,
            'ג': 2,
            'מסייעת': 3,
            'אלון': 4,
            'מכלול': 5,
            'פלסם': 6
        };
        
        // Find the first company permission they have and navigate to that tab
        for (const [plugaName, tabIndex] of Object.entries(plugotMapping)) {
            if (permissions[plugaName]) {
                return `/armory/${tabIndex}`;
            }
        }

        if (permissions['armory'])
            return '/armory/0';
        else if (permissions['logistic'])
            return '/logistic/0';
        else if (permissions['ammo'])
            return '/ammo/0';
        else if (permissions['admin'])
            return '/armory/8';
        else
            return `/soldier/${permissions['id']}`
    };

    // Check for existing token on mount
    useEffect(() => {
        if (authChecked) return; // Prevent re-running

        // Absolute fallback - force show login after 3 seconds no matter what
        const absoluteTimeout = setTimeout(() => {
            setAuthChecked(true)
            setIsLoading(false)
        }, 3000)

        const checkSavedToken = async () => {
            try {
                const savedToken = localStorage.getItem('googleAuthToken')
                const savedEmail = localStorage.getItem('userEmail')
                const loginTime = localStorage.getItem('loginTime')

                if (!savedToken || !savedEmail) {
                    clearTimeout(absoluteTimeout)
                    setAuthChecked(true)
                    setIsLoading(false)
                    return
                }

                // Check if session has expired (1 minute)
                if (loginTime && Date.now() - parseInt(loginTime) > SESSION_TIMEOUT) {
                    localStorage.clear()
                    clearTimeout(absoluteTimeout)
                    setAuthChecked(true)
                    setIsLoading(false)
                    return
                }

                const parsedToken = JSON.parse(savedToken) as TokenResponse
                
                // revalidate email in supabase
                const {data, error} = await supabase
                    .from('users')
                    .select('*')
                    .eq('email', savedEmail)
                    .single();

                if (error || !data) {
                    console.error('Authentication failed:', error)
                    localStorage.clear()
                    clearTimeout(absoluteTimeout)
                    setAuthChecked(true)
                    setIsLoading(false)
                    return
                }

                clearTimeout(absoluteTimeout)
                setAuthChecked(true)
                setIsLoading(false)
                
                // Update login time to extend session
                localStorage.setItem('loginTime', Date.now().toString())
                
                onLoginSuccess(parsedToken)
                setPermissions(data as Record<string, boolean>);
                setIsPermissionsLoaded(true);
                setAuth(savedEmail, data as Record<string, boolean>);
                setIsAuthenticated(true)
            } catch (err) {
                console.error('Error during authentication check:', err)
                localStorage.clear()
                clearTimeout(absoluteTimeout)
                setAuthChecked(true)
                setIsLoading(false)
            }
        }
        
        checkSavedToken()

        // Cleanup
        return () => clearTimeout(absoluteTimeout)
    }, [authChecked])

    const login = useGoogleLogin({
        onSuccess: async (codeResponse: TokenResponse) => {
            try {
                // get email from Google userinfo
                const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: {
                        Authorization: `Bearer ${codeResponse.access_token}`,
                    },
                })
                const userInfo = await res.json()
                const email = userInfo.email;

                // check if email exists in Supabase users table
                const {data, error} = await supabase
                    .from('users')
                    .select('*')
                    .eq('email', email)
                    .maybeSingle()

                if (error || !data) {
                    alert('אין למייל זה הרשאות כניסה לאפליקציה')
                    localStorage.clear()
                    return
                }

                // Save to localStorage with login time
                localStorage.setItem('googleAuthToken', JSON.stringify(codeResponse))
                localStorage.setItem('userEmail', email)
                localStorage.setItem('loginTime', Date.now().toString())

                setPermissions(data as Record<string, boolean>);
                setIsPermissionsLoaded(true);
                setAuth(email, data as Record<string, boolean>);
                onLoginSuccess(codeResponse);
                setIsAuthenticated(true);

                // Update last_login in background
                const loginDate = new Date().toLocaleDateString('he-IL');
                const { data: updateData, error: updateError } = await supabase
                    .from('users')
                    .update({ "last_login": loginDate })
                    .eq('email', email);
                
                if (updateError) {
                    console.error('Failed to update last_login:', updateError);
                }

            } catch (err) {
                console.error('Login failed:', err)
                alert('An error occurred during login. Please try again.')
                localStorage.clear()
            }
        },
        onError: (error) => {
            console.error('Google Login Failed:', error)
            alert('Google login failed. Please try again.')
        },
        scope: 'openid email profile',
    })

    if (isLoading) {
        return (
            <div className="fixed inset-0 w-full h-full flex items-center justify-center bg-gradient-to-br from-green-200 via-yellow-100 to-yellow-200">
                <div className="flex flex-col items-center justify-center">
                    <div
                        className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                    <p className="text-gray-700">מאמת חיבור...</p>
                </div>
            </div>
        )
    }

    if (isAuthenticated) {
        return <Navigate to={getRedirectPath()} replace/>
    }

    return (
        <div className="fixed inset-0 w-full h-full flex items-center justify-center bg-gradient-to-br from-green-200 via-yellow-100 to-yellow-200 overflow-y-auto py-8">
            <div className="bg-white shadow-xl rounded-2xl p-8 w-full max-w-2xl mx-4">
                {!showRegistration ? (
                    <div className="flex flex-col items-center">
                        {/* Logo */}
                        <div className="mb-6">
                            <img src={logo} alt="Logo" className="h-24 w-auto"/>
                        </div>
                        
                        {/* Title */}
                        <h1 className="text-3xl font-bold text-gray-900 mb-3 text-center">
                            גדוד 8101
                        </h1>
                        
                        {/* Subtitle */}
                        <p className="text-gray-600 text-sm mb-6 text-center">
                            אנא התחבר עם חשבון Google כדי להיכנס
                        </p>
                        
                        {/* Google Sign-in Button */}
                        <button
                            onClick={() => login()}
                            className="flex items-center justify-center bg-white border border-gray-300 rounded-md shadow-sm px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                        >
                        <svg
                            className="h-5 w-5 ml-2"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 48 48"
                        >
                            <path
                                fill="#EA4335"
                                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.53 2.56 30.15 0 24 0 14.6 0 6.5 5.7 2.55 13.99l7.98 6.2C12.43 13.41 17.73 9.5 24 9.5z"
                            />
                            <path
                                fill="#4285F4"
                                d="M46.1 24.5c0-1.57-.14-3.09-.4-4.55H24v9.01h12.4c-.53 2.84-2.11 5.24-4.49 6.86l7.01 5.46C43.62 37.05 46.1 31.27 46.1 24.5z"
                            />
                            <path
                                fill="#FBBC05"
                                d="M10.53 28.2c-1.2-2.24-1.9-4.77-1.9-7.7s.7-5.46 1.9-7.7l-7.98-6.2C.93 11.11 0 17.35 0 24s.93 12.89 2.55 17.4l7.98-6.2z"
                            />
                            <path
                                fill="#34A853"
                                d="M24 48c6.15 0 11.31-2.03 15.08-5.52l-7.01-5.46C29.3 38.77 26.76 39.5 24 39.5c-6.27 0-11.57-3.91-13.47-9.7l-7.98 6.2C6.5 42.3 14.6 48 24 48z"
                            />
                        </svg>
                        לחץ להתחברות עם גוגל
                    </button>
                    
                    {/* Registration Link */}
                    <div className="mt-6 flex flex-col gap-2 items-center">
                        <button
                            onClick={() => setShowRegistration(true)}
                            className="text-blue-600 hover:text-blue-800 text-sm underline"
                        >
                            אין לך חשבון? הירשם כאן
                        </button>
                        <Link
                            to="/hr"
                            className="text-green-600 hover:text-green-800 text-sm underline"
                        >
                            הצהרת התנדבות (טופס 446)
                        </Link>
                    </div>
                </div>
                ) : (
                    <RegistrationForm onBackToLogin={() => setShowRegistration(false)} />
                )}
            </div>
        </div>
    )
}

export default LoginScreen
