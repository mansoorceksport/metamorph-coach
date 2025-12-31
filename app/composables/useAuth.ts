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
    const loading = useState<boolean>('firebase-loading', () => true)
    const error = useState<string | null>('firebase-error', () => null)

    // Initialize auth state listener
    if (process.client) {
        onAuthStateChanged(auth, (currentUser) => {
            user.value = currentUser
            loading.value = false
        })
    }

    const signInWithGoogle = async () => {
        loading.value = true
        error.value = null

        try {
            const provider = new GoogleAuthProvider()
            const result = await signInWithPopup(auth, provider)
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
        } catch (err: any) {
            error.value = err.message || 'Failed to sign out'
            throw err
        } finally {
            loading.value = false
        }
    }

    const isAuthenticated = computed(() => !!user.value)

    return {
        user: readonly(user),
        loading: readonly(loading),
        error: readonly(error),
        isAuthenticated,
        signInWithGoogle,
        signOut
    }
}
