import os
import asyncio
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Set the bypass flag before any navigation happens
    page.add_init_script("window.__FOUNDATION_DEV_BYPASS__ = true;")

    # Navigate to the home page (SPA entry point)
    page.goto("http://localhost:3000/")
    page.wait_for_timeout(1000)

    # Use router to navigate to /contact
    page.evaluate("window.router.navigateTo('/contact')")
    page.wait_for_timeout(1500)

    # Scroll down to show corporate sidebar and scheduling calendar
    page.evaluate("window.scrollTo(0, 300)")
    page.wait_for_timeout(1000)

    # Take screenshot at the key moment
    page.screenshot(path="/home/jules/verification/screenshots/polished_contact.png")
    page.wait_for_timeout(1000)  # Hold final state for the video

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()  # MUST close context to save the video
            browser.close()
