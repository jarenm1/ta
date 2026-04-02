import { htmlToText } from './canvas-client.mjs';

const QUIZ_QUESTION_TYPES = ['multiple_choice', 'short_answer'];
const ITEM_TYPE_OPTIONS = ['module', 'page', 'assignment', 'announcement', 'discussion', 'uploaded_material'];

function toIsoDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

function uniqueBy(items, getKey) {
  const seen = new Set();

  return items.filter((item) => {
    const key = getKey(item);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function rotateArray(items, offset) {
  if (items.length === 0) {
    return [];
  }

  const normalizedOffset = ((offset % items.length) + items.length) % items.length;
  return items.slice(normalizedOffset).concat(items.slice(0, normalizedOffset));
}

function buildConcepts(snapshot) {
  const concepts = [];

  for (const module of snapshot.modules || []) {
    concepts.push({
      source_type: 'module',
      source_id: module.id,
      title: module.name,
      summary: htmlToText(module.description || ''),
    });
  }

  for (const page of snapshot.pages || []) {
    concepts.push({
      source_type: 'page',
      source_id: page.page_id ?? page.url,
      title: page.title,
      summary: htmlToText(page.body || page.text_content || ''),
    });
  }

  for (const assignment of snapshot.assignments || []) {
    concepts.push({
      source_type: 'assignment',
      source_id: assignment.id,
      title: assignment.name,
      summary: htmlToText(assignment.description || ''),
      due_at: assignment.due_at || null,
    });
  }

  for (const announcement of snapshot.announcements || []) {
    concepts.push({
      source_type: 'announcement',
      source_id: announcement.id,
      title: announcement.title,
      summary: htmlToText(announcement.message || announcement.text_content || ''),
    });
  }

  for (const discussion of snapshot.discussions || []) {
    concepts.push({
      source_type: 'discussion',
      source_id: discussion.id,
      title: discussion.title,
      summary: htmlToText(discussion.message || discussion.text_content || ''),
    });
  }

  for (const material of snapshot.uploaded_materials || []) {
    concepts.push({
      source_type: 'uploaded_material',
      source_id: material.id,
      title: material.displayName,
      summary: htmlToText(material.text_content || material.textExcerpt || ''),
    });
  }

  return uniqueBy(
    concepts
      .map((concept) => ({
        ...concept,
        title: String(concept.title || '').trim(),
        summary: String(concept.summary || '').replace(/\s+/g, ' ').trim(),
      }))
      .filter((concept) => concept.title.length > 0),
    (concept) => `${concept.source_type}:${concept.source_id}:${concept.title.toLowerCase()}`,
  );
}

function truncateText(value, maxLength = 220) {
  if (!value) {
    return '';
  }

  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength).trimEnd()}…`;
}

function buildTitleDistractors(concepts, correctConcept, count, offset) {
  const distractors = rotateArray(
    concepts.filter((concept) => concept.title !== correctConcept.title),
    offset,
  )
    .map((concept) => concept.title)
    .filter((title) => title !== correctConcept.title);

  return uniqueBy(distractors, (value) => value).slice(0, Math.max(0, count));
}

function buildAnswerOptions(questionId, options) {
  return options.map((text, index) => ({
    id: `${questionId}_a${index + 1}`,
    text,
  }));
}

function buildMultipleChoiceQuestion(concepts, concept, questionIndex, answerCount) {
  const questionId = `q${questionIndex + 1}`;
  const correctTitle = concept.title;
  const distractors = buildTitleDistractors(concepts, concept, answerCount - 1, questionIndex + 1);
  const optionTexts = rotateArray([correctTitle, ...distractors], questionIndex % answerCount).slice(0, answerCount);
  const answer_options = buildAnswerOptions(questionId, optionTexts);
  const correctOption = answer_options.find((option) => option.text === correctTitle) ?? answer_options[0];
  const summary = truncateText(concept.summary, 240);

  return {
    id: questionId,
    type: 'multiple_choice',
    prompt: summary
      ? `Which course item best matches this description? ${summary}`
      : `Which of these course items appears in the course content as a ${concept.source_type}?`,
    answer_options,
    correct_answer: {
      answer_option_ids: [correctOption.id],
      text: correctTitle,
    },
    explanation: summary
      ? `This description comes from the ${concept.source_type} titled "${correctTitle}".`
      : `"${correctTitle}" is a ${concept.source_type} in this course.`,
    source_refs: [
      {
        source_type: concept.source_type,
        source_id: concept.source_id,
        title: correctTitle,
        due_at: toIsoDate(concept.due_at),
      },
    ],
  };
}

function buildShortAnswerQuestion(concept, questionIndex) {
  const questionId = `q${questionIndex + 1}`;
  const summary = truncateText(concept.summary, 260);

  return {
    id: questionId,
    type: 'short_answer',
    prompt: summary
      ? `Name the course item that matches this description: ${summary}`
      : `What is the title of the ${concept.source_type} referenced here?`,
    answer_options: [],
    correct_answer: {
      answer_option_ids: [],
      text: concept.title,
      acceptable_answers: [concept.title],
    },
    explanation: `The expected answer is the ${concept.source_type} titled "${concept.title}".`,
    source_refs: [
      {
        source_type: concept.source_type,
        source_id: concept.source_id,
        title: concept.title,
        due_at: toIsoDate(concept.due_at),
      },
    ],
  };
}

function buildTypeQuestion(concept, questionIndex) {
  const questionId = `q${questionIndex + 1}`;
  const correctType = concept.source_type;
  const options = rotateArray(
    uniqueBy([correctType, ...ITEM_TYPE_OPTIONS.filter((type) => type !== correctType)], (value) => value),
    questionIndex,
  ).slice(0, 4);
  const answer_options = buildAnswerOptions(questionId, options);
  const correctOption = answer_options.find((option) => option.text === correctType) ?? answer_options[0];

  return {
    id: questionId,
    type: 'multiple_choice',
    prompt: `What kind of course item is "${concept.title}"?`,
    answer_options,
    correct_answer: {
      answer_option_ids: [correctOption.id],
      text: correctType,
    },
    explanation: `"${concept.title}" appears in the course as a ${correctType}.`,
    source_refs: [
      {
        source_type: concept.source_type,
        source_id: concept.source_id,
        title: concept.title,
        due_at: toIsoDate(concept.due_at),
      },
    ],
  };
}

function normalizeQuestionTypes(questionTypes) {
  if (!Array.isArray(questionTypes) || questionTypes.length === 0) {
    return ['multiple_choice'];
  }

  return questionTypes.filter((type) => QUIZ_QUESTION_TYPES.includes(type));
}

function buildQuestions(snapshot, request = {}) {
  const concepts = buildConcepts(snapshot);
  const questionCount = Math.max(1, Math.min(Number(request.questionCount) || 8, 25));
  const answerCount = Math.max(2, Math.min(Number(request.answerCount) || 4, 6));
  const questionTypes = normalizeQuestionTypes(request.questionTypes);

  if (concepts.length === 0) {
    return [];
  }

  const questions = [];

  for (let index = 0; index < questionCount; index += 1) {
    const concept = concepts[index % concepts.length];
    const requestedType = questionTypes[index % questionTypes.length] || 'multiple_choice';
    const shouldUseTypeQuestion = !concept.summary && requestedType === 'multiple_choice';

    if (requestedType === 'short_answer' && concept.summary) {
      questions.push(buildShortAnswerQuestion(concept, index));
      continue;
    }

    if (shouldUseTypeQuestion) {
      questions.push(buildTypeQuestion(concept, index));
      continue;
    }

    questions.push(buildMultipleChoiceQuestion(concepts, concept, index, answerCount));
  }

  return questions;
}

function createQuiz(snapshot, request = {}) {
  const title = request.title || `Quiz for ${snapshot.course?.name || 'course'}`;
  const objective = request.objective || 'Check recall of course materials and key concepts.';
  const questionTypes = normalizeQuestionTypes(request.questionTypes);
  const questions = buildQuestions(snapshot, request);

  return {
    generated_at: new Date().toISOString(),
    request: {
      title,
      objective,
      question_count: Math.max(1, Math.min(Number(request.questionCount) || 8, 25)),
      question_types: questionTypes,
      answer_count: Math.max(2, Math.min(Number(request.answerCount) || 4, 6)),
      include_explanations: request.includeExplanations !== false,
    },
    course: {
      id: snapshot.course?.id,
      name: snapshot.course?.name,
      course_code: snapshot.course?.course_code || null,
    },
    questions: request.includeExplanations === false
      ? questions.map(({ explanation, ...question }) => question)
      : questions,
    answer_key: questions.map((question) => ({
      question_id: question.id,
      type: question.type,
      correct_answer: question.correct_answer,
      explanation: question.explanation,
    })),
    source_summary: {
      modules: snapshot.modules?.length || 0,
      assignments: snapshot.assignments?.length || 0,
      pages: snapshot.pages?.length || 0,
      announcements: snapshot.announcements?.length || 0,
      discussions: snapshot.discussions?.length || 0,
      uploaded_materials: snapshot.uploaded_materials?.length || 0,
    },
  };
}

function renderQuizMarkdown(quiz) {
  const lines = [
    `# ${quiz.request.title}`,
    '',
    `**Course:** ${quiz.course.name || 'Unknown course'}`,
    `**Objective:** ${quiz.request.objective}`,
    `**Questions:** ${quiz.questions.length}`,
    '',
  ];

  for (const question of quiz.questions) {
    lines.push(`## ${question.id}. ${question.prompt}`);

    if (question.answer_options.length > 0) {
      for (const option of question.answer_options) {
        lines.push(`- ${option.id}: ${option.text}`);
      }
    } else {
      lines.push('- Short answer');
    }

    lines.push(`- Correct answer: ${question.correct_answer.text}`);

    if (question.explanation) {
      lines.push(`- Explanation: ${question.explanation}`);
    }

    lines.push('');
  }

  return `${lines.join('\n')}\n`;
}

export { QUIZ_QUESTION_TYPES, createQuiz, renderQuizMarkdown };
