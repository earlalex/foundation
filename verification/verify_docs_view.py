# /home/jules/verification/verify_docs_view.py
import os
import glob
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Navigate to index.html
    print("[Playwright]: Navigating to http://localhost:3000/index.html...")
    page.goto("http://localhost:3000/index.html")
    page.wait_for_timeout(1000)

    # Trigger developer bypass to bypass onboarding wizard and render standard pages
    print("[Playwright]: Triggering Dev Console Bypass...")
    page.evaluate("window.foundationDevBypass()")
    page.wait_for_timeout(1000)

    # Navigate to home cleanly via the router
    print("[Playwright]: Navigating to home view via router...")
    page.evaluate("window.router.navigateTo('/home')")
    page.wait_for_timeout(1500)

    # Take a screenshot of the homepage hero banner showing the newly updated platform documentation link
    page.screenshot(path=os.path.join(os.path.dirname(__file__), 'screenshots', 'homepage_hero.png'))
    page.wait_for_timeout(500)

    # Click the "🛠️ Platform Documentation" button on the home page hero banner
    docs_button = page.locator("a#hero-secondary-cta")
    if docs_button.is_visible():
        print("[Playwright]: Clicking Platform Documentation link on Homepage...")
        docs_button.click()
    else:
        print("[Playwright]: docs link not found by ID, performing client-side navigateTo...")
        page.evaluate("window.router.navigateTo('/docs')")

    page.wait_for_timeout(2000) # wait for docs page transition and controller init

    # Verify we are on the docs page
    print(f"[Playwright]: Current URL is {page.url}")
    page.screenshot(path=os.path.join(os.path.dirname(__file__), 'screenshots', 'docs_initial.png'))

    # Click on the Setup & Environment section link in the sidebar nav
    setup_nav_link = page.locator("a.docs-nav-link", has_text="3. Setup & Environment")
    if setup_nav_link.is_visible():
        print("[Playwright]: Clicking Setup & Environment link in the sidebar...")
        setup_nav_link.click()
        page.wait_for_timeout(1500)

        # Take a screenshot showing the section scroll target
        page.screenshot(path=os.path.join(os.path.dirname(__file__), 'screenshots', 'docs_scrolled.png'))
    else:
        print("[Playwright]: Setup link not found, scrolling manually...")
        page.evaluate("window.scrollTo(0, 1000)")
        page.wait_for_timeout(500)
        page.screenshot(path=os.path.join(os.path.dirname(__file__), 'screenshots', 'docs_scrolled_manual.png'))

    page.wait_for_timeout(1000)

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
            run_cuj(page)
        finally:
            context.close()
            browser.close()

        # Print recorded video file
        video_files = glob.glob(os.path.join(os.path.dirname(__file__), 'videos', '*.webm'))
        if video_files:
            print(f"[Playwright]: Video recorded successfully: {video_files[0]}")
        else:
            print("[Playwright]: No video file found.")
