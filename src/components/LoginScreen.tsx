import React, {useEffect, useState} from 'react'
import {TokenResponse, useGoogleLogin} from '@react-oauth/google'
import {Label} from '@/components/ui/label'
import {Button} from '@/components/ui/button'
import {useAuthStore} from '@/stores/useAuthStore'
import {usePermissions} from '@/contexts/PermissionsContext'
import {supabase} from '@/lib/supabaseClient' // <-- your supabase client
import logo from '@/assets/logo.jpeg' // Import the logo
import '../css/LoginScreen.css'
import {Navigate} from "react-router-dom"; // Import the login screen styles

interface LoginScreenProps {
    onLoginSuccess: (response: TokenResponse) => void
}

const LoginScreen: React.FC<LoginScreenProps> = ({onLoginSuccess}) => {
    const [isLoading, setIsLoading] = useState(true)
    const [isAuthenticated, setIsAuthenticated] = useState(false)

    const setAuth = useAuthStore((state) => state.setAuth)
    const {setPermissions} = usePermissions()

    // Check for existing token on mount
    useEffect(() => {
        const checkSavedToken = async () => {
            const savedToken = localStorage.getItem('googleAuthToken')
            const savedEmail = localStorage.getItem('userEmail')

            if (savedToken && savedEmail) {
                try {
                    const parsedToken = JSON.parse(savedToken) as TokenResponse
                    // revalidate email in supabase
                    const {data, error} = await supabase
                        .from('users')
                        .select('*')
                        .eq('email', savedEmail)
                        .single()

                    if (error || !data) {
                        console.error('Email not found in Supabase:', error)
                        localStorage.clear()
                    } else {
                        onLoginSuccess(parsedToken)
                        data['Plugot'] = data['א'] || data['ב'] || data['ג'] || data['מסייעת'] || data['אלון'] || data['מכלול'] || data['פלסם']
                        // @ts-ignore
                        setPermissions(data);
                        // @ts-ignore
                        setAuth(savedEmail, data);
                        setIsAuthenticated(true);
                        return
                    }
                } catch (err) {
                    console.error('Error restoring auth:', err)
                    localStorage.clear()
                }
            }
            setIsLoading(false)
        }
        checkSavedToken()
    }, [onLoginSuccess, setAuth, setPermissions])

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

                // Save to localStorage
                localStorage.setItem('googleAuthToken', JSON.stringify(codeResponse))
                localStorage.setItem('userEmail', email)

                onLoginSuccess(codeResponse);
                setIsAuthenticated(true);

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
            <div className="login-screen-container">
                <div className="flex flex-col items-center justify-center">
                    <div
                        className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                    <p className="text-gray-700">מאמת חיבור...</p>
                </div>
            </div>
        )
    }

    if (isAuthenticated) {
        return <Navigate to="/group/0/sheet/0/row/0" replace/>
    }

    return (
        <div className="login-screen-container">
            <div className="login-content">
                <div className="bg-white shadow-lg rounded-lg p-6 w-full">
                    <div className="flex justify-center mb-4">
                        <img src={logo} alt="Logo" className="h-32 w-auto"/>
                    </div>
                    <h1 className="text-4xl font-bold text-gray-800 mb-6 text-center">
                        גדוד 8101
                    </h1>
                    <div className="flex flex-col items-center">
                        <p className="text-gray-700 mb-4">
                            אנא התחבר עם חשבון Google כדי להיכנס
                        </p>
                        <button
                            onClick={() => login()}
                            className="flex items-center bg-white border border-gray-300 rounded-lg shadow-md px-6 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                        >
                            <svg
                                className="h-6 w-6 ml-2"
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
                            Google התחבר עם
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default LoginScreen
