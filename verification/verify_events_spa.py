import os
# /home/jules/verification/verify_events_spa.py
from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
    page.on("pageerror", lambda err: print(f"PAGEERROR: {err}"))
    page.on("requestfailed", lambda req: print(f"REQ-FAILED: {req.url} - {req.failure.error_text}"))

    print("1. Loading root page...")
    page.goto("http://localhost:8788/")
    page.wait_for_timeout(2000)

    print("2. Navigating to /events...")
    page.evaluate("window.router.navigateTo('/events')")
    page.wait_for_timeout(2000)

    # Take screenshot of events page
    page.screenshot(path=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots', 'verification_events.png'))
    print("Screenshot saved to /home/jules/verification/screenshots/verification_events.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
