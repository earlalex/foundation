import os
from playwright.sync_api import sync_playwright

def run_cuj(page, context):
    context.add_init_script("window.__FOUNDATION_DEV_BYPASS__ = true;")

    def handle_console(msg):
        print(f"[BROWSER CONSOLE] {msg.text}")

    page.on("console", handle_console)

    print("Navigating to Admin panel...")
    page.goto("http://localhost:3000/admin")
    page.wait_for_timeout(2000)

    # Check if the "Site & Brand Setup Needed" card is visible
    if page.locator(".btn-launch-wizard").is_visible():
        print("Launching Site & Brand Setup Wizard...")
        page.locator(".btn-launch-wizard").click()
        page.wait_for_timeout(1000)

        # Step 1: Website Name & Base Domain
        print("Completing Step 1...")
        page.locator("#wz-site-title").fill("My Custom Brand Web")
        page.locator("#wz-site-domain").fill("http://localhost:3000")
        page.locator("#wz-next").click()
        page.wait_for_timeout(1000)

        # Step 2: Branding Assets
        print("Completing Step 2...")
        page.locator("#wz-logo-src").fill("/my-logo.png")
        page.locator("#wz-favicon-src").fill("/my-favicon.ico")
        page.locator("#wz-next").click()
        page.wait_for_timeout(1000)

        # Step 3: Select Theme Palette
        print("Completing Step 3 & click Finish...")
        page.locator("#wz-next").click()
        page.wait_for_timeout(2000)

    # Now the tab is unlocked. Let's find and verify the "Re-configure Settings" button!
    reconfig_btn = page.locator(".btn-reconfigure-settings")
    if reconfig_btn.is_visible():
        print("Re-configure Settings button is visible in the top-right toolbar!")
        print("Clicking Re-configure Settings to verify on-demand launch...")
        reconfig_btn.click()
        page.wait_for_timeout(1500)
    else:
        print("ERROR: Re-configure Settings button is not visible!")

    # Take screenshot of the setup wizard modal opened via the "Re-configure Settings" button
    print("Taking final screenshot...")
    page.screenshot(path=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots', 'verify_reconfigure.png'))
    page.wait_for_timeout(1000)

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
    print("Verification script run complete!")
