# /home/jules/verification/verify_events.py
from playwright.sync_api import sync_playwright
import os

def run_cuj(page):
    print("1. Loading events page...")
    page.goto("http://localhost:8788/events")
    page.wait_for_timeout(2000)

    # Click Register & Select Tickets on the seeded event card
    print("2. Opening Booking Modal...")
    page.click("button.btn-register-trigger")
    page.wait_for_timeout(1000)

    # Select VIP tickets and click Add to Cart
    print("3. Adding VIP pass to cart...")
    page.click("button.btn-add-ticket-cart[data-id='t-vip']")
    page.wait_for_timeout(1000)

    # Open/verify the cart overlay
    print("4. Inspecting the Cart sidebar...")
    page.screenshot(path="/home/jules/verification/screenshots/verification_events.png")
    page.wait_for_timeout(1000)

    # Let's also verify Admin Event operations
    print("5. Logging in to Admin via Dev Bypass...")
    page.goto("http://localhost:8788/home")
    page.wait_for_timeout(1000)
    page.evaluate("foundationDevBypass()")
    page.wait_for_timeout(2000)

    # Click Event Operations tab in Admin
    print("6. Navigating to Event Operations tab...")
    page.click("button.admin-tab[data-tab='events']")
    page.wait_for_timeout(2000)

    # Take screenshot of the Admin Dashboard
    print("7. Screenshotting Admin Event Operations Dashboard...")
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
    print("Verification Script complete!")
