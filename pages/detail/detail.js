// pages/detail/detail.js - Dynamic Publication Details and Interactive Curriculum Course Player
import { contentDB } from '../../core/db.js';
import { renderContent } from '../../utils/universalRenderer.js';
import { authManager } from '../../core/auth.js';
import { errorHandler } from '../../core/error-handler.js';
import { store } from '../../core/store.js';
import { toast } from '../../utils/toast.js';

const roleWeights = {
  'prospect': 0,
  'subscriber': 1,
  'member': 2,
  'affiliate': 3,
  'affiliated member': 3,
  'editor': 4,
  'admin': 5
};

export async function initDetailPage() {
  const container = document.getElementById('detail-view-container');
  if (!container) return;

  const sanitizeInputString = (str) => {
    if (typeof str !== 'string') return str;
    return str
      .replace(/<[^>]*>/g, '')
      .replace(/[&<>'"]/g, (tag) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag));
  };

  const urlParams = new URLSearchParams(window.location.search);
  const contentId = sanitizeInputString(urlParams.get('id'));
  const resumeParam = sanitizeInputString(urlParams.get('resume'));

  if (!contentId) {
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 3rem;">
        <h2 style="margin-top: 0; color: #e53e3e;">Publication Not Specified</h2>
        <p style="color: #718096; margin-bottom: 1.5rem;">No valid publication ID was provided in the route.</p>
        <a href="/home" class="btn-primary">Return to Homepage</a>
      </div>
    `;
    return;
  }

  try {
    const item = await contentDB.getContentById(contentId);

    if (!item) {
      container.innerHTML = `
        <div class="card" style="text-align: center; padding: 3rem;">
          <h2 style="margin-top: 0; color: #e53e3e;">Publication Not Found</h2>
          <p style="color: #718096; margin-bottom: 1.5rem;">The requested publication ("${contentId}") could not be located.</p>
          <a href="/home" class="btn-primary">Return to Feed</a>
        </div>
      `;
      return;
    }

    // Handle e-commerce product storefront details custom path
    if (item.type === 'product') {
      const { renderProductStorefront, initProductStorefrontListeners } = await import('../shop/product.js');
      container.innerHTML = renderProductStorefront(item);
      initProductStorefrontListeners(item);
      return;
    }

    // Render Unlocked vs Paywall View using Universal Renderer
    container.innerHTML = renderContent(item);

    // --- Interactive Curriculum Course Player Integration ---
    if (item.type === 'education' && item.modules && item.modules.length > 0) {
      await initializeCurriculumPlayer(item, resumeParam);
      return;
    }

    // Wire Flat Paywall Action Listeners
    document.getElementById('btn-paywall-subscribe')?.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      initiateStripeCheckout();
    });

    document.getElementById('btn-paywall-login')?.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        await authManager.loginWithGoogle();
        window.location.reload();
      } catch (err) {
        errorHandler.handleError(err, 'Detail Page - Google Login');
        alert('Login failed. Please try again.');
      }
    });

  } catch (err) {
    errorHandler.handleError(err, 'Detail Page - Initialization');
    console.error('Error initializing detail page:', err);
    container.innerHTML = `
      <div class="card" style="text-align: center; padding: 3rem; color: #e53e3e;">
        Failed to load publication details.
      </div>
    `;
  }
}

// Curriculum Player Logic
async function initializeCurriculumPlayer(course, resumeParam) {
  const user = store.state.user;
  const currentRole = store.state.simulatedUserTier || user?.role || 'prospect';
  const hasUserSession = store.state.simulatedUserTier ? (store.state.simulatedUserTier !== 'prospect') : !!user;

  // Track overall stats bar visibility
  const progressBanner = document.getElementById('course-player-overall-progress');
  if (hasUserSession && progressBanner) {
    progressBanner.style.display = 'block';
  }

  // Load user progress
  let progress = {
    completedLessons: [],
    h5pScores: {},
    overallProgress: 0,
    lastAccessedLesson: null
  };

  if (hasUserSession) {
    const dbProgress = await contentDB.getUserCourseProgress(user.uid, course.id);
    if (dbProgress) {
      progress = dbProgress;
    }
  }

  // Compile all lessons flat list
  const allLessons = [];
  course.modules.forEach(m => {
    if (m.lessons) {
      m.lessons.forEach(l => {
        allLessons.push({ ...l, moduleId: m.id });
      });
    }
  });

  const totalLessons = allLessons.length;

  function updateProgressBar() {
    const completedCount = progress.completedLessons?.length || 0;
    const percentage = totalLessons > 0 ? Math.min(100, Math.round((completedCount / totalLessons) * 100)) : 100;

    const percentageLabel = document.getElementById('course-progress-percentage-label');
    const indicator = document.getElementById('course-progress-bar-indicator');

    if (percentageLabel) percentageLabel.textContent = `${percentage}% Complete (${completedCount} of ${totalLessons} lessons)`;
    if (indicator) indicator.style.width = `${percentage}%`;
  }

  updateProgressBar();

  // Render Syllabus
  renderSyllabusList();

  // Select Initial Lesson
  let activeLesson = allLessons[0];
  if (resumeParam) {
    activeLesson = allLessons.find(l => l.id === resumeParam) || allLessons[0];
  } else if (progress.lastAccessedLesson) {
    const lastIncomplete = allLessons.find(l => !progress.completedLessons.includes(l.id));
    if (lastIncomplete) {
      activeLesson = lastIncomplete;
    } else {
      activeLesson = allLessons.find(l => l.id === progress.lastAccessedLesson) || allLessons[0];
    }
  }

  if (activeLesson) {
    loadActiveLesson(activeLesson);
  }

  function renderSyllabusList() {
    const container = document.getElementById('syllabus-modules-list');
    if (!container) return;

    container.innerHTML = course.modules.map((mod, modIdx) => {
      const lessons = mod.lessons || [];
      const lessonsHtml = lessons.map(lesson => {
        const isCompleted = progress.completedLessons?.includes(lesson.id);
        const isPrereqLocked = isLessonPrereqLocked(lesson);
        const isRoleGated = roleWeights[currentRole] < roleWeights[lesson.requiredRole];

        let icon = '📖';
        if (lesson.contentType === 'h5p') icon = '🧩';
        if (lesson.contentType === 'video') icon = '🎥';

        let statusMarker = '';
        if (isCompleted) {
          statusMarker = '<span style="color: #38a169; font-weight: bold; margin-left: auto;">✓</span>';
        } else if (isRoleGated || isPrereqLocked) {
          statusMarker = '<span style="color: #a0aec0; margin-left: auto;">🔒</span>';
        }

        const isActive = activeLesson && activeLesson.id === lesson.id;
        const bgStyle = isActive ? 'background: #ebf8ff; color: #2b6cb0;' : 'background: transparent; color: var(--theme-color-text-primary, #2d3748);';

        return `
          <button class="syllabus-lesson-row" data-lesson-id="${lesson.id}" style="width: 100%; display: flex; align-items: center; gap: 0.5rem; padding: 8px 10px; border: none; border-radius: 6px; cursor: pointer; text-align: left; font-size: 0.85rem; font-weight: 600; transition: all 0.2s; ${bgStyle}">
            <span>${icon}</span>
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px;">${lesson.title}</span>
            ${statusMarker}
          </button>
        `;
      }).join('');

      return `
        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
          <h4 style="margin: 0; font-size: 0.88rem; font-weight: 800; color: var(--theme-color-text-secondary, #4a5568); text-transform: uppercase; letter-spacing: 0.5px;">Mod ${modIdx + 1}: ${mod.title}</h4>
          <div style="display: flex; flex-direction: column; gap: 2px;">
            ${lessons.length === 0 ? '<span style="font-size: 0.8rem; font-style: italic; color: #cbd5e0; padding-left: 10px;">No lessons</span>' : lessonsHtml}
          </div>
        </div>
      `;
    }).join('');

    // Attach row clicks
    container.querySelectorAll('.syllabus-lesson-row').forEach(row => {
      row.onclick = () => {
        const lessonId = row.dataset.lessonId;
        const target = allLessons.find(l => l.id === lessonId);
        if (target) {
          activeLesson = target;
          loadActiveLesson(target);
          renderSyllabusList(); // Refresh active highlight
        }
      };
    });
  }

  function isLessonPrereqLocked(lesson) {
    if (!lesson.prerequisiteLessonId) return false;
    return !progress.completedLessons?.includes(lesson.prerequisiteLessonId);
  }

  async function loadActiveLesson(lesson) {
    const pane = document.getElementById('lesson-content-pane');
    if (!pane) return;

    // 1. Role Gate Check
    const isRoleGated = roleWeights[currentRole] < roleWeights[lesson.requiredRole];
    if (isRoleGated) {
      pane.innerHTML = `
        <div style="text-align: center; padding: 3rem 1.5rem; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: 8px; background: var(--theme-color-surface, #ffffff);">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">🔒</div>
          <h3 style="margin-top: 0; color: var(--theme-color-text-primary, #1a202c);">Lesson Content Locked</h3>
          <p style="color: var(--theme-color-text-secondary, #718096); font-size: 0.95rem; line-height: 1.5; max-width: 450px; margin: 0 auto 1.5rem;">
            This lesson is restricted to active <strong>${lesson.requiredRole.toUpperCase()}</strong> users. Upgrade your membership tier to immediately unlock this content pathway.
          </p>
          <div style="display: flex; gap: 1rem; justify-content: center;">
            <button id="btn-upgrade-lesson-gate" class="btn-primary" style="padding: 10px 24px; font-weight: bold; background: #38a169;">Upgrade Plan ($29/mo)</button>
            <button id="btn-login-lesson-gate" class="btn-secondary" style="padding: 10px 24px; border: 1px solid #cbd5e0; background: white; cursor: pointer; border-radius: 6px; font-weight: bold;">Sign In</button>
          </div>
        </div>
      `;

      document.getElementById('btn-upgrade-lesson-gate')?.addEventListener('click', () => {
        initiateStripeCheckout();
      });

      document.getElementById('btn-login-lesson-gate')?.addEventListener('click', async () => {
        try {
          await authManager.loginWithGoogle();
          window.location.reload();
        } catch (e) {}
      });
      return;
    }

    // 2. Prerequisite Check
    const isPrereqLocked = isLessonPrereqLocked(lesson);
    if (isPrereqLocked) {
      const prereqTitle = allLessons.find(l => l.id === lesson.prerequisiteLessonId)?.title || lesson.prerequisiteLessonId;
      pane.innerHTML = `
        <div style="text-align: center; padding: 3rem 1.5rem; border: 1px solid var(--theme-color-border, #cbd5e0); border-radius: 8px; background: var(--theme-color-surface, #ffffff);">
          <div style="font-size: 3rem; margin-bottom: 0.5rem;">🔒</div>
          <h3 style="margin-top: 0; color: var(--theme-color-text-primary, #1a202c);">Prerequisite Lesson Incomplete</h3>
          <p style="color: var(--theme-color-text-secondary, #718096); font-size: 0.95rem; line-height: 1.5; max-width: 450px; margin: 0 auto;">
            Please complete the prerequisite lesson <strong>"${prereqTitle}"</strong> first to unlock this next module node.
          </p>
        </div>
      `;
      return;
    }

    // Unlocked! Update last accessed state
    if (hasUserSession) {
      progress.lastAccessedLesson = lesson.id;
      await contentDB.saveUserCourseProgress(user.uid, course.id, progress);
    }

    // 3. Render Lesson Content
    let contentHtml = `
      <h3 style="margin-top: 0; font-size: 1.5rem; font-weight: 800; color: var(--theme-color-text-primary, #1a202c); line-height: 1.2; margin-bottom: 0.5rem;">
        ${lesson.title}
      </h3>
      <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 1.5rem; font-size: 0.8rem; color: #718096;">
        <span style="background: #edf2f7; padding: 2px 6px; border-radius: 4px; font-weight: bold; text-transform: uppercase;">${lesson.contentType}</span>
        <span>•</span>
        <span>Role required: <strong style="text-transform: capitalize;">${lesson.requiredRole}</strong></span>
      </div>
    `;

    if (lesson.contentType === 'rich-text') {
      const bodyText = lesson.body || '';
      const paragraphs = bodyText.split('\n').filter(p => p.trim());
      const bodyHtml = paragraphs.map(p => `<p style="line-height: 1.75; margin-bottom: 1.25rem; font-size: 1.05rem; color: #2d3748;">${p}</p>`).join('');
      contentHtml += `
        <div class="lesson-body-content" style="margin-bottom: 2rem;">
          ${bodyHtml || '<p style="font-style:italic; color:#cbd5e0;">No lesson body written yet.</p>'}
        </div>
      `;
    } else if (lesson.contentType === 'grapesjs') {
      contentHtml += `
        <style>${lesson.compiledCss || ''}</style>
        <div class="grapesjs-content" style="background: #ffffff; border-radius: 8px; overflow: hidden; margin-bottom: 2rem; line-height: 1.75;">
          ${lesson.compiledHtml || '<p style="font-style:italic; color:#cbd5e0;">No visual layout created yet.</p>'}
        </div>
      `;
    } else if (lesson.contentType === 'video') {
      contentHtml += `
        <div style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.08); margin-bottom: 2rem; background: black;">
          <iframe src="${lesson.videoUrl || 'https://www.youtube.com/embed/dQw4w9WgXcQ'}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allowfullscreen></iframe>
        </div>
      `;
    } else if (lesson.contentType === 'h5p') {
      const passingScore = lesson.passingScore || 80;
      contentHtml += `
        <div style="background: #f7fafc; padding: 10px; border-radius: 6px; border: 1px solid #e2e8f0; margin-bottom: 1rem; font-size: 0.8rem; font-weight: bold; color: #4a5568;">
          🎯 Quiz Requirement: Achieve at least ${passingScore}% score to pass this lesson.
        </div>
        <div id="h5p-player-mount-node" style="margin-bottom: 2rem; min-height: 480px; width: 100%;"></div>
      `;
    }

    // Add mark complete or next buttons
    const isCompleted = progress.completedLessons?.includes(lesson.id);
    if (lesson.contentType !== 'h5p') {
      if (isCompleted) {
        contentHtml += `
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 1rem; display: flex; align-items: center; gap: 0.5rem; color: #166534; font-size: 0.95rem; font-weight: bold; justify-content: center; margin-top: 1.5rem;">
            ✓ Lesson Completed Successfully
          </div>
        `;
      } else if (hasUserSession) {
        contentHtml += `
          <div style="border-top: 1px solid var(--theme-color-border, #e2e8f0); padding-top: 1.5rem; margin-top: 2rem;">
            <button id="btn-mark-lesson-complete" class="btn-primary" style="padding: 10px 24px; font-weight: bold; border-radius: 6px; background: var(--theme-color-accent, #38a169);">
              Mark Lesson Complete
            </button>
          </div>
        `;
      }
    } else {
      // H5P Quiz results review banner
      const quizRec = progress.h5pScores?.[lesson.id];
      if (quizRec) {
        const isPassed = quizRec.percentage >= (lesson.passingScore || 80);
        contentHtml += `
          <div style="background: ${isPassed ? '#f0fdf4' : '#fff5f5'}; border: 1px solid ${isPassed ? '#bbf7d0' : '#fed7d7'}; border-radius: 8px; padding: 1rem; color: ${isPassed ? '#166534' : '#c53030'}; font-size: 0.95rem; margin-top: 1.5rem;">
            <strong>Quiz ${isPassed ? 'Passed' : 'Failed'} Summary:</strong> Score: ${quizRec.score} / ${quizRec.maxScore} (${quizRec.percentage}%). Passed: ${isPassed ? 'Yes' : 'No (Requires ' + (lesson.passingScore || 80) + '%)'}.
          </div>
        `;
      }
    }

    pane.innerHTML = contentHtml;

    // Attach mark complete event
    document.getElementById('btn-mark-lesson-complete')?.addEventListener('click', async () => {
      await markActiveLessonCompleted(lesson.id);
    });

    // Launch H5P Player if h5p
    if (lesson.contentType === 'h5p') {
      try {
        const { renderH5PContent } = await import('../../utils/h5pPlayer.js');
        await renderH5PContent(
          document.getElementById('h5p-player-mount-node'),
          lesson.h5pPath || '/assets/h5p/course-1/lesson-1/',
          async (quizPayload) => {
            const isPassed = quizPayload.percentage >= (lesson.passingScore || 80);

            // Save quiz scores in progress object
            progress.h5pScores = progress.h5pScores || {};
            progress.h5pScores[lesson.id] = {
              score: quizPayload.score,
              maxScore: quizPayload.maxScore,
              percentage: quizPayload.percentage,
              completedAt: new Date().toISOString()
            };

            if (isPassed) {
              await markActiveLessonCompleted(lesson.id);
            } else {
              if (hasUserSession) {
                await contentDB.saveUserCourseProgress(user.uid, course.id, progress);
              }
              toast.warning(`Quiz score of ${quizPayload.percentage}% did not meet the passing threshold of ${lesson.passingScore || 80}%. Try again!`);
              loadActiveLesson(lesson); // Reload to show score banner
            }
          }
        );
      } catch (err) {
        console.warn('Failed to load H5P player:', err);
      }
    }
  }

  async function markActiveLessonCompleted(lessonId) {
    if (!hasUserSession) {
      toast.warning('Please log in to track and save your learning progress.');
      return;
    }

    if (!progress.completedLessons.includes(lessonId)) {
      progress.completedLessons.push(lessonId);
    }

    progress.overallProgress = Math.min(100, Math.round((progress.completedLessons.length / totalLessons) * 100));
    await contentDB.saveUserCourseProgress(user.uid, course.id, progress);

    toast.success('Awesome work! Lesson completed successfully.');

    // Instant check on course completion!
    if (progress.overallProgress === 100) {
      toast.success('🏆 Congratulations! You have fully completed the entire course track! Download your completion badge in your Account Portal.');
    }

    // Refresh state
    updateProgressBar();
    renderSyllabusList();

    const currentLessonObj = allLessons.find(l => l.id === lessonId);
    if (currentLessonObj) {
      loadActiveLesson(currentLessonObj);
    }
  }
}

// Redirects to standard pricing checkout session with ref tracking
async function initiateStripeCheckout() {
  const refCode = sessionStorage.getItem('foundation_ref_id') || '';
  toast.info('Directing to payment gateways via Stripe Checkout...');

  try {
    const response = await fetch('/api/stripe-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'member',
        action: 'checkout',
        ...(refCode && { affiliateId: refCode })
      })
    });
    const data = await response.json();
    if (data?.url) {
      window.location.href = data.url;
    } else {
      errorHandler.handleError(new Error('No checkout URL returned'), 'Course paywall checkout failed');

      // Local fallback simulator trigger
      const updatedUser = {
        ...store.state.user,
        role: 'member',
        paymentStatus: 'Active',
        ...(refCode && { referrerId: refCode })
      };
      await contentDB.saveUser(updatedUser);
      store.dispatch('SET_USER', updatedUser);
      toast.success('Mock Checkout Complete! Persona upgraded to Member.');
      setTimeout(() => window.location.reload(), 1000);
    }
  } catch (err) {
    errorHandler.handleError(err, 'Course Gated Upgrade - Stripe Checkout');
    alert(`Checkout error: ${err.message}`);
  }
}
