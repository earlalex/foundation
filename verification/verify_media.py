# verification/verify_media.py
import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    print("Loading homepage...")
    page.goto("http://localhost:3000/")
    page.wait_for_timeout(2000)

    print("Activating developer bypass...")
    page.evaluate("window.foundationDevBypass()")
    page.wait_for_timeout(1000)

    print("Navigating to Gallery route client-side...")
    page.evaluate("window.router.navigateTo('/gallery')")
    page.wait_for_timeout(2000)

    # 1. Take a screenshot of the Photo Gallery page
    print("Taking gallery screenshot...")
    page.screenshot(path=os.path.join(os.path.dirname(__file__), 'screenshots', 'gallery_page.png'))
    page.wait_for_timeout(1000)

    # 2. Click on the first gallery item to open lightbox
    print("Clicking gallery item to open lightbox...")
    first_item = page.locator(".masonry-item").first
    if first_item.is_visible():
        first_item.click()
        page.wait_for_timeout(2000)
        page.screenshot(path=os.path.join(os.path.dirname(__file__), 'screenshots', 'gallery_lightbox.png'))
        page.wait_for_timeout(1000)
        # Close lightbox
        page.locator("#btn-close-lightbox").click()
        page.wait_for_timeout(1000)

    # 3. Navigate to /videos page client-side
    print("Navigating to videos page client-side...")
    page.evaluate("window.router.navigateTo('/videos')")
    page.wait_for_timeout(2000)
    page.screenshot(path=os.path.join(os.path.dirname(__file__), 'screenshots', 'videos_page.png'))
    page.wait_for_timeout(1000)

    # 4. Interact with the video player (clicking play)
    print("Clicking play on video stream player...")
    play_btn = page.locator("#btn-play-pause")
    if play_btn.is_visible():
        play_btn.click()
        page.wait_for_timeout(2000) # Let it play for a bit

    # Take final state screenshot of video page with persistent radio player
    page.screenshot(path=os.path.join(os.path.dirname(__file__), 'screenshots', 'videos_page_played.png'))
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
        except Exception as e:
            print(f"Error during CUJ: {e}")
        finally:
            context.close()
            browser.close()
            print("Verification CUJ run finished.")
