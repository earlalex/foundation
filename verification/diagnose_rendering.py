import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.on("console", lambda msg: print(f"[BROWSER] {msg.type}: {msg.text}"))
    page.on("pageerror", lambda err: print(f"[BROWSER ERROR] {err}"))

    page.goto("http://localhost:3000/")
    page.wait_for_timeout(1000)

    if page.locator("text=Foundation Setup Wizard").is_visible():
        print("Setup wizard visible. Proceeding to fill setup wizard form...")
        page.fill("#wizard-admin-email", "admin@earlalex.com")
        page.fill("#wizard-site-title", "Ascension Academy")
        page.fill("#wizard-fb-key", "AIzaSyFakeKey123")
        page.fill("#wizard-fb-project", "demo-project-id")
        page.wait_for_timeout(500)
        page.click("#btn-submit-wizard")
        print("Waiting 15 seconds for submission timeout, reload, and fresh load...")
        page.wait_for_timeout(15000)
    else:
        print("Setup wizard not visible.")

    page.screenshot(path=os.path.join(os.path.dirname(__file__), 'screenshots', 'verification4.png'))

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
