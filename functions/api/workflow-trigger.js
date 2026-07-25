// functions/api/workflow-trigger.js
export async function onRequestPost(context) {
  try {
    const payload = await context.request.json();

    // Verify Cloudflare Workflows binding exists
    if (!context.env.MY_WORKFLOW) {
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}