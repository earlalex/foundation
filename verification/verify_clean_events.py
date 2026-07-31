# /home/jules/verification/verify_clean_events.py
from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
    page.on("pageerror", lambda err: print(f"PAGEERROR: {err.name}: {err.message}"))

    print("1. Loading root page and clearing storage...")
    page.goto("http://localhost:8788/")
    page.evaluate("localStorage.clear(); sessionStorage.clear();")
    page.wait_for_timeout(1000)

    print("2. Reloading clean page...")
    page.goto("http://localhost:8788/")
    page.wait_for_timeout(2000)

    # Let's bypass login to activate Admin and verify we are Admin
    print("3. Bypassing Login to become Admin...")
    page.evaluate("foundationDevBypass()")
    page.wait_for_timeout(2000)

    # Navigate to events page
    print("4. Navigating to events page...")
    page.click("a[href='/events']")
    page.wait_for_timeout(2000)

    # Open Booking Modal on the seeded event
    print("5. Opening Booking Modal on Event card...")
    page.click("button.btn-register-trigger")
    page.wait_for_timeout(1000)

    # Add VIP pass to cart
    print("6. Adding VIP pass to Cart...")
    page.click("button.btn-add-ticket-cart[data-id='t-vip']")
    page.wait_for_timeout(1000)

    # Take screenshot of the Event Page & Cart overlay
    print("7. Screenshotting Event Page & Cart Sidebar...")
    page.screenshot(path="/home/jules/verification/screenshots/verification_events.png")
    page.wait_for_timeout(1000)

    # Navigate back to Admin tab-events
    print("8. Returning to Admin dashboard...")
    page.click("a[href='/admin']")
    page.wait_for_timeout(2000)

    # Click Event Operations tab
    print("9. Navigating to Event Operations tab...")
    page.click("button.admin-tab[data-tab='events']")
    page.wait_for_timeout(2000)

    # Take screenshot of the Admin Event Operations Dashboard
    print("10. Screenshotting Admin Dashboard...")
    page.screenshot(path="/home/jules/verification/screenshots/verification_admin_events.png")
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
    print("Clean verification complete!")
