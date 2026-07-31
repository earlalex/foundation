// core/marketingEngine.js
// Mautic + Dittofeed Integrated Marketing Automation Engine

import { contentDB } from './db.js';
import { sendGmailNotification } from './google-services.js';
import { toast } from '../utils/toast.js';
import { configManager } from './config.js';

class MarketingEngine {
  /**
   * Dittofeed Model: Real-time segment evaluator matching users by event triggers and traits/properties
   * @param {Object} user
   * @param {Object} segment
   * @returns {boolean} True if user matches segment rules
   */
  evaluateSegment(user, segment) {
    if (!segment || !segment.rules || !Array.isArray(segment.rules)) return false;

    // If rules are empty, match all by default or none
    if (segment.rules.length === 0) return true;

    return segment.rules.every(rule => {
      const { field, name, operator, value } = rule;

      // Rule category 1: User Trait / Property comparison
      if (field === 'trait') {
        const userValue = user[name];
        if (userValue === undefined || userValue === null) return false;

        switch (operator) {
          case 'equals':
            return String(userValue).toLowerCase() === String(value).toLowerCase();
          case 'not_equals':
            return String(userValue).toLowerCase() !== String(value).toLowerCase();
          case 'contains':
            return String(userValue).toLowerCase().includes(String(value).toLowerCase());
          case 'greater_than':
            return Number(userValue) > Number(value);
          case 'less_than':
            return Number(userValue) < Number(value);
          default:
            return false;
        }
      }

      // Rule category 2: Event trigger checks
      if (field === 'event') {
        // Events are represented by users' event history arrays or flags
        const events = user.eventHistory || [];
        const hasTriggered = events.some(e => e.name === name || e === name);

        switch (operator) {
          case 'has_triggered':
            return hasTriggered;
          case 'has_not_triggered':
            return !hasTriggered;
          default:
            return false;
        }
      }

      return false;
    });
  }

  /**
   * Mautic Model: Calculate lead score based on activities and transition contact lifecycle stage
   * @param {Object} user
   * @param {Array} activityLogs - Array of activity objects
   * @returns {Promise<Object>} The updated user profile with score and updated lifecycle stage
   */
  async calculateLeadScore(user, activityLogs = []) {
    let score = user.leadScore || 0;

    // Base scoring rules
    // +10 for registering
    if (user.role && user.role !== 'prospect' && !user.scoredRegister) {
      score += 10;
      user.scoredRegister = true;
    }

    // Evaluate dynamic activity logs
    activityLogs.forEach(log => {
      if (log.scored) return; // avoid double scoring

      switch (log.type) {
        case 'page_view':
          score += 5;
          break;
        case 'event_attendance':
          score += 25;
          break;
        case 'course_read':
          score += 20;
          break;
        case 'form_submission':
          score += 15;
          break;
        case 'inactivity_day':
          score -= 1;
          break;
        default:
          break;
      }
      log.scored = true;
    });

    // Score capping/min guard
    if (score < 0) score = 0;
    user.leadScore = score;

    // Automatic Contact Lifecycle transitions based on score threshold
    let previousRole = user.role || 'prospect';
    let newRole = previousRole;

    if (score >= 80) {
      newRole = 'affiliate';
    } else if (score >= 50) {
      newRole = 'member';
    } else if (score >= 30) {
      newRole = 'subscriber'; // SQL equivalent
    } else if (score >= 10) {
      newRole = 'subscriber';
    } else {
      newRole = 'prospect';
    }

    if (newRole !== previousRole) {
      user.role = newRole;
      user.lifecycleTransitioned = true;
      user.lifecycleTransitionedAt = new Date().toISOString();
      toast.info(`Contact ${user.email} escalated to lifecycle stage: ${newRole.toUpperCase()} (Score: ${score})`);
    }

    await contentDB.saveUser(user);
    return user;
  }

  /**
   * visual Visual Omni-Channel Journey Builder: Runs a journey node-by-node for a targeted user
   * @param {Object} journey
   * @param {Object} user
   * @param {Object} [eventPayload]
   */
  async executeJourneyForUser(journey, user, eventPayload = {}) {
    if (!journey || !journey.active) return;

    console.log(`[Journey Engine]: Executing journey "${journey.name}" for user ${user.email}`);

    const nodes = journey.nodes || [];
    let currentNodeId = journey.trigger?.id;

    // Simple visual path executor
    while (currentNodeId) {
      let node = nodes.find(n => n.id === currentNodeId);
      if (!node) {
        // Check trigger node itself
        if (journey.trigger?.id === currentNodeId) {
          node = journey.trigger;
        } else {
          break;
        }
      }

      currentNodeId = await this.executeNode(node, user, eventPayload, nodes);
    }
  }

