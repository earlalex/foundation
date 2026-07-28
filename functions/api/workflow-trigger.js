// functions/api/workflow-trigger.js
export async function onRequestPost(context) {
  try {
    const payload = await context.request.json();

    if (!payload) {
      console.error('[Workflow Trigger]: Invalid or missing payload');
      return new Response(JSON.stringify({ error: 'Invalid or missing payload' }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Handle marketing workflow triggers
    if (payload.type === 'marketing_workflow') {
      return await handleMarketingWorkflowTrigger(payload, context);
    }

    // Verify Cloudflare Workflows binding exists for general workflows
    if (!context.env.MY_WORKFLOW) {
      console.error('[Workflow Trigger]: Cloudflare Workflow binding (MY_WORKFLOW) is missing');
      return new Response(JSON.stringify({
        error: "Cloudflare Workflow binding (MY_WORKFLOW) is missing from wrangler.json / Dashboard."
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Trigger Cloudflare Workflow Instance
    const instance = await context.env.MY_WORKFLOW.create({
      id: `task-${Date.now()}`,
      params: payload
    });

    return new Response(JSON.stringify({
      success: true,
      workflowId: instance.id,
      status: "Cloudflare Workflow queued successfully"
    }), {
      headers: { "Content-Type": "application/json" },
      status: 202
    });
  } catch (err) {
    console.error('[Workflow Trigger]: Unhandled error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

async function handleMarketingWorkflowTrigger(payload, context) {
  try {
    const { triggerType, userData } = payload;
    
    if (!triggerType) {
      console.error('[Marketing Workflow]: Missing triggerType in payload');
      return new Response(JSON.stringify({ error: 'Missing triggerType in payload' }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    if (!userData) {
      console.error('[Marketing Workflow]: Missing userData in payload');
      return new Response(JSON.stringify({ error: 'Missing userData in payload' }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
  
    // Access Firestore through KV binding or direct Firebase access
    // This is a simplified version - in production you'd use proper Firebase initialization
    const workflows = await getMarketingWorkflows(context);
    
    const activeWorkflows = workflows.filter(wf => 
      wf.active && wf.trigger?.type === triggerType
    );
    
    for (const workflow of activeWorkflows) {
      await executeWorkflowNodes(workflow, userData, context);
    }
    
    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${activeWorkflows.length} workflows for trigger: ${triggerType}`
    }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    });
  } catch (err) {
    console.error('[Marketing Workflow]: Unhandled error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

async function getMarketingWorkflows(context) {
  try {
    // In production, this would query Firestore
    // For now, return empty array or use KV binding if available
    if (context.env.MARKETING_WORKFLOWS) {
      const data = await context.env.MARKETING_WORKFLOWS.get('workflows');
      return data ? JSON.parse(data) : [];
    }
    return [];
  } catch (err) {
    console.error('[Marketing Workflow]: Failed to get workflows:', err);
    return [];
  }
}

async function executeWorkflowNodes(workflow, userData, context) {
  try {
    for (const node of workflow.nodes) {
      switch (node.type) {
        case 'SEND_GMAIL_TEMPLATE':
          // Integrate with Gmail API or use existing sendGmailNotification
          console.log(`Sending Gmail template to ${userData.email}`);
          break;
        case 'WAIT_DELAY':
          const delayMs = (node.config.hours || 0) * 60 * 60 * 1000 + 
                         (node.config.days || 0) * 24 * 60 * 60 * 1000;
          if (delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
          break;
        case 'UPDATE_USER_ROLE':
          if (node.config.role) {
            console.log(`Updating user role to ${node.config.role}`);
            // Update user role in Firestore
          }
          break;
        case 'CREATE_GOOGLE_CONTACT_NOTE':
          console.log(`Creating contact note for ${userData.email}`);
          // Integrate with Google Contacts API
          break;
      }
    }
  } catch (err) {
    console.error('[Marketing Workflow]: Failed to execute workflow nodes:', err);
  }
}