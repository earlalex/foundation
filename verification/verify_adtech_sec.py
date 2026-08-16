import sys
from playwright.sync_api import sync_playwright

def run_verification():
    print("[Playwright]: Launching browser context...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Record video
        context = browser.new_context(
            record_video_dir="verification/videos",
            viewport={"width": 1280, "height": 800}
        )
        page = context.new_page()

        # Capture console messages
        console_logs = []
        page.on("console", lambda msg: console_logs.append(msg.text))

        print("[Playwright]: Navigating to test runner...")
        page.goto("http://localhost:3000/index.html?runTests=1")
        page.wait_for_timeout(3000) # Wait for tests to finish executing

        # Check console logs for "Test Suite Summary"
        print("[Playwright]: Analyzing console outputs...")
        passed_summary = [log for log in console_logs if "Suites Passed" in log]
        for log in console_logs:
          if "PASS" in log or "FAIL" in log or "Suites Passed" in log or "Test Suite Summary" in log:
            print(f"  {log}")

        # Navigate to contact page to see Google My Business reviews and reviews CTA
        print("[Playwright]: Navigating to contact page...")
        page.goto("http://localhost:3000/index.html#/contact")
        page.wait_for_timeout(1500)

        # Take screenshot of contact page to see reviews card and styling
        print("[Playwright]: Capturing screenshot...")
        page.screenshot(path="verification/screenshots/verification.png")
        page.wait_for_timeout(1000)

        context.close()
        browser.close()
        print("[Playwright]: Done!")

if __name__ == "__main__":
    run_verification()
