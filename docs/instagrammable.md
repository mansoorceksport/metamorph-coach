Act as a Senior Frontend Developer / UX Designer for the "Metamorph" project.

I need to implement a **"Social Share" feature** that allows coaches to generate Instagram Story-ready images (9:16 aspect ratio) directly from the dashboard.

**Context:**
* **Stack:** Nuxt 3, Tailwind CSS, Nuxt UI.
* **Constraint:** The app is **Offline-First**. You cannot use server-side generation. You must use `html-to-image` to render DOM elements to PNG on the client side.
* **Design System:** Deep Dark Mode. Backgrounds are very dark slate/black. Text is white.

**Task:**
Create a reusable component called `SocialShareModal.vue` and a composable `useSocialShare`.

**1. The visual Templates (Hidden DOM Elements)**
I need you to create a hidden container (positioned off-screen) that renders the following two templates in strict 1080x1920px (9:16) dimensions.

* **Template A: "The Session Smash" (Based on my Session Complete modal)**
    * **Background:** Deep Navy/Black gradient.
    * **Header:** A large Trophy Icon (Heroicon) in Green, centered.
    * **Title:** "Session Crushed!"
    * **Subtext:** Member Name • [Focus Area]
    * **The Grid:** A 3-column row displaying big numbers: "Sets Done", "Exercises", "New PRs".
    * **Footer:** A motivational quote card (e.g., "Solid consistency today!") and the "Metamorph Coach" logo at the bottom.

* **Template B: "The Scan Update" (Based on my Scan Details page)**
    * **Background:** Deep Navy/Black.
    * **Layout:** A 2x2 Grid of bold, colored cards floating in the center:
        * **Card 1 (Weight):** Blue background (`bg-blue-600`), Label "Weight", Value "74.5kg".
        * **Card 2 (SMM):** Emerald/Green background (`bg-emerald-500`), Label "Muscle Mass", Value "30.8kg".
        * **Card 3 (Body Fat):** Orange background (`bg-orange-500`), Label "Body Fat", Value "26.7%".
        * **Card 4 (BMI):** Purple background (`bg-purple-600`), Label "BMI", Value "24.3".
    * **Footer:** "Progress Check" label and the "Metamorph Coach" logo.

**2. The Logic (Composable)**
Implement a `generateImage(templateId)` function that:
1.  Targets the specific hidden DOM element.
2.  Uses `html-to-image` (toPng) to convert it to a Blob.
3.  Uses `navigator.share()` (Web Share API) to pass the file to the native OS share sheet (allowing direct sharing to Instagram/WhatsApp).
4.  **Fallback:** If `navigator.share` is not supported (desktop), download the image instead.

**3. The UI (The Modal)**
The modal itself should show a **Preview Carousel**.
* User opens modal -> sees a swipeable preview of the 9:16 images.
* Button: "Share to Instagram".

**Technical Requirements:**
* Use `html-to-image` package.
* Ensure fonts and styles load correctly in the generated image (you may need to embed font styles in the hidden div).
* Provide the full code for `components/SocialShareModal.vue` and the logic for the templates.