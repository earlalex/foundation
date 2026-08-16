import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Ensure screenshots and videos directories exist
    os.makedirs("verification/screenshots", exist_ok=True)
    os.makedirs("verification/videos", exist_ok=True)

    page.on("console", lambda msg: print(f"[BROWSER] {msg.text}"))
    page.on("pageerror", lambda err: print(f"[BROWSER ERROR] {err}"))

    # Navigate to the home page of the application via root index.html
    print("Navigating to root index...")
    page.goto("http://localhost:3000/")
    page.wait_for_timeout(3000)

    # Check if window.foundationDevBypass is a function
    bypass_exists = page.evaluate("typeof window.foundationDevBypass === 'function'")
    print(f"foundationDevBypass is a function: {bypass_exists}")

    if bypass_exists:
        print("Executing foundationDevBypass...")
        page.evaluate("window.foundationDevBypass()")
        page.wait_for_timeout(1000)

        # 1. Verify Guest (Prospect) role has NO Admin Dashboard link
        print("Checking Guest role nav visibility...")
        # Hide any bypass temporarily so state is clean
        page.evaluate("window.__FOUNDATION_DEV_BYPASS__ = false;")
        page.evaluate("window.store.dispatch('SET_DEV_MODE', false)")
        page.evaluate("window.store.dispatch('LOGOUT')")
        page.wait_for_timeout(1000)
        is_visible_guest = page.locator("#nav-admin-link").is_visible()
        print(f"Admin Link Visible for Guest: {is_visible_guest}")
        assert not is_visible_guest, "Admin Link should be hidden for Guests!"
        page.wait_for_timeout(1000)

        # 2. Simulate 'subscriber' role
        print("Simulating Subscriber role...")
        page.evaluate("window.store.dispatch('SET_SIMULATED_USER_TIER', 'subscriber')")
        page.wait_for_timeout(1000)
        is_visible_sub = page.locator("#nav-admin-link").is_visible()
        print(f"Admin Link Visible for Subscriber: {is_visible_sub}")
        assert not is_visible_sub, "Admin Link should be hidden for Subscribers!"
        page.wait_for_timeout(1000)

        # 3. Simulate 'admin' role
        print("Simulating Admin role...")
        page.evaluate("window.store.dispatch('SET_SIMULATED_USER_TIER', 'admin')")
        page.wait_for_timeout(1000)
        is_visible_admin = page.locator("#nav-admin-link").is_visible()
        print(f"Admin Link Visible for Admin: {is_visible_admin}")
        assert is_visible_admin, "Admin Link should be visible for Admins!"
        page.wait_for_timeout(1000)

        # Take screenshot of the navbar with Admin Dashboard visible
        screenshot_path = "verification/screenshots/verification.png"
        page.screenshot(path=screenshot_path)
        print(f"Screenshot taken at {screenshot_path}")
        page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="verification/videos"
        )
        context.add_init_script("window.__FOUNDATION_DEV_BYPASS__ = true;")
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
