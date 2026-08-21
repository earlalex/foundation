import os
from playwright.sync_api import sync_playwright

def run_cuj(page):
    print("Navigating to Admin Command Center...")
    page.goto("http://localhost:3000/admin")
    page.wait_for_timeout(1000)

    print("Opening Foundation Worksheet Wizard via JS trigger...")
    page.evaluate("""() => {
        const { AdminSetupWizards } = window;
        if (AdminSetupWizards) {
            AdminSetupWizards.launchFoundationWorksheetWizard();
        } else {
            const w = document.createElement('foundation-worksheet-wizard');
            document.body.appendChild(w);
        }
    }""")
    page.wait_for_timeout(1000)

    print("Advancing through steps...")
    page.get_by_role("button", name="Next Step").click()
    page.wait_for_timeout(500)

    page.get_by_role("button", name="Next Step").click()
    page.wait_for_timeout(500)

    page.get_by_role("button", name="Next Step").click()
    page.wait_for_timeout(500)

    page.get_by_role("button", name="Next Step").click()
    page.wait_for_timeout(1500)

    print("Taking screenshot of Brand Psychology Rationale Card...")
    page.screenshot(path="verification/screenshots/brand_worksheet_rationale_card.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    os.makedirs("verification/videos", exist_ok=True)
    os.makedirs("verification/screenshots", exist_ok=True)

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
