import asyncio
from playwright.async_api import async_playwright

async def run_tests():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        console_logs = []
        done_event = asyncio.Event()

        def handle_console(msg):
            text = msg.text
            console_logs.append(text)
            print(f"[BROWSER] {text}")
            if "Test execution complete." in text or "Suites Passed:" in text:
                done_event.set()

        page.on("console", handle_console)

        # Set up a script to run on document start
        await page.add_init_script("""
            window.__FOUNDATION_DEV_BYPASS__ = true;
        """)

        print("Navigating to http://localhost:3000/...")
        await page.goto("http://localhost:3000/", wait_until="domcontentloaded")

        # Wait a moment for page initialization
        await page.wait_for_timeout(2000)

        print("Triggering runAllTests() programmatically...")
        await page.evaluate("""
            async () => {
                const mod = await import('/tests/index.js');
                const results = await mod.runAllTests();
                console.log('Test execution complete. Success: ' + results.success);
            }
        """)

        try:
            await asyncio.wait_for(done_event.wait(), timeout=15)
            print("Tests finished successfully!")
        except asyncio.TimeoutError:
            print("Timed out waiting for test suite to finish.")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_tests())
