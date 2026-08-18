from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:3000/")
    page.wait_for_timeout(1000)

    # Bypass wizard / complete wizard
    page.evaluate("if (window.foundationDevBypass) window.foundationDevBypass();")
    page.wait_for_timeout(1000)

    # Click on Events link in navbar
    page.click("a[href='/events']")
    page.wait_for_timeout(1500)

    # Take screenshot at top (Hero)
    page.screenshot(path="/home/jules/verification/screenshots/events_hero.png")

    # Scroll down to featured spotlight & grid
    page.evaluate("window.scrollTo(0, 600)")
    page.wait_for_timeout(500)
    page.screenshot(path="/home/jules/verification/screenshots/events_grid.png")

    # Scroll down to reviews section
    page.evaluate("window.scrollTo(0, 1600)")
    page.wait_for_timeout(500)
    page.screenshot(path="/home/jules/verification/screenshots/events_reviews_bottom.png")

    # Full page screenshot
    page.screenshot(path="/home/jules/verification/screenshots/events_reordered_layout.png", full_page=True)
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
