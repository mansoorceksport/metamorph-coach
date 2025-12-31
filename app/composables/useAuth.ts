import {
    signInWithPopup,
    GoogleAuthProvider,
    signOut as firebaseSignOut,
    onAuthStateChanged,
    type User
} from 'firebase/auth'

export const useAuth = () => {
    const { auth } = useFirebase()
    const user = useState<User | null>('firebase-user', () => null)
    const metamorphToken = useCookie<string | null>('metamorph-token')
    const loading = useState<boolean>('firebase-loading', () => true)
    const error = useState<string | null>('firebase-error', () => null)
    const config = useRuntimeConfig()

    // Initialize auth state listener
    if (process.client) {
        onAuthStateChanged(auth, async (currentUser) => {
            user.value = currentUser
            if (currentUser) {
                // Silently refresh token if needed on load
                try {
                    const token = await currentUser.getIdToken()
                    await exchangeToken(token)
                } catch (e) {
                    console.error('Token exchange failed on init', e)
                }
            }
            loading.value = false
        })
    }

    const exchangeToken = async (firebaseIdToken: string) => {
        try {
            const response = await $fetch<{ token: string }>(`${config.public.apiBase}/v1/auth/login`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${firebaseIdToken}`,
                    'Accept': 'application/json'
                }
            })

            // Assuming response contains the token directly or in a field. 
            // Based on OpenAPI it just says "OK" but usually returns a token.
            // If the backend sets a cookie, we might not need to do anything manually.
            // But if it returns JSON:
            if (response?.token) {
                metamorphToken.value = response.token
            }
        } catch (err: any) {
            console.error('Backend token exchange failed:', err)
            // Don't block login strictly if verified by firebase, but functionality might be limited
            throw new Error('Failed to authenticate with backend')
        }
    }

    const signInWithGoogle = async () => {
        loading.value = true
        error.value = null

        try {
            const provider = new GoogleAuthProvider()
            const result = await signInWithPopup(auth, provider)

            // Explicitly exchange token to ensure backend session is created immediately
            const token = await result.user.getIdToken()
            await exchangeToken(token)

            user.value = result.user
            return result.user
        } catch (err: any) {
            error.value = err.message || 'Failed to sign in with Google'
            throw err
        } finally {
            loading.value = false
        }
    }

    const signOut = async () => {
        loading.value = true
        error.value = null

        try {
            await firebaseSignOut(auth)
            user.value = null
            metamorphToken.value = null
        } catch (err: any) {
            error.value = err.message || 'Failed to sign out'
            throw err
        } finally {
            loading.value = false
        }
    }

    const isAuthenticated = computed(() => !!user.value && !!metamorphToken.value)

    return {
        user: readonly(user),
        metamorphToken: readonly(metamorphToken),
        loading: readonly(loading),
        error: readonly(error),
        isAuthenticated,
        signInWithGoogle,
        signOut
    }
}
