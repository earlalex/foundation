import os
import time
from playwright.sync_api import sync_playwright

def run_verification(page):
    page.add_init_script("""
        window.__FOUNDATION_DEV_BYPASS__ = true;
        localStorage.setItem('foundation_setup_completed', 'true');
        localStorage.setItem('foundation_wizard_dismissed', 'true');
    """)

    # Load initial page
    page.goto("http://localhost:3000/home")
    page.wait_for_timeout(1000)

    # 1. Test i18n Language Switch
    lang_select = page.locator("#nav-lang-selector")
    if lang_select.is_visible():
        lang_select.select_option("es")
        page.wait_for_timeout(1000)

    # 2. Test Universal Cart Engine
    page.evaluate("window.router.navigateTo('/shop')")
    page.wait_for_timeout(1500)

    add_btn = page.locator(".btn-add-product-cart").first
    if add_btn.is_visible():
        add_btn.click()
        page.wait_for_timeout(1000)

    cart_btn = page.locator("#nav-cart-btn")
    if cart_btn.is_visible():
        cart_btn.click(force=True)
        page.wait_for_timeout(1000)

    page.screenshot(path=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots', 'verification_cart.png'))

    # 3. Test 1-Month Paginated Calendar on /contact
    page.evaluate("window.router.navigateTo('/contact')")
    page.wait_for_timeout(1500)

    month_containers = page.locator(".calendar-month-container")
    count = month_containers.count()
    print(f"Calendar Month Containers Count: {count}")

    prev_btn = page.locator("#btn-prev-month")
    next_btn = page.locator("#btn-next-month")

    if prev_btn.is_visible():
        print(f"Prev Month Disabled at offset 0: {prev_btn.is_disabled()}")

    if next_btn.is_visible():
        print(f"Next Month Disabled at offset 0: {next_btn.is_disabled()}")

        # Click next month once (offset 1)
        next_btn.click()
        page.wait_for_timeout(1000)

        # Click next month second time (offset 2 - boundary limit)
        next_btn.click()
        page.wait_for_timeout(1000)

        print(f"Next Month Disabled at offset 2: {next_btn.is_disabled()}")

    # Take final verification screenshot
    page.screenshot(path=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots', 'verification.png'))
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    os.makedirs(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'videos'), exist_ok=True)
    os.makedirs(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots'), exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'videos')
        )
        page = context.new_page()
        try:
            run_verification(page)
        finally:
            context.close()
            browser.close()
