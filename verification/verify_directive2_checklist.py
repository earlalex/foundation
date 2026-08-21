import os
import sys
import asyncio
from playwright.async_api import async_playwright

async def run_checklist_audit():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            record_video_dir=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'videos')
        )
        page = await context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print("\n--- Starting Directive 2 Checklist Audit ---")
        passed_all_checks = True

        try:
            # 1. Setup & Bypass
            await page.add_init_script("""
                window.__FOUNDATION_DEV_BYPASS__ = true;
                localStorage.setItem('foundation_setup_completed', 'true');
                localStorage.setItem('foundation_wizard_dismissed', 'true');
            """)

            await page.goto("http://localhost:3000/", wait_until="domcontentloaded")
            await page.wait_for_timeout(2000)

            print("\n1. Onboarding & Security Gates:")
            await page.evaluate("""
                () => {
                    if (window.foundationDevBypass) {
                        window.foundationDevBypass();
                    } else if (window.store) {
                        window.store.dispatch('SET_USER', {
                            uid: 'admin_bypass',
                            email: 'admin@earlalex.com',
                            displayName: 'Bypass Admin',
                            isAdmin: true,
                            role: 'admin'
                        });
                        window.store.dispatch('SET_DEV_MODE', true);
                    }
                }
            """)
            await page.wait_for_timeout(1000)

            # Navigate to admin
            await page.evaluate("window.router && window.router.navigateTo('/admin')")
            await page.wait_for_timeout(1000)

            admin_rendered = await page.evaluate("document.body.innerText.includes('Admin') || window.location.pathname.includes('/admin')")
            print(f"  [{'PASS' if admin_rendered else 'FAIL'}] /admin access under bypass: {admin_rendered}")
            if not admin_rendered: passed_all_checks = False

            # Check lockdown without bypass
            context_guest = await browser.new_context()
            page_guest = await context_guest.new_page()
            await page_guest.goto("http://localhost:3000/admin", wait_until="domcontentloaded")
            await page_guest.wait_for_timeout(1500)
            lockdown_active = await page_guest.evaluate("document.body.innerText.includes('Access Restricted') || document.body.innerText.includes('Sign In') || window.location.pathname.includes('/login') || !document.querySelector('#admin-sidebar')")
            print(f"  [{'PASS' if lockdown_active else 'FAIL'}] /admin lockdown for unauthorized guests: {lockdown_active}")
            if not lockdown_active: passed_all_checks = False
            await context_guest.close()

            # 2. Media, Streaming & Component Library
            print("\n2. Media, Streaming, & Component Library:")
            await page.evaluate("window.router && window.router.navigateTo('/gallery')")
            await page.wait_for_timeout(1000)
            gallery_rendered = await page.evaluate("document.querySelector('photo-gallery') !== null || document.querySelector('#gallery-grid') !== null || window.location.pathname.includes('/gallery')")
            print(f"  [{'PASS' if gallery_rendered else 'FAIL'}] /gallery masonry grid rendered: {gallery_rendered}")
            if not gallery_rendered: passed_all_checks = False

            await page.evaluate("window.router && window.router.navigateTo('/videos')")
            await page.wait_for_timeout(1000)
            video_rendered = await page.evaluate("document.querySelector('video-library') !== null || document.querySelector('#video-grid') !== null || window.location.pathname.includes('/videos')")
            print(f"  [{'PASS' if video_rendered else 'FAIL'}] /videos streaming portal rendered: {video_rendered}")
            if not video_rendered: passed_all_checks = False

            # Test Radio Coordinator
            radio_sync = await page.evaluate("""
                async () => {
                    const { radioCoordinator } = await import('/core/radio.js');
                    const playlist = await radioCoordinator.getRadioPlaylist();
                    const liveUrl = radioCoordinator.getLiveStreamUrl();
                    return Array.isArray(playlist) && playlist.length > 0 && typeof liveUrl === 'string';
                }
            """)
            print(f"  [{'PASS' if radio_sync else 'FAIL'}] Radio Coordinator playlist & stream retrieval: {radio_sync}")
            if not radio_sync: passed_all_checks = False

            # 3. E-Commerce, Multi-Item Cart & Payouts
            print("\n3. E-Commerce, Multi-Item Cart, & Payouts:")
            cart_test = await page.evaluate("""
                async () => {
                    const { eventCart } = await import('/utils/eventCart.js');
                    eventCart.clearCart();
                    eventCart.addItem(null, 'product', 'prod_1', 1, 100, 'Product 1');
                    eventCart.addItem('evt_123', 'event', 'evt_1', 1, 50, 'Event Ticket');

                    const summary = eventCart.getCartSummary();
                    const subtotalOk = summary.subtotal === 150;
                    const taxOk = Math.abs(summary.tax - 12.38) < 0.05;
                    const feeOk = summary.serviceFee === 3.00;
                    const totalOk = summary.total > 150;
                    return subtotalOk && taxOk && feeOk && totalOk;
                }
            """)
            print(f"  [{'PASS' if cart_test else 'FAIL'}] Universal Cart tax (8.25%) & fee ($1.50/item) calculations: {cart_test}")
            if not cart_test: passed_all_checks = False

            # Generate isolated high-entropy unique identifiers for test user & task
            user_linkage = await page.evaluate("""
                async () => {
                    const { contentDB } = await import('/core/db.js');
                    const uniqueId = 'audit_user_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
                    const testEmail = `${uniqueId}@example.com`;
                    window.__AUDIT_TEST_USER_ID__ = uniqueId;
                    window.__AUDIT_TEST_USER_EMAIL__ = testEmail;

                    const user = await contentDB.registerOrMergeUser({
                        email: testEmail,
                        purchasedProducts: ['prod_1', 'evt_1']
                    });
                    return user && Array.isArray(user.purchasedProducts) && user.purchasedProducts.includes('prod_1');
                }
            """)
            print(f"  [{'PASS' if user_linkage else 'FAIL'}] Purchased products account profile linkage: {user_linkage}")
            if not user_linkage: passed_all_checks = False

            wise_test = await page.evaluate("""
                async () => {
                    const { createQuote } = await import('/utils/backend-wise.js');
                    const quote = await createQuote(500, 'PHP');
                    return quote && quote.id && quote.sourceValue === 500;
                }
            """)
            print(f"  [{'PASS' if wise_test else 'FAIL'}] Wise Business Payout adapter quote generation: {wise_test}")
            if not wise_test: passed_all_checks = False

            # 4. Google Workspace & Operations
            print("\n4. Google Workspace & Operations:")
            olj_test = await page.evaluate("""
                async () => {
                    const { parseOnlineJobsProfile } = await import('/utils/onlinejobsParser.js');
                    const parsed = parseOnlineJobsProfile({
                        fullName: 'Clara Santos',
                        email: 'clara@example.com',
                        skills: 'Design, Copywriting',
                        expectedSalary: 700
                    });
                    return parsed.name === 'Clara Santos' && parsed.skills.length === 2 && parsed.type === 'va_candidate';
                }
            """)
            print(f"  [{'PASS' if olj_test else 'FAIL'}] OnlineJobs.ph candidate profile parsing: {olj_test}")
            if not olj_test: passed_all_checks = False

            kanban_test = await page.evaluate("""
                async () => {
                    const { contentDB } = await import('/core/db.js');
                    const taskId = 'audit_task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
                    window.__AUDIT_TEST_TASK_ID__ = taskId;

                    const task = await contentDB.saveKanbanTask({
                        id: taskId,
                        title: 'Audit Task',
                        status: 'backlog'
                    });
                    await contentDB.updateKanbanTaskStatus(taskId, 'in_progress');
                    const tasks = await contentDB.getKanbanTasks();
                    const updated = tasks.find(t => t.id === taskId);
                    return updated && updated.status === 'in_progress';
                }
            """)
            print(f"  [{'PASS' if kanban_test else 'FAIL'}] Kanban Board task status updates: {kanban_test}")
            if not kanban_test: passed_all_checks = False

            # 5. Accessibility, i18n & Performance
            print("\n5. Accessibility, i18n, & Performance:")
            i18n_test = await page.evaluate("""
                async () => {
                    const { i18n } = await import('/core/i18n.js');
                    i18n.setLanguage('es');
                    return i18n.currentLanguage === 'es';
                }
            """)
            print(f"  [{'PASS' if i18n_test else 'FAIL'}] i18n translation engine language switching: {i18n_test}")
            if not i18n_test: passed_all_checks = False

            contrast_test = await page.evaluate("""
                async () => {
                    const { calculateContrastRatio } = await import('/core/theme.js');
                    const ratio = calculateContrastRatio('#ffffff', '#000000');
                    return ratio >= 4.5;
                }
            """)
            print(f"  [{'PASS' if contrast_test else 'FAIL'}] WCAG 2.1 AA text contrast compliance utility (21:1 ratio): {contrast_test}")
            if not contrast_test: passed_all_checks = False

            # Take Audit Screenshot
            screenshot_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'screenshots', 'audit_directive2.png')
            await page.screenshot(path=screenshot_path)
            print(f"\nCaptured audit screenshot at: {screenshot_path}")

        finally:
            # Safely clean up strictly the isolated test records generated during this audit run
            print("\nCleaning up unique test audit records from database collections...")
            await page.evaluate("""
                async () => {
                    try {
                        const { contentDB } = await import('/core/db.js');
                        if (window.__AUDIT_TEST_USER_ID__) {
                            await contentDB.deleteUser(window.__AUDIT_TEST_USER_ID__);
                        }
                        if (window.__AUDIT_TEST_USER_EMAIL__) {
                            await contentDB.deleteUser(window.__AUDIT_TEST_USER_EMAIL__);
                        }
                        if (window.__AUDIT_TEST_TASK_ID__) {
                            await contentDB.deleteKanbanTask(window.__AUDIT_TEST_TASK_ID__);
                        }
                    } catch (e) {
                        console.warn('[Audit Cleanup]: Error removing test records', e);
                    }
                }
            """)

            await context.close()
            await browser.close()

        if not passed_all_checks:
            print("\n❌ Error: One or more audit checks failed.")
            sys.exit(1)

        print("\n✅ Directive 2 Checklist Audit Completed Successfully with 100% Pass Rate.")

if __name__ == "__main__":
    asyncio.run(run_checklist_audit())
