import os
# /home/jules/verification/debug_events.py
from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
    page.on("pageerror", lambda err: print(f"PAGEERROR: {err}"))

    print("1. Loading events page...")
    page.goto("http://localhost:8788/events")
    page.wait_for_timeout(4000)

    # Take screenshot of page
    page.screenshot(path=os.path.join(os.path.dirname(__file__), 'screenshots', 'debug_events.png'))
    print("Screenshot saved!")

    # Print content of #events-grid
    grid_content = page.locator("#events-grid").inner_html()
    print("Events grid content:", grid_content)

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
