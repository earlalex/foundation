import os
import time
from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:3000/")

    # 1. Set config, cart data, and target route in storage
    cart_data = {
        "eventId": "event_101",
        "eventIds": ["event_101"],
        "items": [
            {
                "id": "prod_book_01",
                "type": "book",
                "name": "Zero-Build Architecture Playbook",
                "price": 29.00,
                "quantity": 1,
                "eventId": None
            },
            {
                "id": "evt_pass_01",
                "type": "event",
                "name": "Ascension Avenue Live Summit Pass",
                "price": 99.00,
                "quantity": 1,
                "eventId": "event_101"
            }
        ]
    }

    page.evaluate("""([config, cart]) => {
        localStorage.setItem('foundation_config', JSON.stringify(config));
        sessionStorage.setItem('foundation_universal_cart', JSON.stringify(cart));
        sessionStorage.setItem('foundation_event_cart', JSON.stringify(cart));
        sessionStorage.setItem('foundation_spa_route', '/cart');
        window.__FOUNDATION_DEV_BYPASS__ = true;
    }""", [{ 'isInstalled': True, 'siteTitle': 'Foundation Platform' }, cart_data])

    # 2. Reload page to initialize SPA router directly at /cart
    page.reload()
    page.wait_for_selector(".btn-qty-plus", timeout=10000)
    page.wait_for_timeout(1000)

    # 3. Increase quantity of item
    page.locator(".btn-qty-plus").first.click()
    page.wait_for_timeout(1000)

    # 4. Fill customer details
    page.fill("#cart-customer-email", "buyer@example.com")
    page.wait_for_timeout(500)
    page.fill("#cart-customer-name", "Jules Lead Architect")
    page.wait_for_timeout(500)

    # 5. Fill shipping address
    page.fill("#cart-ship-street", "777 Innovation Way")
    page.fill("#cart-ship-city", "San Francisco")
    page.fill("#cart-ship-state", "CA")
    page.fill("#cart-ship-zip", "94105")
    page.wait_for_timeout(500)

    # 6. Select Bank Transfer / ACH option
    page.get_by_label("Bank Transfer / ACH Direct Debit ($5 Flat Fee)").click()
    page.wait_for_timeout(1000)

    # 7. Select Web3 Crypto option
    page.get_by_label("Web3 Cryptocurrency (ETH / MATIC / USDC)").click()
    page.wait_for_timeout(1000)

    # 8. Select Credit Card option
    page.get_by_label("Credit / Debit Card (Stripe / Apple Pay)").click()
    page.wait_for_timeout(1000)

    # Take screenshot of populated cart and checkout form
    screenshot_path = "/home/jules/verification/screenshots/cart_checkout_page.png"
    page.screenshot(path=screenshot_path)
    page.wait_for_timeout(1500)

    # 9. Complete Purchase
    page.get_by_role("button", name=" Complete Secure Purchase").click()
    page.wait_for_timeout(2000)

if __name__ == "__main__":
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
