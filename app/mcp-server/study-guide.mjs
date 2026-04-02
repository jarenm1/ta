import { collectUpcomingAssignments, htmlToText } from './canvas-client.mjs';

const MAX_EVIDENCE_SNIPPETS_PER_TOPIC = 4;

const TOPIC_BLUEPRINTS = [
  {
    id: 'templating',
    title: 'Templating and Generic Containers',
    keywords: ['template', 'templating', 'generic', 'iterator', 'iterators', 'stl', 'size_t'],
    introduction:
      'Start by understanding what templating buys you in C++: one implementation can work across many data types, but only if those data types support the operations your template expects.',
    example: {
      problem:
        'Write a simple template function that returns the larger of two values and explain one requirement the type must satisfy.',
      answer: [
        '```cpp',
        'template <typename T>',
        'T bigger(T left, T right)',
        '{',
        '   return (left < right) ? right : left;',
        '}',
        '```',
        '',
        'The type `T` must support comparison with `<` for this template to compile and behave correctly.',
      ].join('\n'),
      explanation:
        'This is the core template idea: the compiler generates a version of the function for each type you use, but only if the required operations exist for that type.',
    },
    pitfalls: [
      'Forgetting that a template only works when the provided type supports the needed operations.',
      'Treating iterators like array indexes when the container does not guarantee random access.',
      'Using `size_t` carelessly in subtraction or comparisons that can wrap around.',
    ],
    review_questions: [
      'What is the difference between a template function and a template class?',
      'Why do many C++ template implementations need the implementation visible with the interface?',
      'What are the three major STL components?',
    ],
  },
  {
    id: 'algorithm-analysis',
    title: 'Algorithm Analysis and Big-O',
    keywords: ['big-o', 'big o', 'algorithm analysis', 'complexity', 'asymptotic', 'worst case'],
    introduction:
      'Treat algorithm analysis as a way to reason about growth trends, not exact stopwatch time. You want to identify what dominates as the input gets large.',
    example: {
      problem:
        'Classify the running time of a loop nest where the outer loop runs `n` times and the inner loop also runs `n` times.',
      answer: 'The running time is `O(n^2)`.',
      explanation:
        'There are about `n * n` total basic iterations, so the quadratic term dominates. Constants and lower-order terms do not change the Big-O classification.',
    },
    pitfalls: [
      'Confusing best, average, and worst case.',
      'Over-focusing on constants instead of the dominant growth term.',
      'Calling Big-O an exact runtime rather than an asymptotic upper-bound description.',
    ],
    review_questions: [
      'How do `O(1)`, `O(log n)`, `O(n)`, `O(n log n)`, and `O(n^2)` compare as `n` grows?',
      'What does Big-O capture well, and what does it intentionally ignore?',
      'Why can two `O(n)` algorithms still differ in real runtime?',
    ],
  },
  {
    id: 'linked-lists',
    title: 'Linked Lists',
    keywords: ['linked list', 'node', 'head', 'pointer', 'cursor', 'link'],
    introduction:
      'For linked lists, always think in terms of pointer movement and what links must change before and after an insertion or deletion.',
    example: {
      problem:
        'Given a pointer `cursor` to a node, insert a new node immediately after it in a singly linked list.',
      answer: [
        '```cpp',
        'Node* newNode = new Node;',
        'newNode->data = value;',
        'newNode->link = cursor->link;',
        'cursor->link = newNode;',
        '```',
      ].join('\n'),
      explanation:
        'The safe order matters. Point the new node at the old successor first, then redirect the current node to the new node. That avoids losing the rest of the list.',
    },
    pitfalls: [
      'Dereferencing a null pointer.',
      'Deleting a node before saving what you still need from it.',
      'Losing the head pointer or leaking nodes after updates.',
    ],
    review_questions: [
      'Why are insertions often easier in a linked list than in an array?',
      'When should a head pointer be passed by reference?',
      'What bugs can arise from stale pointers and null-pointer access?',
    ],
  },
  {
    id: 'stacks-queues',
    title: 'Stacks, Queues, and Their Applications',
    keywords: ['stack', 'queue', 'lifo', 'fifo', 'postfix', 'infix', 'palindrome'],
    introduction:
      'Use stacks when the most recent item must come out first and queues when the oldest item must come out first. Most applications flow directly from that rule.',
    example: {
      problem:
        'Which structure fits each job better: undo history or a printer job line?',
      answer: [
        '- Undo history: **stack**',
        '- Printer job line: **queue**',
      ].join('\n'),
      explanation:
        'Undo history is LIFO because the last action should be undone first. A printer job line is FIFO because jobs are normally processed in arrival order.',
    },
    pitfalls: [
      'Mixing up `top` with `front`.',
      'Forgetting that stack pop or queue pop often needs a separate read before removal.',
      'Losing track of operator order when evaluating postfix expressions.',
    ],
    review_questions: [
      'What are the STL-style operations for a stack?',
      'What are the STL-style operations for a queue?',
      'Why does infix-to-postfix conversion naturally use a stack?',
    ],
  },
  {
    id: 'recursion',
    title: 'Recursion',
    keywords: ['recursion', 'recursive', 'call stack', 'base case'],
    introduction:
      'For recursion, track two things carefully: the base case and what happens before versus after the recursive call. That is what determines the final output order.',
    example: {
      problem:
        'What does a recursive function do if it prints `n`, calls itself on `n - 1`, then prints `n` again?',
      answer:
        'It prints values on the way down the recursion and then again on the way back up, so the output is mirrored around the base case.',
      explanation:
        'The first print happens before the deeper call. The second print happens while the call stack unwinds. Recursion questions often test whether you can separate those two phases.',
    },
    pitfalls: [
      'Missing or incorrect base case.',
      'Tracing only the downward calls and forgetting the unwind step.',
      'Assuming recursive output is always in one direction.',
    ],
    review_questions: [
      'What role does the runtime stack play in recursion?',
      'How can you tell whether output occurs before or after the recursive call?',
      'Why can a small recursive function still produce non-obvious output?',
    ],
  },
];

