/**
 * useSocialShare Composable
 * Handles generating Instagram Story-ready images from DOM elements
 * and sharing them via Web Share API with download fallback.
 */
import { toPng } from 'html-to-image'

export interface SocialShareOptions {
    filename?: string
    quality?: number
}

export function useSocialShare() {
    const isGenerating = ref(false)
    const error = ref<string | null>(null)

    /**
     * Generate a PNG image from a DOM element
     */
    async function generateImage(element: HTMLElement): Promise<Blob> {
        isGenerating.value = true
        error.value = null

        try {
            // Generate PNG with high quality for Instagram
            const dataUrl = await toPng(element, {
                quality: 1,
                pixelRatio: 2, // 2x for retina displays
                cacheBust: true,
                // Ensure fonts are embedded
                fontEmbedCSS: '',
                skipFonts: false,
            })

            // Convert data URL to Blob
            const response = await fetch(dataUrl)
            const blob = await response.blob()
            return blob
        } catch (err: any) {
            error.value = err.message || 'Failed to generate image'
            throw err
        } finally {
            isGenerating.value = false
        }
    }

    /**
     * Share an image using Web Share API with download fallback
     */
    async function shareImage(blob: Blob, filename: string = 'metamorph-share.png'): Promise<void> {
        const file = new File([blob], filename, { type: 'image/png' })

        // Check if Web Share API is supported and can share files
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: 'Metamorph',
                    text: 'Check out my progress! 💪',
                })
                return
            } catch (err: any) {
                // User cancelled or share failed - fall through to download
                if (err.name === 'AbortError') {
                    return // User cancelled, don't download
                }
                console.warn('Share failed, falling back to download:', err)
            }
        }

        // Fallback: Download the image
        downloadImage(blob, filename)
    }

    /**
     * Download an image directly
     */
    function downloadImage(blob: Blob, filename: string = 'metamorph-share.png') {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
    }

    /**
     * Generate and share in one step
     */
    async function generateAndShare(
        element: HTMLElement,
        options: SocialShareOptions = {}
    ): Promise<void> {
        const blob = await generateImage(element)
        await shareImage(blob, options.filename)
    }

    return {
        isGenerating: readonly(isGenerating),
        error: readonly(error),
        generateImage,
        shareImage,
        downloadImage,
        generateAndShare,
    }
}
