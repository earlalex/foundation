# /home/jules/verification/verify_network.py
from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
    page.on("pageerror", lambda err: print(f"PAGEERROR: {err}"))
    page.on("requestfailed", lambda req: print(f"REQ-FAILED: {req.url} - {req.failure.error_text}"))
    page.on("response", lambda res: print(f"RESP: {res.url} - {res.status}") if res.status >= 400 else None)

    print("1. Loading events page...")
    page.goto("http://localhost:8788/events")
    page.wait_for_timeout(5000)

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
