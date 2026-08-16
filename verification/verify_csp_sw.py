from playwright.sync_api import sync_playwright
import os

def run_cuj(page):
    print("Navigating to http://localhost:3000")
    page.goto("http://localhost:3000")
    page.wait_for_timeout(2000)

    # Trigger some tabs to make the video engaging
    print("Simulating navigation to contact")
    # Click about or contact page if buttons exist
    try:
        page.get_by_text("Events").first.click()
        page.wait_for_timeout(1000)
    except Exception as e:
        print("Could not click Events:", e)

    # Take screenshot of the page
    screenshot_path = "verification/screenshots/verification.png"
    page.screenshot(path=screenshot_path)
    print(f"Screenshot saved to {screenshot_path}")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
            print("Browser context closed.")
