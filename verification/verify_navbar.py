import os
import glob
from playwright.sync_api import sync_playwright

def run_cuj(page):
    print("Navigating to http://localhost:3000...")
    page.goto("http://localhost:3000")
    page.wait_for_timeout(2000)

    # Click on some navbar items to showcase them
    # Let's find the Documentation link
    print("Clicking 'Documentation' in the header...")
    doc_link = page.get_by_role("link", name="Documentation", exact=True)
    if doc_link.is_visible():
        doc_link.click()
        page.wait_for_timeout(1000)

    # Let's find the Shop link
    print("Clicking 'Shop' in the header...")
    shop_link = page.get_by_role("link", name="Shop", exact=True)
    if shop_link.is_visible():
        shop_link.click()
        page.wait_for_timeout(1000)

    # Take screenshot at the shop page
    print("Taking screenshot...")
    page.screenshot(path=os.path.join(os.path.dirname(__file__), 'screenshots', 'verification.png'))
    page.wait_for_timeout(1000)

if __name__ == "__main__":
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
            print("Done!")
