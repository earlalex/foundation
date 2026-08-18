import os
from playwright.sync_api import sync_playwright

def run_cuj(page, context):
    # Set development mode and dev bypass to bypass initial guards and login requirements
    context.add_init_script("window.__FOUNDATION_DEV_BYPASS__ = true;")

    def handle_console(msg):
        print(f"[BROWSER CONSOLE] {msg.text}")

    page.on("console", handle_console)

    print("Navigating to home page...")
    page.goto("http://localhost:3000/index.html")
    page.wait_for_timeout(2000)

    print("Navigating to Admin Command Center via SPA Router...")
    page.evaluate("window.router.navigateTo('/admin')")
    page.wait_for_timeout(2000)

    # Click on the Finances & Payroll tab
    print("Clicking on 'Finances & Payroll' tab...")
    page.locator(".admin-tab[data-tab='finances']").click()
    page.wait_for_timeout(1500)

    # Launch the Business Operations Setup Wizard
    print("Launching Business Operations Setup Wizard...")
    page.locator("#tab-finances .btn-launch-wizard, #tab-finances .btn-rerun-setup").first.click()
    page.wait_for_timeout(1500)

    # Step 1: Ticketing & Product Pricing Defaults
    print("Completing Step 1/4 of Business Operations Wizard...")
    page.locator("#wz-next").click()
    page.wait_for_timeout(1000)

    # Step 2: Finances & Payroll Options
    print("Completing Step 2/4 of Business Operations Wizard...")
    page.locator("#wz-next").click()
    page.wait_for_timeout(1000)

    # Step 3: Outbound Payroll & Payouts (Wise Business Configuration Card)
    print("Arrived at Step 3/4: Outbound Payroll & Payouts!")
    print("Filling out Wise API Token...")
    page.locator("#wz-wise-key").fill("wise_test_mock_token_key_991")
    page.wait_for_timeout(1000)

    # Click "Verify API Token & Fetch Profile ID"
    print("Clicking 'Verify API Token & Fetch Profile ID'...")
    page.locator("#btn-wz-verify-wise").click()
    page.wait_for_timeout(2000)

    # Take screenshot showing the Wise configuration card and verified profile ID
    print("Taking a screenshot showing the Wise integration state...")
    os.makedirs(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots'), exist_ok=True)
    page.screenshot(path=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots', 'wise_verified_wizard.png'))
    page.wait_for_timeout(1000)

    # Proceed to Step 4/4
    print("Proceeding to Step 4/4...")
    page.locator("#wz-next").click()
    page.wait_for_timeout(1000)

    # Finish & Unlock Wizard
    print("Completing Section 2 Setup Wizard...")
    page.locator("#wz-next").click()
    page.wait_for_timeout(2000)

    print("Business Operations Setup complete! Access is unlocked.")

if __name__ == "__main__":
    os.makedirs(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'videos'), exist_ok=True)
    os.makedirs(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots'), exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'videos')
        )
        page = context.new_page()
        try:
            run_cuj(page, context)
        finally:
            context.close()
            browser.close()
    print("Wise integration frontend verification run complete!")
