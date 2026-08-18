import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Log browser console
        page.on("console", lambda msg: print(f"[Browser Console] {msg.type}: {msg.text}"))
        page.on("pageerror", lambda err: print(f"[Page Error]: {err}"))

        await page.goto("http://localhost:3000/admin")
        await page.wait_for_timeout(2000)

        script = "import('/pages/admin/components/AdminSetupWizards.js').then(m => m.AdminSetupWizards.launchFoundationWorksheetWizard());"
        await page.evaluate(script)
        await page.wait_for_timeout(1000)

        modal_open = await page.is_visible("foundation-worksheet-wizard")
        print("Modal visible:", modal_open)

        for i in range(4):
            next_btn = page.locator("foundation-worksheet-wizard button:has-text('Next Step')")
            print(f"Clicking step {i+1}, button visible:", await next_btn.is_visible())
            await next_btn.click()
            await page.wait_for_timeout(1000)

        await page.wait_for_timeout(2000)
        card_visible = await page.is_visible("text=Derived Palette Swatches")
        print("Derived Palette Swatches Card Visible:", card_visible)
        await page.screenshot(path="verification/screenshots/brand_worksheet_verified.png")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
