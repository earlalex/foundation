import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    print("Navigating to homepage...")
    page.goto("http://localhost:3000")
    page.wait_for_timeout(1000)

    # Trigger developer bypass to set isInstalled, role: admin, etc.
    print("Triggering developer bypass...")
    page.evaluate("if (window.foundationDevBypass) window.foundationDevBypass();")
    page.wait_for_timeout(1500)

    # Now navigate cleanly to the home page
    print("Navigating back to home page...")
    page.goto("http://localhost:3000/home")
    page.wait_for_timeout(1500)

    # Scroll down to show the feature grid
    print("Scrolling to Feature Grid section...")
    page.locator("#homepage-features-grid-section").scroll_into_view_if_needed()
    page.wait_for_timeout(1000)

    # Take a screenshot of the home page feature grid
    page.screenshot(path=os.path.join(os.path.dirname(__file__), 'screenshots', 'homepage_feature_grid.png'))
    print("Home page feature grid screenshot saved.")

    # Click the Web3 & Crypto Payments 'Learn More' link in our new feature grid
    print("Clicking on Web3 & Crypto Payments 'Learn More' CTA...")
    crypto_card_cta = page.locator("a[href='/docs#crypto-payments']").first
    crypto_card_cta.click()
    page.wait_for_timeout(1500)  # Wait for SPA navigation and smooth scroll

    # Verify the URL is correct
    print("Current URL:", page.url)

    # Take screenshot of the target /docs page focused on Web3 & Crypto Payments section
    page.screenshot(path=os.path.join(os.path.dirname(__file__), 'screenshots', 'docs_crypto_payments.png'))
    print("Docs page screenshot saved.")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    # Ensure verification directories exist
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)

    with sync_playwright() as p:
        print("Launching Chromium browser...")
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir=os.path.join(os.path.dirname(__file__), 'videos')
        )
        page = context.new_page()
        try:
            run_cuj(page)
        except Exception as e:
            print("Error running CUJ:", e)
            raise
        finally:
            print("Closing browser and saving video...")
            context.close()
            browser.close()
            print("Done!")
