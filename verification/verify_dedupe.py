import asyncio
import os
from playwright.async_api import async_playwright

async def run_cuj():
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = await context.new_page()

        try:
            # Navigate to site
            await page.goto("http://localhost:3000/#/admin", wait_until="domcontentloaded")
            await page.wait_for_timeout(1000)

            # Trigger dev bypass if needed or navigate directly
            await page.evaluate("window.foundationDevBypass && window.foundationDevBypass()")
            await page.wait_for_timeout(1000)

            # Click Users & Affiliates tab
            users_tab = page.locator('button[data-tab="users"]')
            if await users_tab.is_visible():
                await users_tab.click()
                await page.wait_for_timeout(1000)

            # Locate the Deduplicate Accounts button
            dedupe_btn = page.locator('#btn-dedupe-users')
            if await dedupe_btn.is_visible():
                await dedupe_btn.click()
                await page.wait_for_timeout(1000)

            # Take screenshot
            screenshot_path = "/home/jules/verification/screenshots/dedupe_verification.png"
            await page.screenshot(path=screenshot_path)
            await page.wait_for_timeout(1000)

        finally:
            await context.close()
            await browser.close()

if __name__ == "__main__":
    asyncio.run(run_cuj())
