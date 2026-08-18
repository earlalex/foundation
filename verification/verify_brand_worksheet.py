import asyncio
import os
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        page.on("console", lambda msg: print(f"[Browser Console] {msg.type}: {msg.text}"))
        page.on("pageerror", lambda err: print(f"[Page Error]: {err}"))

        print("Navigating to local server...")
        await page.goto("http://localhost:3000/admin", wait_until="networkidle")

        result = await page.evaluate("""async () => {
            const { synthesizeBrandFromWorksheet, FoundationWorksheetWizard } = await import('./pages/admin/components/AdminSetupWizards.js');
            const { themeEngine, ensureContrastCompliance, calculateContrastRatio } = await import('./core/theme.js');

            const brand = await synthesizeBrandFromWorksheet({
                purpose: "Elevate men and women into full alignment",
                mission: "Build transformational frameworks",
                values: ["Discipline", "Sovereignty"],
                kpis: ["Quarterly targets"]
            });

            const lowContrast = "#808080";
            const bg = "#FFFFFF";
            const adjusted = ensureContrastCompliance(lowContrast, bg, 4.5);
            const ratio = calculateContrastRatio(adjusted, bg);

            themeEngine.applyCustomDesignSystem(brand);
            const primaryVar = document.documentElement.style.getPropertyValue('--theme-color-primary');

            const wizard = new FoundationWorksheetWizard();
            const mdContent = wizard.generateMarkdownBinderContent();

            return {
                brandColors: brand.colors,
                adjustedColor: adjusted,
                contrastRatio: ratio,
                primaryVar: primaryVar,
                mdHasPurpose: mdContent.includes("Purpose")
            };
        }""")

        print("Evaluation Result:", result)
        assert result["brandColors"]["primary"], "Missing primary color in brand synthesis"
        assert result["contrastRatio"] >= 4.5, "Contrast ratio below 4.5:1 WCAG threshold"
        assert result["primaryVar"], "Missing --theme-color-primary CSS variable"
        assert result["mdHasPurpose"], "Markdown binder content missing Purpose section"

        os.makedirs("verification/screenshots", exist_ok=True)
        await page.screenshot(path="verification/screenshots/brand_worksheet_verified.png")
        print("Screenshot saved to verification/screenshots/brand_worksheet_verified.png")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
