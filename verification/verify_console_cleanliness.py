import os
import sys
import asyncio
from playwright.async_api import async_playwright

async def verify_console_cleanliness():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        console_logs = []
        fatal_errors = []

        def handle_console(msg):
            text = msg.text
            console_logs.append(f"[{msg.type.upper()}] {text}")
            if msg.type == "error":
                # Filter out expected benign notices in test environment (offline Firestore connection notice and expected asset 404s)
                if "Could not reach Cloud Firestore backend" in text or "Failed to load resource: the server responded with a status of 404" in text:
                    return
                fatal_errors.append(text)

        page.on("console", handle_console)
        page.on("pageerror", lambda err: fatal_errors.append(f"PAGE_ERROR: {err}"))

        await page.add_init_script("""
            window.__FOUNDATION_DEV_BYPASS__ = true;
            localStorage.setItem('foundation_setup_completed', 'true');
            localStorage.setItem('foundation_wizard_dismissed', 'true');
        """)

        routes = [
            '/', '/home', '/docs', '/about', '/gallery', '/videos',
            '/events', '/contact', '/education', '/podcast', '/shop',
            '/cart', '/account', '/admin', '/login', '/privacy', '/terms', '/cookies'
        ]

        print("\n--- Navigating Across All Routes to Verify Console Cleanliness ---")
        await page.goto("http://localhost:3000/", wait_until="domcontentloaded")
        await page.wait_for_timeout(1000)

        for route in routes:
            print(f"Navigating to {route}...")
            await page.evaluate(f"window.router && window.router.navigateTo('{route}')")
            await page.wait_for_timeout(300)

        print(f"\nTotal Console Logs Captured: {len(console_logs)}")
        print(f"Fatal Console/Page Errors Count: {len(fatal_errors)}")

        screenshot_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots', 'console_cleanliness.png')
        await page.screenshot(path=screenshot_path)
        print(f"Captured screenshot: {screenshot_path}")

        await context.close()
        await browser.close()

        if len(fatal_errors) > 0:
            print("\n❌ Console Cleanliness Audit Failed due to fatal errors:")
            for err in fatal_errors:
                print(f"  - {err}")
            sys.exit(1)

        print("\n✅ Console Cleanliness Audit Passed Cleanly with 0 Fatal Errors.")

if __name__ == "__main__":
    asyncio.run(verify_console_cleanliness())
