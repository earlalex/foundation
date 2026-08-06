from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:3000/")
    page.wait_for_timeout(1000)

    # Let's check local storage before submit
    print("LocalStorage before submit:", page.evaluate("() => JSON.stringify(localStorage)"))

    if page.locator("text=Foundation Setup Wizard").is_visible():
        page.fill("#wizard-admin-email", "admin@earlalex.com")
        page.fill("#wizard-site-title", "Ascension Academy")
        page.fill("#wizard-fb-key", "AIzaSyFakeKey123")
        page.fill("#wizard-fb-project", "demo-project-id")
        page.wait_for_timeout(500)
        page.click("#btn-submit-wizard")
        print("Clicked submit. Waiting for reload...")
        page.wait_for_timeout(15000)

    print("LocalStorage after reload:", page.evaluate("() => JSON.stringify(localStorage)"))
    print("Page title after reload:", page.title())
    print("Page url after reload:", page.url)

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
