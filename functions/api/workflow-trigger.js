// functions/api/workflow-trigger.js

export async function onRequestPost(context) {
  try {
    const payload = await context.request.json();

    // Trigger Cloudflare Workflow Instance
    // (Requires binding `MY_WORKFLOW` in wrangler.json / Cloudflare Dashboard)
    const instance = await context.env.MY_WORKFLOW.create({
      id: `task-${Date.now()}`,
      params: payload
    });

    return new Response(JSON.stringify({
      success: true,
      workflowId: instance.id,
      status: "Workflow instance queued successfully"
    }), {
      headers: { "Content-Type": "application/json" },
      status: 202
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}