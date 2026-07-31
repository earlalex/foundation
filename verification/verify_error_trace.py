# /home/jules/verification/verify_error_trace.py
from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.on("pageerror", lambda err: print(f"PAGEERROR: {err.name}: {err.message}"))
    page.on("response", lambda res: print(f"LOADED: {res.url} - {res.status}"))

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
