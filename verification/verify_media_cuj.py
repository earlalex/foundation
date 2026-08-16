import os
import glob
from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:3000")
    page.wait_for_timeout(1000)

    page.evaluate("window.__FOUNDATION_DEV_BYPASS__ = true;")
    page.wait_for_timeout(500)

    page.evaluate("window.router.navigateTo('/gallery')")
    page.wait_for_timeout(1500)

    page.screenshot(path="/home/jules/verification/screenshots/gallery_seeded.png")
    page.wait_for_timeout(1000)

    gallery_item = page.query_selector('.masonry-item')
    if gallery_item:
        gallery_item.click()
        page.wait_for_timeout(1500)
        page.screenshot(path="/home/jules/verification/screenshots/gallery_lightbox.png")

    page.evaluate("window.router.navigateTo('/videos')")
    page.wait_for_timeout(1500)

    page.screenshot(path="/home/jules/verification/screenshots/videos_seeded.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)

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
