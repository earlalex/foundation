from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Set standard viewport size
    page.set_viewport_size({"width": 1280, "height": 800})

    # Navigate to home and wait
    page.goto("http://localhost:3000/index.html")
    page.wait_for_timeout(2000)

    # Trigger Developer Bypass to simulate admin logged-in state
    page.evaluate("window.foundationDevBypass()")
    page.wait_for_timeout(2000)

    # Click on the Plugins & Extensions tab button in the sidebar
    page.click('button.admin-tab[data-tab="plugins"]')
    page.wait_for_timeout(2000)

    # Take screenshot of the newly introduced Plugins management tab panel
    page.screenshot(path=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots', 'verification.png'))
    page.wait_for_timeout(1000)

if __name__ == "__main__":
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
