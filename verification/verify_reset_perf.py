import os
import sys
from playwright.sync_api import sync_playwright

def run_cuj(page):
    # Capture console messages
    page.on("console", lambda msg: print(f"Browser Console: {msg.text}"))
    page.on("pageerror", lambda err: print(f"Browser Error: {err.message}"))

    # Navigate to local server
    print("Navigating to http://localhost:8788/admin")
    page.goto("http://localhost:8788/admin")
    page.wait_for_timeout(3000)

    # Emergency Console dev bypass to authenticate as Admin
    print("Executing Emergency dev bypass...")
    page.evaluate("window.foundationDevBypass()")
    page.wait_for_timeout(4000)

    # Let's inspect the page title
    print(f"Page Title: {page.title()}")

    # We take screenshot of the Admin Dashboard showing Factory Reset Platform button
    page.screenshot(path="verification/screenshots/verification.png")
    page.wait_for_timeout(1000)

    # Find the trigger button
    btn_exists = page.evaluate("!!document.getElementById('btn-factory-reset-trigger')")
    print(f"Factory Reset Button Exists: {btn_exists}")

    if btn_exists:
        # Trigger factory reset modal
        print("Clicking Factory Reset trigger...")
        page.click("#btn-factory-reset-trigger")
        page.wait_for_timeout(2000)
        page.screenshot(path="verification/screenshots/reset_modal_step1.png")

        # Proceed to step 2
        print("Clicking next step...")
        page.click("#btn-reset-next")
        page.wait_for_timeout(2000)
        page.screenshot(path="verification/screenshots/reset_modal_step2.png")

        # Type verification phrase
        print("Typing verification phrase...")
        page.fill("#input-confirm-phrase", "RESET-FOUNDATION")
        page.wait_for_timeout(2000)
        page.screenshot(path="verification/screenshots/reset_modal_step2_typed.png")

        # Cancel reset to keep settings intact for now
        print("Cancelling reset to keep settings intact...")
        page.click("#btn-reset-back")
        page.wait_for_timeout(1000)
        page.click("#btn-reset-cancel")
        page.wait_for_timeout(1000)
        print("CUJ completed successfully.")

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
