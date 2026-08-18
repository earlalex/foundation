import asyncio
from playwright.async_api import async_playwright

async def run_cuj():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            record_video_dir=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'videos')
        )
        page = await context.new_page()

        try:
            # 1. Enable dev bypass mode first
            await page.goto("http://localhost:3000/", wait_until="domcontentloaded")
            await page.evaluate("localStorage.setItem('foundation_dev_mode', 'true'); window.__FOUNDATION_DEV_BYPASS__ = true;")
            await page.reload(wait_until="domcontentloaded")
            await page.wait_for_timeout(1000)

            # 2. Click Notification Bell
            bell = page.locator("#utility-notification-bell").first
            if await bell.is_visible():
                await bell.click()
                await page.wait_for_timeout(800)

            # 3. Navigate to /admin
            await page.goto("http://localhost:3000/admin", wait_until="domcontentloaded")
            await page.wait_for_timeout(1000)

            # 4. Click Notification Bell on /admin
            bell_admin = page.locator("#utility-notification-bell").first
            if await bell_admin.is_visible():
                await bell_admin.click()
                await page.wait_for_timeout(800)

            # Take screenshot
            await page.screenshot(path=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots', 'verification.png'))
            await page.wait_for_timeout(1000)
        finally:
            await context.close()
            await browser.close()

if __name__ == "__main__":
    asyncio.run(run_cuj())
