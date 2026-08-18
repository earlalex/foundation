import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:3000/admin")
    page.wait_for_timeout(1000)

    # Open Site Settings
    site_tab = page.locator("[data-tab='tab-site']")
    if site_tab.is_visible():
        site_tab.click()
        page.wait_for_timeout(1000)

    # Launch Master Setup Wizard via Re-configure button
    reconfig_btn = page.locator("#btn-reconfigure-master-trigger")
    if reconfig_btn.is_visible():
        reconfig_btn.click()
        page.wait_for_timeout(1000)

    # Take screenshot
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    page.screenshot(path=os.path.join(os.path.dirname(__file__), 'screenshots', 'wizard_reconfigure.png'))
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir=os.path.join(os.path.dirname(__file__), 'videos')
        )
        page = context.new_page()
        context.add_init_script("window.__FOUNDATION_DEV_BYPASS__ = true;")
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