  /**
   * Execute single node and determine next node ID
   */
  async executeNode(node, user, eventPayload, allNodes) {
    if (!node) return null;

    console.log(`[Journey Node]: Executing node ${node.id} (${node.type})`);

    const config = node.config || {};

    try {
      switch (node.type) {
        case 'SEND_GMAIL_TEMPLATE': {
          const bodyWithTags = this.interpolateMergeTags(config.body || '', user, eventPayload);
          const subject = config.subject || 'Campaign Notification';

          await sendGmailNotification({
            toEmail: user.email,
            subject: subject,
            messageBody: bodyWithTags
          }).catch(e => {
            console.warn('[Journey Engine]: Gmail OAuth offline. Mocking mail delivery.', e.message);
          });
          break;
        }

        case 'SEND_TRANSACTIONAL_EMAIL': {
          // Transactional bypasses opt-outs
          const bodyWithTags = this.interpolateMergeTags(config.body || '', user, eventPayload);
          await sendGmailNotification({
            toEmail: user.email,
            subject: config.subject || 'System Notification',
            messageBody: bodyWithTags
          });
          break;
        }

        case 'WAIT_DELAY': {
          let waitTimeMinutes = parseInt(config.delayValue, 10) || 1;
          const unit = config.delayUnit || 'Minutes';

          if (unit === 'Hours') waitTimeMinutes *= 60;
          if (unit === 'Days') waitTimeMinutes *= 60 * 24;

          console.log(`[Journey Node]: Delaying workflow execution for ${waitTimeMinutes} minutes...`);
          // Real-time execution uses setTimeout, while in tests we can bypass or wait
          if (typeof window !== 'undefined' && window.location.search.includes('runTests=true')) {
            // Bypass delays in tests for speed
          } else {
            await new Promise(resolve => setTimeout(resolve, waitTimeMinutes * 10)); // simulated short delay
          }
          break;
        }

        case 'UPDATE_USER_ROLE': {
          if (config.role) {
            user.role = config.role;
            await contentDB.saveUser(user);
          }
          break;
        }

        case 'TRIGGER_WEBHOOK': {
          // Webhooks: POST HTTP payload with dynamic merge tags
          const webhookUrl = config.webhookUrl;
          if (webhookUrl) {
            const rawPayload = config.payload || '{"email": "{{user.email}}"}';
            const interpolatedPayload = this.interpolateMergeTags(rawPayload, user, eventPayload);
            await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: interpolatedPayload
            }).catch(e => console.warn('[Journey Webhook]: POST trigger failed.', e.message));
          }
          break;
        }

        case 'SEND_TWILIO_SMS': {
          // SMS webhook Twilio integration
          const twilioConfig = configManager.current.chatbot || {};
          const accountSid = twilioConfig.twilioAccountSid;
          const authToken = twilioConfig.twilioAuthToken;
          const fromNumber = twilioConfig.twilioPhoneNumber;
          const toNumber = user.phone || config.toNumber;

          const textBody = this.interpolateMergeTags(config.smsBody || 'Hi {{user.name}}', user, eventPayload);

          if (accountSid && authToken && fromNumber && toNumber) {
            const authStr = btoa(`${accountSid}:${authToken}`);
            await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
              method: 'POST',
              headers: {
                'Authorization': `Basic ${authStr}`,
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: new URLSearchParams({
                From: fromNumber,
                To: toNumber,
                Body: textBody
              })
            }).catch(e => console.warn('[Journey twilio SMS]: Failed to post message.', e.message));
          } else {
            console.log(`[Twilio Mock]: SMS sent to ${toNumber || 'user'}: "${textBody}"`);
          }
          break;
        }

        case 'AB_SPLIT_TEST': {
          // A/B testing node distributes paths 50/50
          const rand = Math.random();
          if (rand < 0.5) {
            return config.pathA_nodeId || null;
          } else {
            return config.pathB_nodeId || null;
          }
        }

        case 'DECISION_BRANCH': {
          // Conditional branch check: e.g. 'Has Opened Email?', 'Has Purchased Item?', 'Is Member Tier?'
          const criteria = config.conditionType || 'is_member';
          let matched = false;

          if (criteria === 'is_member') {
            matched = user.role === 'member' || user.role === 'affiliate';
          } else if (criteria === 'has_purchased') {
            const purchases = await contentDB.getUserPurchases(user.email);
            matched = purchases && purchases.length > 0;
          } else if (criteria === 'custom_trait') {
            matched = String(user[config.traitName]).toLowerCase() === String(config.traitValue).toLowerCase();
          }

          if (matched) {
            return config.yesNodeId || null;
          } else {
            return config.noNodeId || null;
          }
        }

        default:
          break;
      }
    } catch (err) {
      console.error(`[Journey Node Error] failed executing ${node.id}:`, err);
    }

    // Determine default next node sequentially
    const currentIndex = allNodes.findIndex(n => n.id === node.id);
    if (currentIndex !== -1 && currentIndex < allNodes.length - 1) {
      return allNodes[currentIndex + 1].id;
    }

    return null;
  }

  /**
   * Helper to replace merge tags with actual user/event values
   */
  interpolateMergeTags(text, user, eventPayload) {
    let result = text;
    result = result.replace(/\{\{user\.name\}\}/g, user.name || user.displayName || 'Customer');
    result = result.replace(/\{\{user\.email\}\}/g, user.email || '');
    result = result.replace(/\{\{user\.phone\}\}/g, user.phone || '');
    result = result.replace(/\{\{event\.product\}\}/g, eventPayload.productTitle || eventPayload.product || '');
    result = result.replace(/\{\{event\.amount\}\}/g, eventPayload.amount || '');
    return result;
  }

  /**
   * One-Off Broadcast Publisher
   */
  async sendBroadcast(segmentId, templateHtml, subject = "Broadcast Update") {
    const users = await contentDB.evaluateSegmentUsers(segmentId);
    console.log(`[Broadcast]: Preparing newsletter dispatch for ${users.length} segment contacts.`);

    for (const u of users) {
      const parsedBody = this.interpolateMergeTags(templateHtml, u, {});
      await sendGmailNotification({
        toEmail: u.email,
        subject: subject,
        messageBody: parsedBody
      }).catch(() => {});
    }

    toast.success(`Newsletter successfully broadcasted to ${users.length} segment users!`);
    return users.length;
  }
}

export const marketingEngine = new MarketingEngine();
