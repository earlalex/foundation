from playwright.sync_api import sync_playwright
import os

def run_cuj(page):
    # 1. Navigate to the application
    page.goto("http://localhost:3000")
    page.wait_for_timeout(1000)

    # 2. Trigger Admin Dev Bypass
    page.evaluate("window.foundationDevBypass()")
    page.wait_for_timeout(1000)

    # 3. Navigate to /admin using SPA Router (Preserves Bypass State!)
    page.evaluate("window.router.navigateTo('/admin')")
    page.wait_for_timeout(2000)

    # 4. Scroll down to show Feature Toggles
    page.evaluate("document.getElementById('feature-toggles-card').scrollIntoView()")
    page.wait_for_timeout(1000)

    # Take screenshot of the Admin settings toggles card
    page.screenshot(path="/home/jules/verification/screenshots/feature_toggles.png")
    page.wait_for_timeout(1000)

    # 5. Click on CMS tab
    page.click('button[data-tab="cms"]')
    page.wait_for_timeout(1500)

    # Scroll to AI Generator card
    page.evaluate("document.getElementById('cms-ai-generator-card').scrollIntoView()")
    page.wait_for_timeout(1000)

    # Take screenshot of the CMS AI Generator card
    page.screenshot(path="/home/jules/verification/screenshots/cms_ai_generator.png")
    page.wait_for_timeout(1000)

    # 6. Click "Generate AI Test Reviews"
    page.click('#btn-gen-ai-reviews')
    # Wait for the AI generation to complete (usually 1-3 seconds)
    page.wait_for_timeout(3500)

    # Take screenshot after generating reviews
    page.screenshot(path="/home/jules/verification/screenshots/verification.png")
    page.wait_for_timeout(1000)

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
            context.close()
            browser.close()
