import os
from playwright.sync_api import sync_playwright

def run_verification(page, context):
    context.add_init_script("window.__FOUNDATION_DEV_BYPASS__ = true;")

    console_errors = []
    def handle_console(msg):
        print(f"[BROWSER LOG] {msg.type}: {msg.text}")
        if msg.type == "error":
            console_errors.append(msg.text)

    page.on("console", handle_console)

    print("Navigating to Admin User Directory...")
    page.goto("http://localhost:3000/admin")
    page.wait_for_timeout(2000)

    # 1. Test Google Contacts Sync with malformed/null records injected into DB
    print("Injecting malformed/null records into contentDB users and running syncAllToGoogleContacts...")
    sync_result = page.evaluate("""async () => {
      try {
        const { contentDB } = await import('./core/db.js');
        const { syncAllToGoogleContacts } = await import('./pages/admin/modules/admin-users.js');

        // Save malformed/null/missing-role records
        await contentDB.saveUser({ id: 'bad-user-1', name: null, email: null, role: undefined });
        await contentDB.saveUser({ id: 'bad-user-2', email: 'valid-test@example.com', profile: { role: 'member' } });
        await contentDB.saveUser({ id: 'bad-user-3' });

        // Execute batch sync
        const count = await syncAllToGoogleContacts();
        return { success: true, count };
      } catch (err) {
        return { success: false, error: err.message, stack: err.stack };
      }
    }""")

    print("Sync Result:", sync_result)
    assert sync_result.get("success") == True, f"syncAllToGoogleContacts failed with error: {sync_result.get('error')}"

    # Click `#btn-sync-google-contacts` on the User Directory tab
    print("Navigating to Users Tab in Admin...")
    user_tab_btn = page.locator("[data-tab='tab-users']")
    if user_tab_btn.is_visible():
        user_tab_btn.click()
        page.wait_for_timeout(1000)

    sync_btn = page.locator("#btn-sync-google-contacts")
    if sync_btn.is_visible():
        print("Clicking #btn-sync-google-contacts...")
        sync_btn.click()
        page.wait_for_timeout(1000)

    # 2. Test Re-configure Platform Master Settings Button & Wizard Launch
    print("Navigating to Site Settings tab...")
    site_tab_btn = page.locator("[data-tab='tab-site']")
    if site_tab_btn.is_visible():
        site_tab_btn.click()
        page.wait_for_timeout(1000)

    reconfig_btn = page.locator("#btn-reconfigure-master-trigger")
    assert reconfig_btn.is_visible(), "Re-configure Platform Master Settings button is not visible!"
    print("Clicking Re-configure Platform Master Settings button...")
    reconfig_btn.click()
    page.wait_for_timeout(1500)

    # Check if <master-setup-wizard> modal is mounted in DOM
    wizard_el = page.locator("master-setup-wizard")
    assert wizard_el.is_visible(), "<master-setup-wizard> element failed to mount!"
    print("<master-setup-wizard> successfully opened!")

    # Verify mode toggle
    toggle_b = page.locator("#toggle-mode-b")
    if toggle_b.is_visible():
        print("Toggling to Traditional Blueprint Form...")
        toggle_b.click()
        page.wait_for_timeout(500)

    # Screenshot
    os.makedirs("test-results", exist_ok=True)
    page.screenshot(path="test-results/verify_repair_contacts_and_wizard.png")
    print("Screenshot saved to test-results/verify_repair_contacts_and_wizard.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        try:
            run_verification(page, context)
            print("VERIFICATION SUCCESSFUL!")
        finally:
            context.close()
            browser.close()
