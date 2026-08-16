# verification/verify_error_details.py
from playwright.sync_api import sync_playwright

def run_cuj(page):
    def handle_error(err):
        print(f"ERROR: {err}")
        try:
            # err is an Error object in python, we can print its attributes
            print(f"Error Attributes: {dir(err)}")
            print(f"Message: {err.message}")
            print(f"Stack: {err.stack}")
        except Exception as e:
            print("Failed to get error attributes:", e)

    page.on("pageerror", handle_error)
    page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))

    print("1. Loading root page...")
    page.goto("http://localhost:8788/")
    page.wait_for_timeout(3000)

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
