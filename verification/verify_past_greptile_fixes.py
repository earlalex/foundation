import os
import glob
from playwright.sync_api import sync_playwright

script_dir = os.path.dirname(os.path.abspath(__file__))
screenshots_dir = os.path.join(script_dir, "screenshots")
videos_dir = os.path.join(script_dir, "videos")

os.makedirs(screenshots_dir, exist_ok=True)
os.makedirs(videos_dir, exist_ok=True)

screenshot_path = os.path.join(screenshots_dir, "past_greptile_fixes.png")

def run_cuj(page):
    # Set dev bypass
    page.add_init_script("window.__FOUNDATION_DEV_BYPASS__ = true;")

    print("Navigating to http://localhost:3000/...")
    page.goto("http://localhost:3000/", wait_until="domcontentloaded")
    page.wait_for_timeout(2000)

    page.evaluate("""
        () => {
            if (window.foundationDevBypass) {
                window.foundationDevBypass();
            } else if (window.store) {
                window.store.dispatch('SET_USER', {
                    uid: 'admin_bypass',
                    email: 'admin@earlalex.com',
                    displayName: 'Bypass Admin',
                    isAdmin: true,
                    role: 'admin'
                });
                window.store.dispatch('SET_DEV_MODE', true);
            }
        }
    """)
    page.wait_for_timeout(1000)

    # Dispatch router navigation
    page.evaluate("window.router && window.router.navigateTo('/admin')")
    page.wait_for_timeout(2000)

    # Click on Notification Bell to toggle notification center
    bell = page.locator("#btn-notif-bell")
    if bell.is_visible():
        bell.click()
        page.wait_for_timeout(500)

    # Take screenshot
    page.screenshot(path=screenshot_path)
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir=videos_dir
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()

    print(f"Screenshot saved to {screenshot_path}")
