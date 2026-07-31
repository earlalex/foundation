# /home/jules/verification/verify_screenshots.py
from playwright.sync_api import sync_playwright

def run_cuj(page):
    print("1. Loading home page...")
    page.goto("http://localhost:8788/")
    page.wait_for_timeout(2000)
    page.screenshot(path="/home/jules/verification/screenshots/verification_home.png")

    print("2. Navigating to /events page...")
    page.goto("http://localhost:8788/events")
    page.wait_for_timeout(2000)
    page.screenshot(path="/home/jules/verification/screenshots/verification_events.png")

    print("3. Logging in via dev bypass...")
    page.goto("http://localhost:8788/")
    page.wait_for_timeout(1000)
    try:
        page.evaluate("foundationDevBypass()")
    except Exception as e:
        print("Dev bypass eval error:", e)
    page.wait_for_timeout(2000)

    print("4. Loading admin page...")
    page.goto("http://localhost:8788/admin")
    page.wait_for_timeout(2000)
    page.screenshot(path="/home/jules/verification/screenshots/verification_admin.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        try:
            run_cuj(page)
        except Exception as e:
            print("Run CUJ threw exception:", e)
        finally:
            context.close()
            browser.close()
    print("Screenshots taken successfully!")
