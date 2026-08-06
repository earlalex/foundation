from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:3000/")
    page.wait_for_timeout(1000)

    if page.locator("text=Foundation Setup Wizard").is_visible():
        page.fill("#wizard-admin-email", "admin@earlalex.com")
        page.fill("#wizard-site-title", "Ascension Academy")
        page.fill("#wizard-fb-key", "AIzaSyFakeKey123")
        page.fill("#wizard-fb-project", "demo-project-id")
        page.wait_for_timeout(500)
        page.click("#btn-submit-wizard")
        print("Waiting 15 seconds...")
        page.wait_for_timeout(15000)

    # Let's evaluate document.getElementById('app').innerHTML and outerHTML
    inner_html = page.evaluate("() => document.getElementById('app').innerHTML")
    print("--- INNER HTML OF APP CONTAINER ---")
    print(inner_html)

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
