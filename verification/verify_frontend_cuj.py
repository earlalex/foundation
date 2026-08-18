import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Click the High Contrast Button
    page.click("#nav-high-contrast-toggle")
    page.wait_for_timeout(1000)

    # Click the Language Selector Dropdown
    page.select_option("#nav-lang-selector", "es")
    page.wait_for_timeout(1000)

    # Take screenshot at the key moment
    page.screenshot(path=os.path.join(os.path.dirname(__file__), 'screenshots', 'verification.png'))
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Force a large desktop viewport to prevent any hamburger responsive overlaps
        context = browser.new_context(
            record_video_dir=os.path.join(os.path.dirname(__file__), 'videos'),
            viewport={"width": 1280, "height": 800}
        )
        page = context.new_page()
        page.goto("http://localhost:3000/?runTests=true")
        page.wait_for_timeout(1000)
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
