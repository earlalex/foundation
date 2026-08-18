import asyncio
import os
from playwright.async_api import async_playwright

async def run_verification():
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            record_video_dir=os.path.join(os.path.dirname(__file__), 'videos'),
            viewport={"width": 1280, "height": 800}
        )
        page = await context.new_page()

        page.on("console", lambda msg: print(f"[BROWSER CONSOLE] {msg.text}"))

        await page.add_init_script("""
            window.__FOUNDATION_DEV_BYPASS__ = true;
            localStorage.setItem('foundation_config', JSON.stringify({
              isInstalled: true,
              adminEmails: ['admin@example.com', 'member@example.com', 'subscriber@example.com'],
              siteTitle: 'Ascension Avenue Academy',
              siteDomain: 'http://localhost:3000'
            }));
            localStorage.setItem('foundation_local_users', JSON.stringify({
              'user_999': {
                id: 'user_999',
                email: 'member@example.com',
                name: 'Alice Developer',
                displayName: 'Alice Developer',
                role: 'member',
                paymentStatus: 'Active'
              }
            }));
            localStorage.setItem('foundation_local_content', JSON.stringify({
              'course_js': {
                type: 'education',
                id: 'course_js',
                title: 'Vanilla JS Professional Course',
                description: 'Master raw DOM manipulation and zero-build reactive architectures.',
                access: { visibility: 'member' },
                modules: [
                  {
                    id: 'mod_1',
                    title: 'Core Fundamentals',
                    lessons: [
                      { id: 'lesson_1', title: 'ES Modules Deep Dive', contentType: 'rich-text', requiredRole: 'subscriber' },
                      { id: 'lesson_2', title: 'Interactive Quiz', contentType: 'h5p', requiredRole: 'member', passingScore: 80 }
                    ]
                  }
                ]
              }
            }));
            localStorage.setItem('foundation_local_course_progress', JSON.stringify({
              'user_999_course_js': {
                userId: 'user_999',
                courseId: 'course_js',
                completedLessons: ['lesson_1'],
                h5pScores: {
                  'lesson_2': { score: 9, maxScore: 10, percentage: 90, completedAt: '2026-07-30T19:23:00Z' }
                },
                overallProgress: 50,
                lastAccessedLesson: 'lesson_1',
                updatedAt: '2026-07-30T19:23:00Z'
              }
            }));
        """)

        print("Navigating to http://localhost:3000/...")
        await page.goto("http://localhost:3000/")
        await page.wait_for_timeout(2000)

        print("Bypassing Auth and Routing to /account...")
        await page.evaluate("""
            async () => {
              const { store } = await import('/core/store.js');

              // Redefine store.state to freeze user session
              Object.defineProperty(store, 'state', {
                get: () => ({
                  user: {
                    uid: 'user_999',
                    email: 'member@example.com',
                    displayName: 'Alice Developer',
                    role: 'member'
                  },
                  simulatedUserTier: 'member',
                  devMode: true,
                  theme: 'light',
                  contentFeed: [],
                  history: [],
                  chatLogs: []
                })
              });

              await window.router.loadRoute('/account');
            }
        """)
        await page.wait_for_timeout(3000)

        print(f"URL after bypass & loadRoute: {page.url}")

        # Check buttons again
        buttons = await page.evaluate("""
          () => [...document.querySelectorAll('button')].map(b => b.textContent)
        """)
        print(f"Buttons on page now: {buttons}")

        # Click on My Content button
        print("Clicking My Content tab...")
        await page.click("button:has-text('My Content')")
        await page.wait_for_timeout(2000)

        # Take high-fidelity screenshot
        screenshot_path = os.path.join(os.path.dirname(__file__), 'screenshots', 'verification.png')
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot taken at {screenshot_path}")

        await context.close()
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_verification())
