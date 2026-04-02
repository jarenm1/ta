import type { CanvasCourse } from './canvasApi';
import type { CodingProblemPayload } from './codingProblems';

type CodingWorkspaceExample = {
  explanation: string;
  input: string;
  output: string;
  title: string;
};

type CodingWorkspaceTestCase = {
  expectedOutput: string;
  id: string;
  input: string;
  label: string;
  notes?: string;
};

type CodingWorkspaceConfig = {
  constraints: string[];
  difficulty: string;
  language: string;
  prompt: string[];
  runnerKind: 'cpp-linked-list-reverse' | 'cpp-stdin-console' | 'mips-wasm';
  starterCode: string;
  testCases: CodingWorkspaceTestCase[];
  title: string;
  topic: string;
  walkthrough: string[];
  examples: CodingWorkspaceExample[];
};

type CourseFeatureConfig = {
  codingWorkspace?: CodingWorkspaceConfig;
};

type CourseFeatureOverride = {
  features: CourseFeatureConfig;
  matches: (course: Pick<CanvasCourse, 'course_code' | 'id' | 'name' | 'original_name'>) => boolean;
};

function buildCourseSearchLabel(course: Pick<CanvasCourse, 'course_code' | 'name' | 'original_name'>) {
  return [course.course_code, course.name, course.original_name]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(' ')
    .toLowerCase();
}

function createCourseMatcher(options: {
  courseIds?: number[];
  patterns?: RegExp[];
}) {
  return (course: Pick<CanvasCourse, 'course_code' | 'id' | 'name' | 'original_name'>) => {
    const searchLabel = buildCourseSearchLabel(course);

    if (options.courseIds?.includes(course.id)) {
      return true;
    }

    return options.patterns?.some((pattern) => pattern.test(searchLabel)) ?? false;
  };
}

const cs3358CodingWorkspace: CodingWorkspaceConfig = {
  constraints: [
    'Use iterative pointer updates rather than creating a second linked list.',
    'Treat an empty list and a single-node list as already reversed.',
    'Return the new head pointer after the reversal is complete.',
  ],
  difficulty: 'Medium',
  examples: [
    {
      explanation:
        'Walk three pointers through the list. After each step, redirect the current node to the node that came before it.',
      input: 'head = 2 -> 4 -> 6 -> 8',
      output: '8 -> 6 -> 4 -> 2',
      title: 'Example 1',
    },
    {
      explanation:
        'A single node already points to null, so the same node is both the original and reversed head.',
      input: 'head = 11',
      output: '11',
      title: 'Example 2',
    },
  ],
  language: 'cpp',
  prompt: [
    'You are given the head of a singly linked list. Reverse the list in place and return the new head.',
    'Assume the course implementation uses a `Node` struct with `int value` and `Node* next` fields. Focus on pointer manipulation rather than rebuilding the list.',
  ],
  runnerKind: 'cpp-linked-list-reverse',
  starterCode: `struct Node {
  int value;
  Node* next;
};

Node* reverseList(Node* head) {
  Node* previous = nullptr;
  Node* current = head;

  while (current != nullptr) {
    Node* nextNode = current->next;

    current->next = previous;
    previous = current;
    current = nextNode;
  }

  return previous;
}`,
  testCases: [
    {
      expectedOutput: '8 6 4 2',
      id: 'linked-list-1',
      input: '2 4 6 8',
      label: 'Four nodes',
      notes: 'Checks the standard multi-step reversal path.',
    },
    {
      expectedOutput: '11',
      id: 'linked-list-2',
      input: '11',
      label: 'Single node',
      notes: 'Verifies the function leaves a one-node list unchanged.',
    },
    {
      expectedOutput: '(empty list)',
      id: 'linked-list-3',
      input: '(empty list)',
      label: 'Empty list',
      notes: 'Make sure null input returns null without dereferencing.',
    },
  ],
  title: 'Reverse a Singly Linked List',
  topic: 'Pointers · Linked Lists · Iteration',
  walkthrough: [
    'Start with three pointer roles: `previous`, `current`, and `nextNode`.',
    'Save `current->next` before changing anything, or the rest of the list becomes unreachable.',
    'Reverse the arrow by pointing `current->next` back to `previous`.',
    'Slide every pointer forward one position and repeat until `current` becomes `nullptr`.',
    'When the traversal ends, `previous` is the new head of the reversed list.',
  ],
};