const STUDY_GUIDE_AUTHORING_TEMPLATE = `Write a walkthrough-style study guide in Markdown using the structured course data.

Requirements:
- Teach each topic like a tutor, not like a checklist.
- Begin each topic with a short introduction in plain English.
- Use the lecture/source details to explain the topic step by step.
- Include at least one worked example with the answer and a brief explanation.
- Call out common pitfalls or mistakes.
- End each topic with 2-3 quick self-check questions.
- Prefer course wording and evidence from the provided snippets over generic textbook phrasing.
- Keep the writing crisp, concrete, and exam-oriented.

Use this structure for each topic:
1. Topic title
2. Why this topic matters
3. Key details from lectures/materials
4. Worked example
5. Common pitfalls
6. Check yourself
`;

const VOCABULARY_GUIDE_AUTHORING_TEMPLATE = `Write a vocabulary-first study guide in Markdown using the structured course data.

Requirements:
- Organize terms by topic.
- Keep each entry compact and exam-oriented.
- For every term or phrase, include:
  1. a plain-English definition
  2. why it matters for the exam
  3. one example exam-style question
  4. a short answer or answer outline
- Prefer the course's wording and source phrases over generic textbook wording.
- Preserve phrase-level items when they are important, not just single-word terms.
- Avoid filler, generic study-planner text, and repeated explanations.
`;

