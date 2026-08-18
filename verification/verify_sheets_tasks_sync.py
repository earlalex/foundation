import os
import asyncio
from playwright.async_api import async_playwright

async def run_verification():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            record_video_dir="/app/verification/videos"
        )
        page = await context.new_page()

        # Go to app
        await page.goto("http://localhost:3000/#/admin", wait_until="networkidle")
        await page.wait_for_timeout(1000)

        # Trigger Dev Bypass if needed
        await page.evaluate("window.foundationDevBypass && window.foundationDevBypass()")
        await page.wait_for_timeout(1000)

        # Navigate to API Keys & Cloud tab
        config_tab = page.locator('.admin-tab[data-tab="config"]')
        if await config_tab.is_visible():
            await config_tab.click()
            await page.wait_for_timeout(1000)

        # Check for Google Sheets CMS & Tasks fields
        sheets_input = page.locator('#cfg-sheets-cms-id')
        tasks_input = page.locator('#cfg-tasks-list-id')
        test_btn = page.locator('#btn-test-sheets-tasks')

        if await sheets_input.is_visible():
            await sheets_input.fill("test-sheets-id-12345")
            await page.wait_for_timeout(500)

        if await tasks_input.is_visible():
            await tasks_input.fill("test-tasks-id-67890")
            await page.wait_for_timeout(500)

        if await test_btn.is_visible():
            await test_btn.click()
            await page.wait_for_timeout(1000)

        # Navigate to Kanban Task Board tab
        kanban_tab = page.locator('.admin-tab[data-tab="kanban"]')
        if await kanban_tab.is_visible():
            await kanban_tab.click()
            await page.wait_for_timeout(1000)

        # Take screenshot
        os.makedirs("/app/verification/screenshots", exist_ok=True)
        os.makedirs("/app/verification/videos", exist_ok=True)
        screenshot_path = "/app/verification/screenshots/sheets_tasks_kanban.png"
        await page.screenshot(path=screenshot_path)
        await page.wait_for_timeout(1000)

        await context.close()
        await browser.close()
        print("Verification script completed successfully.")

if __name__ == '__main__':
    asyncio.run(run_verification())
