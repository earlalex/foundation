import os
from playwright.sync_api import sync_playwright

def run_cuj(page, context):
    # Setup localStorage bypass parameters before page navigation
    context.add_init_script("""
        window.__FOUNDATION_DEV_BYPASS__ = true;
        window.localStorage.setItem('foundation_dev_mode', 'true');
        window.localStorage.setItem('foundation_config', JSON.stringify({
            siteTitle: 'Foundation Framework',
            siteDomain: 'http://localhost:3000',
            adminEmails: ['admin@earlalex.com'],
            isInstalled: true,
            email: {
                defaultFromEmail: 'noreply@earlalex.com',
                primaryProvider: 'MailChannels (Free Cloudflare)',
                inboundForwardingTarget: 'admin@earlalex.com',
                isConfigured: true
            }
        }));
    """)

    def handle_console(msg):
        print(f"[BROWSER CONSOLE] {msg.type}: {msg.text}")

    page.on("console", handle_console)
    page.on("pageerror", lambda err: print(f"[BROWSER ERROR] {err.message}"))

    print("Navigating to Home Page first...")
    page.goto("http://localhost:3000/")
    page.wait_for_timeout(3000)

    print("Programmatically navigating to /admin via SPA Router...")
    page.evaluate("window.router.navigateTo('/admin')")
    page.wait_for_timeout(3000)

    # Let's take a screenshot of the initial admin dashboard load
    print("Taking screenshot of initial admin load...")
    page.screenshot(path=os.path.join(os.path.dirname(__file__), 'screenshots', 'initial_admin.png'))

    # Click on the "Re-configure Platform Master Settings" button to open the onboarding wizard
    reconfig_btn = page.locator("#btn-reconfigure-master-trigger")
    if reconfig_btn.is_visible():
        print("Clicking Re-configure Platform Master Settings button...")
        reconfig_btn.scroll_into_view_if_needed()
        page.wait_for_timeout(1000)
        reconfig_btn.click()
        page.wait_for_timeout(2000)

        # Inside Setup Wizard, toggle the "How to set up Free Emails" guide
        print("Toggling the Free Emails DNS Guide inside Master Onboarding...")
        free_email_btn = page.locator("span.help-btn-guide[data-target='help-m-free-email']")
        if free_email_btn.is_visible():
            free_email_btn.click()
            page.wait_for_timeout(1000)

            # Take screenshot of the setup wizard with the free email guide visible
            print("Taking screenshot of Onboarding Free Email DNS Guide...")
            page.screenshot(path=os.path.join(os.path.dirname(__file__), 'screenshots', 'wizard_free_emails.png'))
            page.wait_for_timeout(1000)

            # Close the guide
            free_email_btn.click()
            page.wait_for_timeout(1000)

        # Click Cancel to dismiss the setup wizard modal
        cancel_btn = page.locator(".btn-cancel-modal")
        if cancel_btn.is_visible():
            cancel_btn.click()
            page.wait_for_timeout(1000)

    # Find the "Email Routing & MailChannels Settings" card on Site Settings page
    email_card = page.locator("#email-routing-settings-card")
    if email_card.is_visible():
        print("Email Routing & MailChannels Settings card is visible!")
        email_card.scroll_into_view_if_needed()
        page.wait_for_timeout(1000)

        # Interact with the input fields
        page.locator("#email-cfg-default-from").fill("outbound@earlalex.com")
        page.locator("#email-cfg-primary-provider").select_option("Google Workspace / Gmail API")
        page.locator("#email-cfg-forwarding-target").fill("my-personal@gmail.com")
        page.wait_for_timeout(1000)

        # Click Save
        print("Saving Email Routing Settings...")
        page.locator("#email-routing-settings-form button[type='submit']").click()
        page.wait_for_timeout(2000)

        # Click the "How to set up Free Emails" button on the card to trigger the dedicated popup modal
        print("Triggering the Free Emails DNS Guide Modal from Settings card...")
        page.locator("#btn-show-email-dns-guide").click()
        page.wait_for_timeout(2000)

        # Take screenshot of the popup DNS guide modal
        print("Taking final screenshot of DNS Guide Modal...")
        page.screenshot(path=os.path.join(os.path.dirname(__file__), 'screenshots', 'verification.png'))
        page.wait_for_timeout(2000)

        # Close the modal
        page.locator("#btn-dns-guide-close").click()
        page.wait_for_timeout(1000)
    else:
        print("ERROR: Email settings card not found!")

if __name__ == "__main__":
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir=os.path.join(os.path.dirname(__file__), 'videos')
        )
        page = context.new_page()
        try:
            run_cuj(page, context)
        finally:
            context.close()
            browser.close()
    print("Verification script run complete!")