const VOCABULARY_BLUEPRINTS = {
  templating: [
    {
      term: 'Iterator',
      keywords: ['iterator', 'iterators'],
      definition:
        'An iterator is an object used to move through the elements of a container without exposing the container implementation.',
      why_it_matters:
        'The Exam 2 guide explicitly says you should know what iterators are, why they exist, and how they fit into STL-style containers.',
      example_question: 'What problem does an iterator solve in a generic container design?',
      answer_outline:
        'It gives a standard way to visit container elements without needing direct array indexing or exposing internal node structure.',
    },
    {
      term: 'Namespace',
      keywords: ['namespace', 'enhanced scoping', 'name-conflict'],
      definition: 'A namespace creates a scope that helps prevent naming conflicts.',
      why_it_matters:
        'The guide calls this enhanced scoping and expects you to connect it to name-conflict prevention.',
      example_question: 'Why would a custom namespace be useful in a course data-structures codebase?',
      answer_outline:
        'It prevents your classes or functions from colliding with names from other libraries or other code files.',
    },
    {
      term: 'typedef',
      keywords: ['typedef', 'symbolic representation'],
      definition: 'A typedef gives an existing type a symbolic name.',
      why_it_matters:
        'It appears directly in the Exam 2 checklist and in node-based code examples.',
      example_question: 'Why might a node definition use `typedef int Item;`?',
      answer_outline:
        'It hides the concrete stored type behind a symbolic name so code is easier to read and easier to retarget later.',
    },
    {
      term: 'size_t',
      keywords: ['size_t'],
      definition: 'size_t is an unsigned type commonly used for sizes, counts, and indexes.',
      why_it_matters:
        'The study guide explicitly says you should know both why it is used and what pitfalls it can cause.',
      example_question: 'What is one pitfall of using `size_t` in subtraction or loop logic?',
      answer_outline:
        'Because it is unsigned, subtracting in the wrong situation can wrap around instead of becoming negative.',
    },
    {
      term: 'Template class',
      keywords: ['template class', 'templating', 'generic'],
      definition: 'A template class is a class blueprint parameterized by type.',
      why_it_matters:
        'Templating is one of the named Exam 2 topics, and the course expects you to know what conditions must hold for a template to work.',
      example_question: 'What does a template class let you avoid rewriting?',
      answer_outline:
        'It lets you avoid writing multiple nearly identical container implementations for different stored types.',
    },
    {
      term: 'Left-inclusive metaphor',
      keywords: ['left-inclusive', 'left inclusive'],
      definition: 'A left-inclusive range includes the starting position and stops just before the ending position.',
      why_it_matters:
        'The Exam 2 guide names this phrase explicitly when discussing STL behavior.',
      example_question: 'In a half-open iterator range `[begin, end)`, which endpoint is excluded?',
      answer_outline: 'The right endpoint, `end`, is excluded.',
    },
  ],
  'algorithm-analysis': [
    {
      term: 'Worst case',
      keywords: ['worst case', 'worse case'],
      definition: 'Worst case is the maximum work an algorithm may require for an input size.',
      why_it_matters: 'The guide explicitly says you should know best, average, and worst case scenarios.',
      example_question: 'What is the worst case for linear search in an unsorted list?',
      answer_outline: 'The target is absent or last, so every element is checked.',
    },
    {
      term: 'Average case',
      keywords: ['average case'],
      definition: 'Average case describes expected behavior over a class or distribution of inputs.',
      why_it_matters: 'It helps separate typical performance from extreme performance.',
      example_question: 'Why is average-case analysis different from worst-case analysis?',
      answer_outline: 'Average case models typical inputs, while worst case focuses on the most expensive valid input.',
    },
    {
      term: 'Big-O notation',
      keywords: ['big-o', 'big o'],
      definition: 'Big-O describes an asymptotic upper bound on growth rate as input size becomes large.',
      why_it_matters: 'It is a central Exam 2 topic and the course explicitly warns about common misconceptions.',
      example_question: 'Does Big-O describe exact runtime or long-run growth behavior?',
      answer_outline: 'It describes long-run growth behavior, not exact stopwatch time.',
    },
    {
      term: 'Upper bound',
      keywords: ['upper bound'],
      definition: 'An upper bound says growth does not exceed a comparison function up to constant factors for large enough input sizes.',
      why_it_matters: 'The guide defines Big-O in terms of upper bounds.',
      example_question: 'If an algorithm is `O(n^2)`, what kind of statement is that?',
      answer_outline: 'It says the growth is bounded above by a constant multiple of `n^2` for sufficiently large `n`.',
    },
    {
      term: 'Asymptotic',
      keywords: ['asymptotic', 'in-the-big', 'settled-down'],
      definition: 'Asymptotic reasoning focuses on behavior after small-input quirks no longer matter.',
      why_it_matters: 'The guide explicitly pairs Big-O with the idea of “in-the-big” behavior.',
      example_question: 'Why does asymptotic analysis ignore small constant effects?',
      answer_outline: 'Because it focuses on the dominant growth pattern as input size gets large.',
    },
    {
      term: 'Order of magnitude',
      keywords: ['order of magnitude', 'broad-brushing'],
      definition: 'Order of magnitude is a broad-brush classification of how fast a function grows.',
      why_it_matters: 'The guide uses this exact phrase when describing Big-O categories.',
      example_question: 'Why are `3n + 8` and `200n - 5` the same order of magnitude?',
      answer_outline: 'Because both are linear and therefore both are `O(n)`.',
    },
  ],
  'linked-lists': [
    {
      term: 'Random access',
      keywords: ['random access'],
      definition: 'Random access means reaching an item directly by position in constant time.',
      why_it_matters: 'It is a major strength of arrays and a major weakness of linked lists.',
      example_question: 'Which structure naturally supports random access: array or linked list?',
      answer_outline: 'Array.',
    },
    {
      term: 'Sequential access',
      keywords: ['sequential access'],
      definition: 'Sequential access means reaching items by stepping through earlier items first.',
      why_it_matters: 'This is the basic access pattern for linked lists.',
      example_question: 'Why is access to the `i`th linked-list node usually linear time?',
      answer_outline: 'Because you must follow links from the head until you reach that node.',
    },
    {
      term: 'Insertion anomaly',
      keywords: ['insertion anomaly'],
      definition: 'Insertion anomaly refers to the shifting work required when inserting into an array-based sequence.',
      why_it_matters: 'The sample solutions use this phrase directly when comparing arrays and linked lists.',
      example_question: 'Why can inserting into the middle of a sorted array be expensive?',
      answer_outline: 'Because later elements may need to be shifted to make room for the new one.',
    },
    {
      term: 'Resizing woe',
      keywords: ['resizing woe'],
      definition: 'Resizing woe is the extra cost of having to allocate a bigger array and copy items when the old array is full.',
      why_it_matters: 'It is one of the course’s memorable phrase-level tradeoff labels.',
      example_question: 'Why can a sorted-array insertion become `O(n)` even before element shifting?',
      answer_outline: 'Because the array may need to be resized and copied first if it is already full.',
    },
    {
      term: 'Head pointer by reference',
      keywords: ['head pointer', 'by reference'],
      definition: 'Pass the head pointer by reference when a function may need to change which node is the head.',
      why_it_matters: 'The guide explicitly says you should know when head pointers are passed by value versus by reference.',
      example_question: 'If a function inserts at the front of a list, how should the head pointer be passed?',
      answer_outline: 'By reference, so the caller’s head pointer can be updated.',
    },
    {
      term: 'Null-pointer exception',
      keywords: ['null-pointer exception', 'null pointer'],
      definition: 'A null-pointer exception happens when code dereferences a pointer that does not point to a valid node.',
      why_it_matters: 'The Exam 2 guide repeatedly warns about avoiding this bug pattern.',
      example_question: 'Why is `cursor->link != 0` unsafe unless you already know `cursor != 0`?',
      answer_outline: 'Because it dereferences `cursor` before confirming `cursor` is not null.',
    },
    {
      term: 'Stale pointer',
      keywords: ['stale pointer'],
      definition: 'A stale pointer still stores an address after the pointed-to memory has been deallocated.',
      why_it_matters: 'The guide lists stale pointers among the bugs you should be able to identify in list-manipulating code.',
      example_question: 'Why is using a pointer after deleting its node dangerous?',
      answer_outline: 'Because the address still exists in the pointer, but the memory is no longer valid to use.',
    },
    {
      term: 'Memory leak',
      keywords: ['memory leak', 'leak away memory'],
      definition: 'A memory leak happens when allocated memory becomes unreachable and therefore cannot be properly freed.',
      why_it_matters: 'The guide explicitly says not to leak away memory.',
      example_question: 'How can reassigning a head pointer too early create a memory leak?',
      answer_outline: 'If you lose the only path to allocated nodes before deleting them, that memory becomes unreachable.',
    },
  ],
  'stacks-queues': [
    {
      term: 'LIFO',
      keywords: ['lifo'],
      definition: 'LIFO means last in, first out.',
      why_it_matters: 'It is the defining behavior of a stack.',
      example_question: 'Which restricted container uses LIFO behavior?',
      answer_outline: 'A stack.',
    },
    {
      term: 'FIFO',
      keywords: ['fifo'],
      definition: 'FIFO means first in, first out.',
      why_it_matters: 'It is the defining behavior of a queue.',
      example_question: 'Which restricted container uses FIFO behavior?',
      answer_outline: 'A queue.',
    },
    {
      term: 'Underflow',
      keywords: ['underflow'],
      definition: 'Underflow is the error condition that occurs when you remove from or inspect an empty restricted container.',
      why_it_matters: 'The study guide explicitly names underflow as an error condition to know.',
      example_question: 'What causes stack underflow?',
      answer_outline: 'Calling an operation such as `pop` or `top` when the stack is empty.',
    },
    {
      term: 'Prefix notation',
      keywords: ['prefix notation', 'prefix'],
      definition: 'In prefix notation, the operator is written before its operands.',
      why_it_matters: 'The stack applications note compares prefix, infix, and postfix directly.',
      example_question: 'Rewrite `(2 + 3) * 7` in prefix notation.',
      answer_outline: '`* + 2 3 7`.',
    },
    {
      term: 'Infix notation',
      keywords: ['infix notation', 'infix'],
      definition: 'In infix notation, the operator is written between its operands.',
      why_it_matters: 'This is the usual notation and the starting point for translation problems.',
      example_question: 'Which notation usually requires precedence rules or parentheses to remove ambiguity?',
      answer_outline: 'Infix notation.',
    },
    {
      term: 'Postfix notation',
      keywords: ['postfix notation', 'postfix'],
      definition: 'In postfix notation, the operator is written after its operands.',
      why_it_matters: 'The lecture note emphasizes that postfix is especially easy to evaluate with a stack.',
      example_question: 'Rewrite `(2 + 3) * 7` in postfix notation.',
      answer_outline: '`2 3 + 7 *`.',
    },
    {
      term: 'Postfix evaluation',
      keywords: ['evaluate postfix', 'postfix expression'],
      definition: 'Postfix evaluation uses a stack of operands and applies an operator when it is reached.',
      why_it_matters: 'This is one of the core classic stack applications in the course note.',
      example_question: 'What is the first operator applied in `2 3 4 * +`?',
      answer_outline: '`*`, because postfix applies operators after their operands are already available.',
    },
    {
      term: 'Queue using two stacks',
      keywords: ['queue using 2 stacks', 'queue using two stacks', 'instack', 'outstack'],
      definition: 'A queue can be implemented using one stack for incoming items and one stack for outgoing items.',
      why_it_matters: 'This exact pseudocode appears in the course examples.',
      example_question: 'Why does moving items from `inStack` to `outStack` create queue behavior?',
      answer_outline: 'Because reversing the order this way makes the oldest inserted item reach the front first.',
    },
    {
      term: 'Breadth-first traversal',
      keywords: ['breadth-first', 'level traversal', 'fifo'],
      definition: 'Breadth-first or level traversal processes discovered items in first-in-first-out order, one level at a time.',
      why_it_matters: 'The linked-list-of-linked-lists example explains why a queue is the right tool.',
      example_question: 'Why is a queue a natural choice for breadth-first traversal?',
      answer_outline: 'Because nodes found earlier should be processed earlier, which matches FIFO behavior.',
    },
  ],
  recursion: [
    {
      term: 'Base case',
      keywords: ['base case'],
      definition: 'The base case is the stopping case that does not recurse further.',
      why_it_matters: 'Without a correct base case, recursion does not terminate safely.',
      example_question: 'What is the job of the base case in a recursive function?',
      answer_outline: 'It stops further recursive calls on the smallest valid subproblem.',
    },
    {
      term: 'Recursive case',
      keywords: ['recursive case'],
      definition: 'The recursive case reduces the current problem to a smaller problem of the same kind.',
      why_it_matters: 'Correct recursion depends on making measurable progress toward the base case.',
      example_question: 'What must a recursive case always do besides calling itself?',
      answer_outline: 'It must move the problem closer to a base case.',
    },
    {
      term: 'Activation record',
      keywords: ['activation record', 'call stack', 'runtime stack'],
      definition: 'An activation record is the call-specific information stored on the runtime stack for one function invocation.',
      why_it_matters: 'The course expects you to connect recursion with the runtime stack picture.',
      example_question: 'Why can deep recursion fail even if each call is simple?',
      answer_outline: 'Because each call adds another activation record to the runtime stack.',
    },
    {
      term: 'Unwind step',
      keywords: ['unwind', 'way back up', 'after the recursive call'],
      definition: 'The unwind step is the phase where recursive calls return and any post-call work executes.',
      why_it_matters: 'Many recursion trace questions are really testing whether you track the unwind correctly.',
      example_question: 'Why can a recursive function print values in reverse order even if it visits forward on the way down?',
      answer_outline: 'Because the print can happen during the unwind, after deeper calls return.',
    },
    {
      term: 'Recursive trace',
      keywords: ['trace', 'mystery', 'print'],
      definition: 'A recursive trace follows both the call phase and the return phase of execution.',
      why_it_matters: 'The sample past exam includes a recursion-output tracing question.',
      example_question: 'Why is tracing only the downward calls insufficient on many recursion questions?',
      answer_outline: 'Because important output or state changes may happen after the recursive call returns.',
    },
  ],
};

