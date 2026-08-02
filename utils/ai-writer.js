// utils/ai-writer.js - Autonomous AI Content & Marketing Material Writer
export function draftAIContent(contentType, topic) {
  const dateStr = new Date().toLocaleDateString();

  if (contentType === 'blog') {
    return {
      title: `The Future of Autonomous Operations: ${topic}`,
      description: `Exploring how autonomous agents like Gemini Spark are changing the game for ${topic}.`,
      body: `Written autonomously on ${dateStr}.\n\nIn today's fast-paced environment, automating background processes is no longer optional. Incorporating specialized AI models into your daily operations ensures security, efficiency, and scale.\n\nBy leveraging tools such as Google Gemini, businesses can easily monitor physical inventory, draft VA payrolls, and review system compliance logs autonomously.`
    };
  }

  if (contentType === 'website_copy') {
    return {
      title: `${topic} - Scaled & Unlocked`,
      headline: `Accelerate Your Brand with ${topic}`,
      body: `Welcome to our platform. We integrate zero-build technologies with state-of-the-art AI automation to deliver unprecedented performance and reliability.`
    };
  }

  if (contentType === 'marketing_flyer') {
    return {
      title: `Flyer: Join the ${topic} Revolution!`,
      headline: `Unleash Your Operations 24/7`,
      promoCode: "SPARK_EE01",
      body: `Get ready to streamline your workflows. Enjoy automated compliance, intelligent financial drafting, and smart inventory alerts right at your fingertips.`
    };
  }

  return {
    title: `Drafted: ${topic}`,
    body: `This is an autonomously prepared draft for topic: ${topic}.`
  };
}
