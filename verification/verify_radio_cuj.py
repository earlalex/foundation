import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:3000")
    page.wait_for_timeout(1000)

    # Bypass wizard and dev mode
    page.evaluate("""() => {
        localStorage.setItem('foundation_setup_complete', 'true');
        window.__FOUNDATION_DEV_BYPASS__ = true;
    }""")
    page.reload()
    page.wait_for_timeout(1000)

    play_btn = page.query_selector('#btn-radio-play-pause')
    if play_btn:
        play_btn.click(force=True)
        page.wait_for_timeout(1000)

    selector = page.query_selector('#radio-playlist-selector')
    if selector:
        selector.select_option("0")
        page.wait_for_timeout(1000)

    page.screenshot(path="/home/jules/verification/screenshots/radio_player.png")
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
