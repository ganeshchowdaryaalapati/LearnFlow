/**
 * ChatGPT & Text Roadmap Parser
 * Converts plain text, markdown lists, or ChatGPT outputs into structured Course objects
 */

export function parseChatGPTRoadmap(rawText, title = '', category = 'General') {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  
  let courseTitle = title || 'Custom Learning Roadmap';
  let courseDescription = 'Imported from ChatGPT / Notes';
  const sections = [];
  
  let currentSection = {
    id: 'sec-' + Date.now() + '-0',
    title: 'Module 1: General Topics',
    topics: []
  };

  let sectionCounter = 1;
  let topicCounter = 1;

  lines.forEach((line) => {
    // Check if line is a course title (# Title)
    if (line.startsWith('# ') && !title) {
      courseTitle = line.replace(/^#\s+/, '').trim();
      return;
    }

    // Check if line is a Section / Module header (## Module, ### Section, Section 1:, etc.)
    if (line.startsWith('##') || line.startsWith('###') || /^(Module|Section|Week|Phase|Day|Part)\s+\d+/i.test(line)) {
      if (currentSection.topics.length > 0) {
        sections.push(currentSection);
      }
      sectionCounter++;
      const cleanTitle = line.replace(/^[#\-\*]+\s*/, '').trim();
      currentSection = {
        id: `sec-${Date.now()}-${sectionCounter}`,
        title: cleanTitle,
        topics: []
      };
      return;
    }

    // Check if line is a bullet item or numbered topic
    if (/^[\-\*\+]\s+/.test(line) || /^\d+[\.\)]\s+/.test(line) || line.startsWith('- [ ]') || line.startsWith('- [x]')) {
      let topicText = line
        .replace(/^[\-\*\+]\s+/, '')
        .replace(/^\d+[\.\)]\s+/, '')
        .replace(/^-\s*\[[ xX]\]\s*/, '')
        .trim();

      // Extract hours if present e.g. "(1 hr)", "[2 hours]", "1h", "(1.5 hours)"
      let hours = 1; // default 1 hour
      const hourMatch = topicText.match(/[\(\[\{]?(\d+(?:\.\d+)?)\s*(?:hrs?|hours?|h)[\)\]\}]?/i);
      if (hourMatch) {
        hours = parseFloat(hourMatch[1]) || 1;
        // remove hours tag from title clean display
        topicText = topicText.replace(/[\(\[\{]?\d+(?:\.\d+)?\s*(?:hrs?|hours?|h)[\)\]\}]?/gi, '').trim();
      }

      // Determine initial completion state if markdown checkmark present
      const isCompleted = line.includes('[x]') || line.includes('[X]');

      if (topicText.length > 0) {
        topicCounter++;
        currentSection.topics.push({
          id: `top-${Date.now()}-${topicCounter}`,
          title: topicText,
          hours: Math.max(1, Math.round(hours)),
          completed: isCompleted
        });
      }
    }
  });

  // Push final section if it has topics
  if (currentSection.topics.length > 0) {
    sections.push(currentSection);
  }

  // Fallback if no markdown formatting detected
  if (sections.length === 0 && lines.length > 0) {
    const fallbackTopics = lines.map((l, i) => ({
      id: `top-fb-${i}`,
      title: l.replace(/^[#\-\*0-9\.\)\s]+/, '').trim(),
      hours: 1,
      completed: false
    })).filter(t => t.title.length > 0);

    if (fallbackTopics.length > 0) {
      sections.push({
        id: `sec-fb-${Date.now()}`,
        title: 'Module 1: Quick Topics',
        topics: fallbackTopics
      });
    }
  }

  return {
    id: 'course-' + Date.now(),
    title: courseTitle,
    description: courseDescription,
    category: category,
    createdAt: new Date().toISOString(),
    sections: sections
  };
}