const GUIDE_MODES = new Set(['walkthrough', 'vocabulary']);
const SOURCE_SCOPES = new Set(['all', 'focused', 'uploaded_only']);
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'build', 'by', 'course', 'create', 'each', 'exam', 'for',
  'from', 'guide', 'in', 'include', 'is', 'it', 'its', 'of', 'on', 'one', 'or', 'short', 'should', 'study',
  'that', 'the', 'their', 'them', 'these', 'this', 'through', 'to', 'use', 'using', 'with', 'your',
]);

function clipText(value, maxLength = 280) {
  const text = htmlToText(value || '').replace(/\s+/g, ' ').trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}…`;
}

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

function getStudentEnrollment(course) {
  return course.enrollments?.find((enrollment) => enrollment.type?.includes('Student')) ?? course.enrollments?.[0] ?? null;
}

function normalizeSlug(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function resolveGuideMode(request = {}) {
  if (GUIDE_MODES.has(request.guideMode)) {
    return request.guideMode;
  }

  const haystack = `${request.title || ''} ${request.objective || ''} ${request.outputFormat || ''}`.toLowerCase();

  if (haystack.includes('vocab') || haystack.includes('glossary') || haystack.includes('terminology')) {
    return 'vocabulary';
  }

  return 'walkthrough';
}

function extractRequestKeywords(request = {}) {
  const source = `${request.title || ''} ${request.objective || ''}`.toLowerCase();

  return [...new Set(
    source
      .replace(/[^a-z0-9]+/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 3 && !STOP_WORDS.has(token)),
  )];
}

function countRequestKeywordMatches(text, requestKeywords) {
  const haystack = String(text || '').toLowerCase();
  return requestKeywords.reduce((count, keyword) => (haystack.includes(keyword) ? count + 1 : count), 0);
}

function resolveSourceScope(request = {}, snapshot = {}, guideMode = 'walkthrough') {
  if (SOURCE_SCOPES.has(request.sourceScope)) {
    return request.sourceScope;
  }

  const hasUploadedMaterials = (snapshot.uploaded_materials || []).some((item) => item.textExtracted);

  if (guideMode === 'vocabulary' && hasUploadedMaterials) {
    return 'uploaded_only';
  }

  return 'focused';
}

function normalizeTopicLabel(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function collectTopics(snapshot) {
  const topicMap = new Map();

  const pushTopic = (sourceType, sourceId, label, text) => {
    const normalizedLabel = normalizeTopicLabel(label);

    if (!normalizedLabel) {
      return;
    }

    const key = normalizedLabel.toLowerCase();
    const existing = topicMap.get(key);

    if (existing) {
      existing.sources.push({ sourceType, sourceId });
      return;
    }

    topicMap.set(key, {
      label: normalizedLabel,
      summary: clipText(text || '', 320),
      sources: [{ sourceType, sourceId }],
    });
  };

  for (const module of snapshot.modules || []) {
    pushTopic('module', module.id, module.name, module.description);

    for (const item of module.items || []) {
      pushTopic('module_item', item.id, item.title || item.page_url || item.type, item.content_details?.description);
    }
  }

  for (const page of snapshot.pages || []) {
    pushTopic('page', page.page_id ?? page.url, page.title, page.text_content);
  }

  for (const assignment of snapshot.assignments || []) {
    pushTopic('assignment', assignment.id, assignment.name, assignment.description);
  }

  for (const material of snapshot.uploaded_materials || []) {
    pushTopic('uploaded_material', material.id, material.displayName, material.text_content || material.textExcerpt);
  }

  return [...topicMap.values()].slice(0, 20);
}

function buildPriorityItems(snapshot, options = {}) {
  const includeCompletedAssignments = options.includeCompletedAssignments === true;
  const now = Date.now();

  const assignmentItems = (snapshot.assignments || []).map((assignment) => {
    const dueAtMs = assignment.due_at ? new Date(assignment.due_at).getTime() : null;
    const isSubmitted = Boolean(assignment.submission?.submitted_at);
    const isMissing = Boolean(assignment.submission?.missing);
    const isLate = Boolean(assignment.submission?.late);
    const isOverdue = Boolean(dueAtMs && dueAtMs < now && !isSubmitted);
    const dueSoon = Boolean(dueAtMs && dueAtMs >= now && dueAtMs - now <= 1000 * 60 * 60 * 24 * 7);

    let score = 0;
    let reason = 'Reference material';

    if (isMissing || isOverdue) {
      score = 100;
      reason = 'Overdue or missing work should be handled first.';
    } else if (dueSoon) {
      score = 80;
      reason = 'Due within the next 7 days.';
    } else if (!isSubmitted && dueAtMs) {
      score = 60;
      reason = 'Open assignment with a published due date.';
    } else if (isLate) {
      score = 50;
      reason = 'Previously late submission that may need review.';
    }

    return {
      id: assignment.id,
      kind: 'assignment',
      title: assignment.name,
      due_at: toIsoDate(assignment.due_at),
      score,
      reason,
      submitted: isSubmitted,
      missing: isMissing,
      link: assignment.html_url || null,
    };
  });

  const moduleItems = (snapshot.modules || []).map((module, index) => ({
    id: module.id,
    kind: 'module',
    title: module.name,
    due_at: null,
    score: Math.max(10, 45 - index),
    reason: 'Modules usually define the intended study order for course material.',
    submitted: false,
    missing: false,
    link: null,
  }));

  return [...assignmentItems, ...moduleItems]
    .filter((item) => includeCompletedAssignments || !item.submitted)
    .sort((left, right) => right.score - left.score)
    .slice(0, 15);
}

function buildStudyBlocks(priorityItems, options = {}) {
  const availableHours = Number(options.availableHours) > 0 ? Number(options.availableHours) : 6;
  const maxBlocks = Math.max(3, Math.min(priorityItems.length || 3, Math.ceil(availableHours / 1.5)));
  const blockHours = Math.max(1, Math.round((availableHours / maxBlocks) * 10) / 10);

  return priorityItems.slice(0, maxBlocks).map((item, index) => ({
    order: index + 1,
    title: item.title,
    duration_hours: blockHours,
    objective:
      item.kind === 'assignment'
        ? 'Review source material, note open questions, and complete or draft the assignment.'
        : 'Read through the module items and capture the core concepts, formulas, or vocabulary.',
    reason: item.reason,
    due_at: item.due_at,
  }));
}

function buildSourceDocuments(snapshot, request = {}, guideMode = 'walkthrough') {
  const documents = [];
  const requestKeywords = extractRequestKeywords(request);
  const sourceScope = resolveSourceScope(request, snapshot, guideMode);

  const pushDocument = (sourceType, sourceId, title, text) => {
    const normalizedTitle = normalizeTopicLabel(title);
    const normalizedText = clipText(text || '', 2500);

    if (!normalizedTitle && !normalizedText) {
      return;
    }

    documents.push({
      sourceType,
      sourceId,
      title: normalizedTitle || `${sourceType} ${sourceId}`,
      text: normalizedText,
    });
  };

  pushDocument('front_page', 'front_page', snapshot.front_page?.title || 'Front page', snapshot.front_page?.body);
  pushDocument('syllabus', 'syllabus', 'Syllabus', snapshot.course?.syllabus_body);

  for (const page of snapshot.pages || []) {
    pushDocument('page', page.page_id ?? page.url, page.title, page.body || page.text_content);
  }

  for (const module of snapshot.modules || []) {
    pushDocument('module', module.id, module.name, module.description);
  }

  for (const assignment of snapshot.assignments || []) {
    pushDocument('assignment', assignment.id, assignment.name, assignment.description);
  }

  for (const material of snapshot.uploaded_materials || []) {
    pushDocument('uploaded_material', material.id, material.displayName, material.text_content || material.textExcerpt);
  }

  const dedupedDocuments = [...new Map(
    documents.map((document) => [
      `${document.sourceType}:${normalizeSlug(document.title)}:${document.text.slice(0, 120)}`,
      document,
    ]),
  ).values()];

  if (sourceScope === 'all') {
    return dedupedDocuments;
  }

  if (sourceScope === 'uploaded_only') {
    return dedupedDocuments.filter((document) => document.sourceType === 'uploaded_material');
  }

  const scoredDocuments = dedupedDocuments
    .map((document) => ({
      ...document,
      score:
        countRequestKeywordMatches(`${document.title} ${document.text}`, requestKeywords) * 3 +
        (document.sourceType === 'uploaded_material' ? 8 : 0) +
        (guideMode === 'vocabulary' && document.sourceType === 'uploaded_material' ? 5 : 0),
    }))
    .sort((left, right) => right.score - left.score);

  const positiveMatches = scoredDocuments.filter((document) => document.score > 0);
  const fallbackDocuments = scoredDocuments.slice(0, guideMode === 'vocabulary' ? 8 : 12);

  return (positiveMatches.length > 0 ? positiveMatches : fallbackDocuments).map(({ score, ...document }) => document);
}

function countKeywordMatches(text, keywords) {
  const haystack = String(text || '').toLowerCase();
  return keywords.reduce((count, keyword) => (haystack.includes(keyword) ? count + 1 : count), 0);
}

function buildSnippet(text, keywords, maxLength = 180) {
  const normalizedText = String(text || '').replace(/\s+/g, ' ').trim();

  if (!normalizedText) {
    return '';
  }

  const lower = normalizedText.toLowerCase();
  const keyword = keywords.find((item) => lower.includes(item));

  if (!keyword) {
    return normalizedText.slice(0, maxLength);
  }

  const position = lower.indexOf(keyword);
  const start = Math.max(0, position - Math.floor(maxLength / 3));
  const end = Math.min(normalizedText.length, start + maxLength);
  const excerpt = normalizedText.slice(start, end).trim();

  if (start > 0 && end < normalizedText.length) {
    return `…${excerpt}…`;
  }

  if (start > 0) {
    return `…${excerpt}`;
  }

  if (end < normalizedText.length) {
    return `${excerpt}…`;
  }

  return excerpt;
}

function buildWalkthroughTopics(snapshot, request, topicClusters, documents) {
  const requestText = `${request.title || ''} ${request.objective || ''}`.toLowerCase();

  const scoredTopics = TOPIC_BLUEPRINTS.map((topic) => {
    const requestScore = countKeywordMatches(requestText, topic.keywords);
    const documentScore = documents.reduce(
      (total, document) => total + countKeywordMatches(`${document.title} ${document.text}`, topic.keywords),
      0,
    );

    return {
      ...topic,
      score: requestScore * 5 + documentScore,
    };
  })
    .filter((topic) => topic.score > 0)
    .sort((left, right) => right.score - left.score);

  const selectedTopics = (scoredTopics.length > 0 ? scoredTopics : TOPIC_BLUEPRINTS).slice(0, 5);

  return selectedTopics.map((topic) => {
    const matchingDocuments = documents
      .map((document) => ({
        ...document,
        score:
          countKeywordMatches(document.title, topic.keywords) * 3 +
          countKeywordMatches(document.text, topic.keywords),
      }))
      .filter((document) => document.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, MAX_EVIDENCE_SNIPPETS_PER_TOPIC)
      .map((document) => ({
        source_type: document.sourceType,
        source_id: document.sourceId,
        title: document.title,
        excerpt: buildSnippet(document.text, topic.keywords),
      }));

    const clusterMatch = topicClusters.find((cluster) => countKeywordMatches(cluster.label, topic.keywords) > 0);
    const lectureDetails = [
      clusterMatch?.summary,
      ...matchingDocuments.map((document) => `${document.title}: ${document.excerpt}`),
    ]
      .filter(Boolean)
      .slice(0, 5);

    if (lectureDetails.length === 0) {
      lectureDetails.push(
        'No focused lecture snippet was matched in the current source scope. Expand the source scope or add more uploaded material for a more grounded topic summary.',
      );
    }

    return {
      id: topic.id,
      title: topic.title,
      introduction: topic.introduction,
      lecture_details: lectureDetails,
      worked_example: {
        problem: topic.example.problem,
        answer: topic.example.answer,
        explanation: topic.example.explanation,
      },
      common_pitfalls: topic.pitfalls,
      check_yourself: topic.review_questions,
      source_refs: matchingDocuments,
    };
  });
}

function buildVocabularyTerms(request, documents) {
  const requestText = `${request.title || ''} ${request.objective || ''}`.toLowerCase();
  const selectedTopics = TOPIC_BLUEPRINTS.map((topic) => {
    const requestScore = countKeywordMatches(requestText, topic.keywords);
    const documentScore = documents.reduce(
      (total, document) => total + countKeywordMatches(`${document.title} ${document.text}`, topic.keywords),
      0,
    );

    return {
      ...topic,
      score: requestScore * 5 + documentScore,
    };
  })
    .filter((topic) => topic.score > 0)
    .sort((left, right) => right.score - left.score);

  const topicsToUse = (selectedTopics.length > 0 ? selectedTopics : TOPIC_BLUEPRINTS).slice(0, 5);

  return topicsToUse.flatMap((topic) => {
    const topicTerms = VOCABULARY_BLUEPRINTS[topic.id] || [];

    return topicTerms.map((termBlueprint, index) => {
      const keywords = termBlueprint.keywords || [termBlueprint.term.toLowerCase()];
      const sourceRefs = documents
        .map((document) => ({
          source_type: document.sourceType,
          source_id: document.sourceId,
          title: document.title,
          excerpt: buildSnippet(document.text, keywords),
          score: countKeywordMatches(`${document.title} ${document.text}`, keywords),
        }))
        .filter((document) => document.score > 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, 2)
        .map(({ score, ...document }) => document);

      return {
        id: `${topic.id}-${index + 1}-${normalizeSlug(termBlueprint.term)}`,
        topic_id: topic.id,
        topic_title: topic.title,
        term: termBlueprint.term,
        definition: termBlueprint.definition,
        why_it_matters: termBlueprint.why_it_matters,
        example_question: termBlueprint.example_question,
        answer_outline: termBlueprint.answer_outline,
        source_refs: sourceRefs,
      };
    });
  });
}

function buildAuthoringPrompt(guide) {
  const sourceList = (guide.source_material.documents_used || [])
    .map((document, index) => `${index + 1}. ${document.title} (${document.source_type})`)
    .join('\n');

  if (guide.request.guide_mode === 'vocabulary') {
    const termCount = guide.vocabulary_terms.length;

    return [
      VOCABULARY_GUIDE_AUTHORING_TEMPLATE.trim(),
      '',
      `Course: ${guide.course.name || 'Unknown course'}`,
      `Objective: ${guide.request.objective}`,
      `Guide mode: ${guide.request.guide_mode}`,
      `Source scope: ${guide.request.source_scope}`,
      `Vocabulary term count: ${termCount}`,
      '',
      sourceList ? `Documents used:\n${sourceList}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  const topicList = guide.walkthrough_topics.map((topic, index) => `${index + 1}. ${topic.title}`).join('\n');

  return [
    STUDY_GUIDE_AUTHORING_TEMPLATE.trim(),
    '',
    `Course: ${guide.course.name || 'Unknown course'}`,
    `Objective: ${guide.request.objective}`,
    `Exam date: ${guide.request.exam_date || 'Not specified'}`,
    `Guide mode: ${guide.request.guide_mode}`,
    `Source scope: ${guide.request.source_scope}`,
    '',
    'Topics to cover:',
    topicList,
    '',
    sourceList ? `Documents used:\n${sourceList}` : '',
  ].join('\n');
}