const mipsIntroCodingWorkspace: CodingWorkspaceConfig = {
  constraints: [
    'Use standard MIPS arithmetic instructions (add, sub, mul, div).',
    'Use syscall 5 (read_int) to get integer input.',
    'Use syscall 1 (print_int) to output the result.',
    'Use syscall 10 (exit) to terminate the program.',
  ],
  difficulty: 'Easy',
  examples: [
    {
      explanation:
        'The program reads 5 and 3, adds them using the add instruction, and prints the result.',
      input: '5\n3',
      output: '8',
      title: 'Example 1',
    },
    {
      explanation:
        'The program reads -2 and 2, adds them to get 0.',
      input: '-2\n2',
      output: '0',
      title: 'Example 2',
    },
  ],
  language: 'mips',
  prompt: [
    'Compute the sum of two integers using MIPS assembly.',
    'Read two integers from standard input, add them together, and print the result.',
    'This exercise reinforces basic MIPS arithmetic instructions and syscall usage.',
  ],
  runnerKind: 'mips-wasm',
  starterCode: `# Sum two integers in MIPS
# Input: two integers on separate lines
# Output: sum printed to console

.text
main:
    # TODO: Read first integer into $t0 using syscall 5
    
    # TODO: Read second integer into $t1 using syscall 5
    
    # TODO: Add the two integers (add $t2, $t0, $t1)
    
    # TODO: Print the result using syscall 1
    
    # Exit
    li $v0, 10
    syscall
`,
  testCases: [
    {
      expectedOutput: '8',
      id: 'mips-arith-1',
      input: '5\n3',
      label: 'Positive numbers',
      notes: 'Basic addition of two positive integers.',
    },
    {
      expectedOutput: '0',
      id: 'mips-arith-2',
      input: '-2\n2',
      label: 'Mixed signs',
      notes: 'Addition with negative number.',
    },
    {
      expectedOutput: '-10',
      id: 'mips-arith-3',
      input: '-5\n-5',
      label: 'Negative numbers',
      notes: 'Adding two negative numbers.',
    },
  ],
  title: 'Integer Addition in MIPS',
  topic: 'MIPS Assembly · Arithmetic · Syscalls',
  walkthrough: [
    'Use syscall 5 (read_int) to get integer input from the user.',
    'Store the first integer in a temporary register ($t0).',
    'Read the second integer into another register ($t1).',
    'Use the add instruction to compute the sum in $t2.',
    'Move the result to $a0 for printing with syscall 1.',
    'Use syscall 1 (print_int) to output the result.',
    'Use syscall 10 (exit) to terminate the program.',
  ],
};

const courseFeatureOverrides: CourseFeatureOverride[] = [
  {
    features: {
      codingWorkspace: cs3358CodingWorkspace,
    },
    matches: createCourseMatcher({
      courseIds: [2622272],
      patterns: [/\bcs\s*3358\b/i, /\bdata structures\b/i],
    }),
  },
  {
    features: {
      codingWorkspace: mipsIntroCodingWorkspace,
    },
    matches: createCourseMatcher({
      patterns: [/\bmips\b/i, /\bassembly\b/i, /\bcomputer\s*organization\b/i, /\barchitecture\b/i, /\bcs\s*2318\b/i, /\b2318\b/i],
    }),
  },
];

function getCourseFeatures(course: Pick<CanvasCourse, 'course_code' | 'id' | 'name' | 'original_name'>) {
  const matchingOverride = courseFeatureOverrides.find((override) => override.matches(course));

  return matchingOverride?.features ?? {};
}

function getCodingWorkspaceConfig(
  course: Pick<CanvasCourse, 'course_code' | 'id' | 'name' | 'original_name'>,
) {
  return getCourseFeatures(course).codingWorkspace ?? null;
}

function buildCodingWorkspaceConfigFromProblem(problemPayload: CodingProblemPayload): CodingWorkspaceConfig {
  return {
    constraints: problemPayload.problem.constraints,
    difficulty: problemPayload.problem.difficulty,
    examples: problemPayload.problem.examples,
    language: problemPayload.problem.language,
    prompt: problemPayload.problem.description,
    runnerKind: problemPayload.problem.runner_kind,
    starterCode: problemPayload.problem.starter_code,
    testCases: problemPayload.problem.test_cases.map((testCase) => ({
      expectedOutput: testCase.expected_output,
      id: testCase.id,
      input: testCase.input,
      label: testCase.label,
      notes: testCase.notes,
    })),
    title: problemPayload.problem.title,
    topic: problemPayload.problem.topic,
    walkthrough: problemPayload.problem.walkthrough,
  };
}

function isCodingWorkspaceEnabled(
  course: Pick<CanvasCourse, 'course_code' | 'id' | 'name' | 'original_name'>,
) {
  return Boolean(getCodingWorkspaceConfig(course));
}

function buildCodingWorkspaceRunnableSource(workspace: Pick<CodingWorkspaceConfig, 'runnerKind'>, sourceCode: string) {
  switch (workspace.runnerKind) {
    case 'cpp-stdin-console':
      return sourceCode;

    case 'mips-wasm':
      return sourceCode;

    case 'cpp-linked-list-reverse':
      return `#include <iostream>
#include <sstream>
#include <string>
#include <vector>

${sourceCode}

namespace {

Node* buildList(const std::vector<int>& values) {
  Node* head = nullptr;
  Node* tail = nullptr;

  for (int value : values) {
    Node* nextNode = new Node{value, nullptr};

    if (head == nullptr) {
      head = nextNode;
      tail = nextNode;
      continue;
    }

    tail->next = nextNode;
    tail = nextNode;
  }

  return head;
}

void destroyList(Node* head) {
  while (head != nullptr) {
    Node* nextNode = head->next;
    delete head;
    head = nextNode;
  }
}

void printList(Node* head) {
  if (head == nullptr) {
    std::cout << "(empty list)";
    return;
  }

  bool isFirst = true;

  while (head != nullptr) {
    if (!isFirst) {
      std::cout << ' ';
    }

    std::cout << head->value;
    isFirst = false;
    head = head->next;
  }
}

}  // namespace

int main() {
  std::vector<int> values;
  int value = 0;

  while (std::cin >> value) {
    values.push_back(value);
  }

  Node* head = buildList(values);
  Node* reversedHead = reverseList(head);

  printList(reversedHead);
  std::cout << std::endl;
  destroyList(reversedHead);

  return 0;
}
`;
    default:
      return sourceCode;
  }
}

export {
  buildCodingWorkspaceConfigFromProblem,
  buildCodingWorkspaceRunnableSource,
  getCodingWorkspaceConfig,
  getCourseFeatures,
  isCodingWorkspaceEnabled,
};
export type { CodingWorkspaceConfig, CodingWorkspaceExample, CodingWorkspaceTestCase, CourseFeatureConfig };
