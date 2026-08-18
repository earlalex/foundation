import os
import glob
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Inject __FOUNDATION_DEV_BYPASS__ synchronously before any script executes on the page
    print("Enabling global development bypass...")
    page.context.add_init_script("window.__FOUNDATION_DEV_BYPASS__ = true;")

    print("Navigating to http://localhost:3000/...")
    page.goto("http://localhost:3000/")
    page.wait_for_timeout(1000)

    # Set config values inside localStorage to bypass setup wizard
    page.evaluate("""() => {
        localStorage.setItem('foundation_config', JSON.stringify({
            isInstalled: true,
            siteTitle: "Foundation Framework",
            adminEmails: ["admin@earlalex.com"],
            features: {
                imagenAiGenerator: true
            },
            sectionWizards: { section1: true, section2: true, section3: true, section4: true }
        }));
        sessionStorage.setItem('firebase_user', JSON.stringify({
            email: 'admin@earlalex.com',
            role: 'admin',
            isAdmin: true,
            displayName: 'Jules Architect'
        }));
        localStorage.setItem('foundation_dev_mode', 'true');
    }""")
    page.wait_for_timeout(1000)

    # Navigate to the Admin Command Center
    print("Navigating to Admin Command Center (/admin)...")
    page.goto("http://localhost:3000/admin")
    page.wait_for_timeout(2000)

    # Take screenshot of the Site Settings Tab
    print("Taking screenshot of Admin Identity / Site Settings Tab...")
    page.screenshot(path=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots', 'verification.png'))
    page.wait_for_timeout(1000)

    # Click on the CMS tab in the sidebar
    print("Navigating to CMS Publisher Tab...")
    cms_tab = page.locator(".admin-tab[data-tab='cms']")
    if cms_tab.is_visible():
        cms_tab.click()
        page.wait_for_timeout(1000)

        # Take screenshot of the CMS Publisher tab showing the generator button next to featured image url
        print("Taking screenshot of CMS Publisher Tab with Imagen...")
        page.screenshot(path=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots', 'cms_verification.png'))
        page.wait_for_timeout(1000)

    # Click on the Products & Services tab
    print("Navigating to Products & Services Tab...")
    products_tab = page.locator(".admin-tab[data-tab='products']")
    if products_tab.is_visible():
        products_tab.click()
        page.wait_for_timeout(1000)

        # Take screenshot of the Products list showing the mock product generation button
        print("Taking screenshot of Products & Services Tab with mock generator...")
        page.screenshot(path=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots', 'products_verification.png'))
        page.wait_for_timeout(1000)

if __name__ == "__main__":
    os.makedirs(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'videos'), exist_ok=True)
    os.makedirs(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots'), exist_ok=True)

    # Clean previous webm files
    for webm in glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'videos', '*.webm')):
        try:
            os.remove(webm)
        except Exception:
            pass

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'videos')
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
            print("Frontend verification CUJ run finished!")