function buildOverview(guideMode) {
  if (guideMode === 'vocabulary') {
    return {
      purpose:
        'This guide is meant to compress the exam scope into high-value terms and phrases you should be able to define, recognize in code, and use correctly on short-answer or design questions.',
      recommended_use:
        'Read each term aloud, answer the example question before checking the outline, and turn missed terms into a last-minute cram list.',
    };
  }

  return {
    purpose:
      'This guide is meant to teach the main topics as a walkthrough: introduce the idea, explain the important details from course material, then practice with a worked example and answer.',
    recommended_use:
      'Read each topic section in order, work the example yourself before reading the answer, then use the check-yourself questions for quick recall.',
  };
}

function buildSourceMaterialSummary(snapshot, documents) {
  return {
    syllabus_excerpt: clipText(snapshot.course?.syllabus_body || '', 1200),
    front_page_excerpt: clipText(snapshot.front_page?.body || '', 1200),
    documents_used: documents.slice(0, 12).map((document) => ({
      source_type: document.sourceType,
      source_id: document.sourceId,
      title: document.title,
      excerpt: clipText(document.text, 220),
    })),
    uploaded_material_titles: (snapshot.uploaded_materials || []).slice(0, 20).map((item) => item.displayName),
  };
}

function createStudyGuide(snapshot, request = {}) {
  const guideMode = resolveGuideMode(request);
  const sourceScope = resolveSourceScope(request, snapshot, guideMode);
  const includePlanningSections = request.includePlanningSections === true;
  const enrollment = getStudentEnrollment(snapshot.course || {});
  const documents = buildSourceDocuments(
    snapshot,
    {
      ...request,
      guideMode,
      sourceScope,
    },
    guideMode,
  );
  const priorityItems = includePlanningSections ? buildPriorityItems(snapshot, request) : [];
  const upcomingAssignments = includePlanningSections
    ? collectUpcomingAssignments(snapshot.assignments || [], { limit: 8 })
    : [];
  const topicClusters = collectTopics(snapshot);
  const studyBlocks = includePlanningSections ? buildStudyBlocks(priorityItems, request) : [];
  const walkthroughTopics =
    guideMode === 'walkthrough' ? buildWalkthroughTopics(snapshot, request, topicClusters, documents) : [];
  const vocabularyTerms = guideMode === 'vocabulary' ? buildVocabularyTerms(request, documents) : [];

  const guide = {
    generated_at: new Date().toISOString(),
    request: {
      title: request.title || `Study guide for ${snapshot.course?.name || 'course'}`,
      objective: request.objective || 'Prepare a focused study plan using all available course context.',
      exam_date: toIsoDate(request.examDate),
      available_hours: Number(request.availableHours) > 0 ? Number(request.availableHours) : 6,
      output_format: request.outputFormat || 'outline',
      guide_mode: guideMode,
      source_scope: sourceScope,
      include_completed_assignments: request.includeCompletedAssignments === true,
      include_planning_sections: includePlanningSections,
    },
    course: {
      id: snapshot.course?.id,
      name: snapshot.course?.name,
      course_code: snapshot.course?.course_code || null,
      current_grade: enrollment?.computed_current_grade || enrollment?.current_grade || null,
      current_score: enrollment?.computed_current_score ?? enrollment?.current_score ?? null,
    },
    summary: {
      assignment_count: snapshot.assignments?.length || 0,
      module_count: snapshot.modules?.length || 0,
      page_count: snapshot.pages?.length || 0,
      announcement_count: snapshot.announcements?.length || 0,
      discussion_count: snapshot.discussions?.length || 0,
      file_count: snapshot.files?.length || 0,
      uploaded_material_count: snapshot.uploaded_materials?.length || 0,
      documents_considered_count: documents.length,
      warnings: snapshot.warnings || [],
    },
    overview: buildOverview(guideMode),
    key_deadlines: upcomingAssignments.map((assignment) => ({
      id: assignment.id,
      title: assignment.name,
      due_at: toIsoDate(assignment.due_at),
      points_possible: assignment.points_possible ?? null,
      submission_state: assignment.submission?.workflow_state || null,
      missing: assignment.submission?.missing || false,
    })),
    priority_items: priorityItems,
    topic_clusters: topicClusters,
    study_blocks: studyBlocks,
    walkthrough_topics: walkthroughTopics,
    vocabulary_terms: vocabularyTerms,
    authoring_prompt: '',
    source_material: buildSourceMaterialSummary(snapshot, documents),
  };

  guide.authoring_prompt = buildAuthoringPrompt(guide);

  return guide;
}

