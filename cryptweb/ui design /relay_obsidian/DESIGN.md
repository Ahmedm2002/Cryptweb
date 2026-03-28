# Design System Specification: High-End Peer-to-Peer Interface

## 1. Overview & Creative North Star: "The Digital Curator"
This design system is built to transform a functional utility into a premium editorial experience. Our Creative North Star is **"The Digital Curator"**—a philosophy that treats every shared file not as data, but as an artifact of value. 

To achieve this, we move beyond the "SaaS template" look. We favor **intentional asymmetry**, where heavy information is balanced by expansive, breathing whitespace. We replace rigid, 1px structural lines with **Tonal Layering**, creating a UI that feels carved from a single block of dark obsidian rather than assembled from boxes. The goal is a production-ready system that feels atmospheric, secure, and effortlessly sophisticated.

---

## 2. Colors & Surface Philosophy
The palette is rooted in deep charcoal and slate, punctuated by a high-energy violet. However, the secret to this system is not the hue, but the **luminance hierarchy**.

### The "No-Line" Rule
Traditional 1px solid borders are strictly prohibited for sectioning. Structural boundaries must be defined solely through background color shifts or subtle tonal transitions. For example:
- A file list (using `surface-container-low`) should sit directly on the main `background` without a border.
- Separation is achieved through the Spacing Scale (Token 8 or 10) to let the eye perceive the break naturally.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the surface tiers to create "nested" depth:
- **Base Layer:** `surface` (#131313) or `surface-container-lowest` (#0E0E0E) for the deep background.
- **Mid-Ground Layer:** `surface-container` (#201F1F) for sidebar or navigation regions.
- **Focus Layer:** `surface-container-high` (#2A2A2A) or `highest` (#353534) for active cards or interactive modules.

### The "Glass & Gradient" Rule
To add "soul" to the dark mode interface:
- **Glassmorphism:** Use `surface-variant` with a `backdrop-filter: blur(20px)` and an opacity of 40-60% for floating modals or navigation bars.
- **Signature Gradients:** Main CTAs should utilize a linear gradient from `primary` (#D0BCFF) to `primary-container` (#A078FF) at a 135-degree angle. This prevents the "flat-button" look and provides a tactile, premium glow.

---

## 3. Typography: Editorial Authority
We utilize **Inter** as our typographic workhorse, focusing on tracking and line-height to convey brand identity.

*   **Display & Headlines:** Use `display-lg` to `headline-sm`. These should be set with tight tracking (-0.02em) to feel authoritative and dense. Use these for empty states or hero statistics to create a "poster" feel.
*   **Body & Labels:** Use `body-md` for primary information. For secondary metadata (file sizes, timestamps), use `label-md` with `on-surface-variant` color.
*   **Technical Monospace:** For hash keys or peer IDs, utilize **JetBrains Mono** at `body-sm` scale. This injects a subtle "developer-centric" precision into the otherwise organic layout.

---

## 4. Elevation & Depth
Hierarchy is achieved through **Tonal Layering** rather than traditional drop shadows.

*   **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` section. The slight decrease in brightness creates a "sunken" or "lifted" effect that is more sophisticated than a shadow.
*   **Ambient Shadows:** For high-priority floating elements (e.g., a file transfer popover), use a shadow with a blur of `40px` and an opacity of `8%`. The shadow color must be a tinted version of `primary` (#D0BCFF) to simulate light reflecting off the violet accent color.
*   **The "Ghost Border" Fallback:** If a border is required for accessibility, use the `outline-variant` token at **15% opacity**. Never use 100% opaque borders.

---

## 5. Components

### Buttons
*   **Primary:** Gradient fill (`primary` to `primary-container`), white text (`on-primary`), `sm` (0.25rem) or `md` (0.75rem) corner radius. No border.
*   **Secondary:** Ghost style. Transparent background with a `Ghost Border` (15% opacity `outline-variant`).
*   **Tertiary:** Text only in `primary` color. Use for low-emphasis actions like "Cancel."

### Input Fields
*   **Default:** `surface-container-highest` background. No border.
*   **Focus State:** A 1px border using `primary` (#D0BCFF) and a subtle outer glow (4px blur) using the same color at 20% opacity.
*   **Layout:** Labels should be `label-md` and placed 0.5rem above the input field.

### Progress Bars (Critical for P2P)
*   **Track:** `surface-container-highest`. 
*   **Indicator:** A thin (2px or 4px) line using the `secondary` (#60D4FF) token.
*   **Animation:** Use a subtle pulse effect on the active indicator to signal life.

### Cards & Lists
*   **Strict Rule:** Forbid the use of divider lines. Separate list items using the spacing scale (Token 2 or 3). 
*   **Hover State:** Change background to `surface-bright` (#3A3939) with a smooth 200ms transition.

### P2P Status Indicators
*   **Online:** A simple 6px circle using `secondary` (#60D4FF) with a 4px soft outer glow.
*   **Offline:** A 6px circle using `outline` (#958EA0) with no glow.

---

## 6. Do’s and Don’ts

### Do
*   **Do** use asymmetrical margins (e.g., 10% left, 20% right) in hero sections to create visual interest.
*   **Do** use `surface-container-lowest` for the main content area and `surface` for the background to create a "trough" effect.
*   **Do** ensure all interactive states (hover, active) have a minimum transition time of 150ms for a "liquid" feel.

### Don't
*   **Don't** use pure black (#000000). Always use the `surface` tokens to maintain the ability to layer depth.
*   **Don't** use heavy "card" shadows. If the background shift isn't enough, your spacing is likely too tight.
*   **Don't** use icons without accompanying labels unless the icon is universally understood (e.g., a "Close" X). 

---

## 7. Token Reference Summary

| Token | Value | Usage |
| :--- | :--- | :--- |
| **Surface** | #131313 | Main application background. |
| **Surface Container** | #201F1F | Secondary regions (Sidebars). |
| **Primary** | #D0BCFF | Accent violet for CTAs and focus. |
| **Secondary** | #60D4FF | "Live" indicators and progress bars. |
| **Outline Variant** | #494454 | Ghost borders (at 15% opacity). |
| **Corner Radius MD** | 0.75rem | Standard for cards and inputs. |
| **Spacing 4** | 1.4rem | Standard padding for containers. |