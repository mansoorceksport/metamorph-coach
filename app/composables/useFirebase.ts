import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'

let firebaseApp: FirebaseApp | null = null
let auth: Auth | null = null

export const useFirebase = () => {
    if (!firebaseApp) {
        const config = useRuntimeConfig()

        const firebaseConfig = {
            apiKey: config.public.firebaseApiKey as string,
            authDomain: config.public.firebaseAuthDomain as string,
            projectId: config.public.firebaseProjectId as string,
            storageBucket: config.public.firebaseStorageBucket as string,
            messagingSenderId: config.public.firebaseMessagingSenderId as string,
            appId: config.public.firebaseAppId as string
        }

        firebaseApp = initializeApp(firebaseConfig)
        auth = getAuth(firebaseApp)
    }

    return {
        app: firebaseApp,
        auth: auth!
    }
}
