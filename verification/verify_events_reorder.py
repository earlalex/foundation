import os
from playwright.sync_api import sync_playwright

# Ensure portable output directories exist
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SCREENSHOTS_DIR = os.path.join(SCRIPT_DIR, "screenshots")
VIDEOS_DIR = os.path.join(SCRIPT_DIR, "videos")

os.makedirs(SCREENSHOTS_DIR, exist_ok=True)
os.makedirs(VIDEOS_DIR, exist_ok=True)

def run_cuj(page):
    page.goto("http://localhost:3000/")
    page.wait_for_timeout(1000)

    # Bypass wizard / complete wizard
    page.evaluate("if (window.foundationDevBypass) window.foundationDevBypass();")
    page.wait_for_timeout(1000)

    # Click on Events link in navbar
    page.click("a[href='/events']")
    page.wait_for_timeout(1500)

    # Take screenshot at top (Hero)
    page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "events_hero.png"))

    # Scroll down to featured spotlight & grid
    page.evaluate("window.scrollTo(0, 600)")
    page.wait_for_timeout(500)
    page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "events_grid.png"))

    # Scroll down to reviews section
    page.evaluate("window.scrollTo(0, 1600)")
    page.wait_for_timeout(500)
    page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "events_reviews_bottom.png"))

    # Full page screenshot
    page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "events_reordered_layout.png"), full_page=True)
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir=VIDEOS_DIR
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
