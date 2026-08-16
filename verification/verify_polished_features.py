# verification/verify_polished_features.py
from playwright.sync_api import sync_playwright
import os

def run_cuj(page):
    print("Loading home page...")
    page.goto("http://localhost:3000/")
    page.wait_for_timeout(1000)

    print("Scrolling to footer to inspect Powered-By and Newsletter...")
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page.wait_for_timeout(1500)

    # Take screenshot at the footer
    os.makedirs("verification/screenshots", exist_ok=True)
    screenshot_path = "verification/screenshots/verification.png"
    page.screenshot(path=screenshot_path)
    print(f"Screenshot taken at {screenshot_path}")
    page.wait_for_timeout(1000)  # Hold final state for the video

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        os.makedirs("verification/videos", exist_ok=True)
        context = browser.new_context(
            record_video_dir="verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()  # MUST close context to save the video
            browser.close()
            print("Browser closed.")
