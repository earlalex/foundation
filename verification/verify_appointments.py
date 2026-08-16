import os
from playwright.sync_api import sync_playwright

def run_cuj(page, context):
    context.add_init_script("window.__FOUNDATION_DEV_BYPASS__ = true;")

    def handle_console(msg):
        print(f"[BROWSER CONSOLE] {msg.text}")

    page.on("console", handle_console)

    print("Navigating to home page...")
    page.goto("http://localhost:3000")
    page.wait_for_timeout(2000)

    print("Navigating to Contact SPA route...")
    page.evaluate("window.router.navigateTo('/contact')")
    page.wait_for_timeout(2000)

    # Verify multi-calendar rendered
    print("Verifying calendar is visible...")
    calendar = page.locator("#multi-calendar-wrapper")
    if calendar.is_visible():
        print("SUCCESS: Multi-calendar container is rendered!")
    else:
        print("ERROR: Multi-calendar container is NOT rendered!")

    # Click on an available green date if present
    print("Looking for green available dates...")
    available_day = page.locator(".calendar-day-available").first
    if available_day.is_visible():
        print("SUCCESS: Found available date! Clicking it...")
        available_day.click()
        page.wait_for_timeout(1000)

        # Look for time slot buttons
        btn_slot = page.locator(".btn-slot").first
        if btn_slot.is_visible():
            print("SUCCESS: Found available slots! Clicking a slot...")
            btn_slot.click()
            page.wait_for_timeout(1000)

            # Fill form
            page.locator("#appt-name").fill("John Doe")
            page.locator("#appt-email").fill("john.doe@example.com")
            page.locator("#appt-notes").fill("Hello, I would like to schedule a session.")
            page.wait_for_timeout(1000)
        else:
            print("WARNING: No slot buttons appeared after clicking day.")
    else:
        print("WARNING: No available days found in the calendar.")

    # Take screenshot of the contact page
    print("Taking Contact page screenshot...")
    page.screenshot(path="verification/screenshots/verify_contact_page.png")
    page.wait_for_timeout(1000)

    print("Navigating to Admin SPA route...")
    page.evaluate("window.router.navigateTo('/admin')")
    page.wait_for_timeout(2000)

    # Click on Events tab
    events_tab_btn = page.locator('.admin-tab[data-tab="events"]')
    if events_tab_btn.is_visible():
        print("Clicking Events tab...")
        events_tab_btn.click()
        page.wait_for_timeout(1500)

        # Check if Appointment Configurator Form is visible
        config_form = page.locator("#appointment-config-form")
        if config_form.is_visible():
            print("SUCCESS: Appointment & Paid Consultation Configurator is visible!")
        else:
            print("ERROR: Appointment & Paid Consultation Configurator is NOT visible!")
    else:
        print("ERROR: Events tab button not found in Admin panel.")

    # Take screenshot of the admin panel
    print("Taking Admin page screenshot...")
    page.screenshot(path="verification/screenshots/verify_admin_configurator.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    os.makedirs("verification/videos", exist_ok=True)
    os.makedirs("verification/screenshots", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page, context)
        finally:
            context.close()
            browser.close()
    print("Verification script run complete!")