function renderStudyGuideMarkdown(guide) {
  const lines = [
    `# ${guide.request.title}`,
    '',
    `**Course:** ${guide.course.name || 'Unknown course'}`,
    `**Objective:** ${guide.request.objective}`,
    `**Guide mode:** ${guide.request.guide_mode}`,
    `**Source scope:** ${guide.request.source_scope}`,
  ];

  if (guide.request.exam_date) {
    lines.push(`**Exam date:** ${guide.request.exam_date}`);
  }

  if (guide.course.current_grade) {
    lines.push(`**Current grade:** ${guide.course.current_grade}`);
  }

  lines.push('', '## How To Use This Guide', '', guide.overview.purpose, '', guide.overview.recommended_use);

  if (guide.request.guide_mode === 'vocabulary') {
    const groupedTerms = guide.vocabulary_terms.reduce((groups, term) => {
      if (!groups.has(term.topic_title)) {
        groups.set(term.topic_title, []);
      }

      groups.get(term.topic_title).push(term);
      return groups;
    }, new Map());

    for (const [topicTitle, terms] of groupedTerms.entries()) {
      lines.push('', `## ${topicTitle}`);

      for (const term of terms) {
        lines.push(
          '',
          `### ${term.term}`,
          '',
          `**Definition:** ${term.definition}`,
          '',
          `**Why it matters:** ${term.why_it_matters}`,
          '',
          `**Example question:** ${term.example_question}`,
          '',
          `**Short answer:** ${term.answer_outline}`,
        );

        if (term.source_refs.length > 0) {
          lines.push('', '**Source cues:**');

          for (const sourceRef of term.source_refs) {
            lines.push(`- ${sourceRef.title}: ${sourceRef.excerpt}`);
          }
        }
      }
    }

    return `${lines.join('\n')}\n`;
  }

  for (const topic of guide.walkthrough_topics) {
    lines.push('', `## ${topic.title}`, '', topic.introduction, '', '### Key Details From Course Material');

    for (const detail of topic.lecture_details) {
      lines.push(`- ${detail}`);
    }

    lines.push('', '### Worked Example', '', `**Problem:** ${topic.worked_example.problem}`, '', '**Answer:**');
    lines.push(...topic.worked_example.answer.split('\n'));
    lines.push('', `**Why this answer is right:** ${topic.worked_example.explanation}`, '', '### Common Pitfalls');

    for (const pitfall of topic.common_pitfalls) {
      lines.push(`- ${pitfall}`);
    }

    lines.push('', '### Check Yourself');

    topic.check_yourself.forEach((question, index) => {
      lines.push(`${index + 1}. ${question}`);
    });
  }

  if (guide.request.include_planning_sections && guide.study_blocks.length > 0) {
    lines.push('', '## Suggested Study Blocks');

    for (const block of guide.study_blocks) {
      lines.push(`- Block ${block.order}: ${block.title} — ${block.duration_hours}h. ${block.objective}`);
    }
  }

  if (guide.request.include_planning_sections && guide.key_deadlines.length > 0) {
    lines.push('', '## Upcoming Deadlines');

    for (const item of guide.key_deadlines) {
      lines.push(`- ${item.title}${item.due_at ? ` (due ${item.due_at})` : ''}`);
    }
  }

  return `${lines.join('\n')}\n`;
}

export { createStudyGuide, renderStudyGuideMarkdown };
