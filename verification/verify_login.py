import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    print("Navigating to index...")
    page.goto("http://localhost:3000")
    page.wait_for_timeout(1000)

    # Fill out setup wizard if visible
    if page.locator("#wizard-admin-email").is_visible():
        print("Filling out setup wizard...")
        page.locator("#wizard-admin-email").fill("admin@example.com")
        page.locator("#wizard-site-title").fill("Foundation Framework")
        page.locator("#wizard-site-domain").fill("http://localhost:3000")
        page.locator("#wizard-fb-key").fill("AIzaSyTestKey")
        page.locator("#wizard-fb-project").fill("test-project-id")
        page.locator("#btn-submit-wizard").click()
        page.wait_for_timeout(2000)

    # Now navigate to /login
    print("Navigating to login page...")
    page.goto("http://localhost:3000/login")
    page.wait_for_timeout(1000)

    # Take screenshot of the Login page
    print("Taking screenshot...")
    page.screenshot(path="/home/jules/verification/screenshots/verification.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
    print("Playwright CUJ complete!")
