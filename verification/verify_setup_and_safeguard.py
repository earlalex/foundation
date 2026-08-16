import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:3000/")
    page.wait_for_timeout(1000)

    # Let's check if we see "🚀 Foundation Setup Wizard" or the home page
    if page.locator("text=Foundation Setup Wizard").is_visible():
        print("Setup wizard visible. Proceeding to fill setup wizard form...")
        page.fill("#wizard-admin-email", "admin@earlalex.com")
        page.fill("#wizard-site-title", "Ascension Academy")
        page.fill("#wizard-fb-key", "AIzaSyFakeKey123")
        page.fill("#wizard-fb-project", "demo-project-id")
        page.wait_for_timeout(500)
        page.click("#btn-submit-wizard")
        print("Waiting for page boot...")
        page.wait_for_timeout(15000)

    # Check if the home page or components loaded
    page.goto("http://localhost:3000/home")
    page.wait_for_timeout(2000)

    # Take screenshot of the home page
    page.screenshot(path="verification/screenshots/verification.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
