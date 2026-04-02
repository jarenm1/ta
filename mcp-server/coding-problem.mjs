import { htmlToText } from './canvas-client.mjs';

const CODING_PROBLEM_BLUEPRINTS = {
  algorithm_analysis: {
    constraints: [
      'Read `n` integers from standard input and print one result to standard output.',
      'Keep the implementation iterative and linear after input parsing.',
      'Avoid unnecessary extra passes over the data.',
    ],
    description: [
      'You are given a sequence of integers. Compute the maximum difference `values[j] - values[i]` such that `j > i`.',
      'This problem reinforces single-pass reasoning, running-minimum tracking, and the difference between a quadratic brute-force solution and a linear scan.',
    ],
    difficulty: 'Medium',
    examples: [
      {
        explanation:
          'Track the smallest value seen so far and compare each later value against it. The best difference is `8 - 1 = 7`.',
        input: '6\n5 1 4 2 8 3',
        output: '7',
        title: 'Example 1',
      },
      {
        explanation:
          'If the sequence only decreases, the best valid difference is the least negative one.',
        input: '4\n9 7 5 4',
        output: '-2',
        title: 'Example 2',
      },
    ],
    language: 'cpp',
    runner_kind: 'cpp-stdin-console',
    source_cues: ['Big-O analysis', 'single pass', 'brute force vs optimized scan'],
    starter_code: `#include <algorithm>
#include <iostream>
#include <vector>

int maxDifference(const std::vector<int>& values) {
  if (values.size() < 2) {
    return 0;
  }

  // TODO: Replace this placeholder implementation with the real single-pass algorithm.
  // Track the smallest value seen so far and update the best forward difference at each step.
  int smallestSoFar = values[0];
  int bestDifference = 0;

  (void)smallestSoFar;
  return bestDifference;
}

int main() {
  int count = 0;
  std::cin >> count;

  std::vector<int> values(count);
  for (int index = 0; index < count; ++index) {
    std::cin >> values[index];
  }

  std::cout << maxDifference(values);
  return 0;
}
`,
    test_cases: [
      {
        expected_output: '7',
        id: 'analysis-1',
        input: '6\n5 1 4 2 8 3\n',
        label: 'Mixed values',
        notes: 'Checks the standard optimized scan.',
      },
      {
        expected_output: '-2',
        id: 'analysis-2',
        input: '4\n9 7 5 4\n',
        label: 'Always decreasing',
        notes: 'Verifies the algorithm still returns the best valid pair.',
      },
    ],
    title: 'Maximum Forward Difference',
    topic: 'Algorithm Analysis · Arrays · Single-Pass Optimization',
    walkthrough: [
      'Identify the brute-force baseline: compare every earlier value with every later value.',
      'Replace nested comparison with one running fact: the smallest value seen so far.',
      'At each step, ask what difference the current value can make against that running minimum.',
      'Update the minimum only after using the current value as a possible ending point.',
    ],
  },
  linked_lists: {
    constraints: [
      'Use iterative pointer updates rather than creating a second linked list.',
      'Treat an empty list and a single-node list as already reversed.',
      'Return the new head pointer after the reversal is complete.',
    ],
    description: [
      'You are given the head of a singly linked list. Reverse the list in place and return the new head.',
      'Assume the course implementation uses a `Node` struct with `int value` and `Node* next` fields. Focus on pointer manipulation rather than rebuilding the list.',
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
    runner_kind: 'cpp-linked-list-reverse',
    source_cues: ['linked lists', 'pointer manipulation', 'iterative reversal'],
    starter_code: `struct Node {
  int value;
  Node* next;
};

Node* reverseList(Node* head) {
  // TODO: Reverse the list in place.
  // Suggested pointer roles: previous, current, and nextNode.
  return head;
}
`,
    test_cases: [
      {
        expected_output: '8 6 4 2',
        id: 'linked-list-1',
        input: '2 4 6 8',
        label: 'Four nodes',
        notes: 'Checks the standard multi-step reversal path.',
      },
      {
        expected_output: '11',
        id: 'linked-list-2',
        input: '11',
        label: 'Single node',
        notes: 'Verifies the function leaves a one-node list unchanged.',
      },
      {
        expected_output: '(empty list)',
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
      'Slide every pointer forward one position and repeat until `current` becomes null.',
    ],
  },
  template_linked_lists: {
    constraints: [
      'Implement the list as a C++ class template, not as an `int`-only structure.',
      'Store nodes with a `data` field and a `link` pointer.',
      'Support empty-list behavior without dereferencing null pointers.',
    ],
    description: [
      'Complete a templated singly linked list class that supports inserting at the front and counting how many times a target value appears.',
      'This problem reinforces class templates, linked-list node manipulation, and writing member functions that work for generic item types.',
    ],
    difficulty: 'Medium',
    examples: [
      {
        explanation:
          'Insert the values at the front in order `4, 2, 4, 7, 4`. The list contains the target value `4` three times.',
        input: '5\n4 2 4 7 4\n4',
        output: '3',
        title: 'Example 1',
      },
      {
        explanation: 'An empty list contains every target value zero times.',
        input: '0\n9',
        output: '0',
        title: 'Example 2',
      },
    ],
    language: 'cpp',
    runner_kind: 'cpp-stdin-console',
    source_cues: ['templates', 'linked lists', 'class template', 'node class'],
    starter_code: `#include <iostream>

template <typename Item>
class SimpleLinkedList {
 private:
  struct Node {
    Item data;
    Node* link;
  };

  Node* head;

 public:
  SimpleLinkedList() : head(nullptr) {}

  ~SimpleLinkedList() {
    while (head != nullptr) {
      Node* nextNode = head->link;
      delete head;
      head = nextNode;
    }
  }

  void pushFront(const Item& value) {
    head = new Node{value, head};
  }

  int countOccurrences(const Item& target) const {
    // TODO: Traverse from head to nullptr and count matching nodes.
    (void)target;
    return 0;
  }
};

int main() {
  int count = 0;
  std::cin >> count;

  SimpleLinkedList<int> values;
  for (int index = 0; index < count; ++index) {
    int value = 0;
    std::cin >> value;
    values.pushFront(value);
  }

  int target = 0;
  std::cin >> target;
  std::cout << values.countOccurrences(target);
  return 0;
}
`,
    test_cases: [
      {
        expected_output: '3',
        id: 'template-linked-list-1',
        input: '5\n4 2 4 7 4\n4\n',
        label: 'Repeated target',
        notes: 'Checks class-template node creation plus traversal counting.',
      },
      {
        expected_output: '0',
        id: 'template-linked-list-2',
        input: '0\n9\n',
        label: 'Empty list',
        notes: 'Verifies the list handles null head safely.',
      },
      {
        expected_output: '1',
        id: 'template-linked-list-3',
        input: '4\n8 5 3 1\n5\n',
        label: 'Single match',
        notes: 'Confirms traversal over a generic list with one matching node.',
      },
    ],
    title: 'Templated Singly Linked List Occurrence Count',
    topic: 'Templates · Linked Lists · Node Classes',
    walkthrough: [
      'Represent each node with both stored data and a pointer to the next node.',
      'Make the outer list a class template so the same code works for any comparable item type.',
      'Insert at the front by allocating one new node and linking it to the old head.',
      'Traverse from `head` to `nullptr`, counting every node whose data matches the target.',
    ],
  },
  recursion: {
    constraints: [
      'Use recursion instead of an explicit loop for the main logic.',
      'Handle the empty sequence and single-element sequence correctly.',
      'Keep helper parameters simple and easy to trace by hand.',
    ],
    description: [
      'Given a list of non-negative integers, return the sum of the values at even indexes using a recursive solution.',
      'This problem emphasizes base cases, reducing to a smaller subproblem, and tracing recursive calls carefully.',
    ],
    difficulty: 'Easy',
    examples: [
      {
        explanation:
          'Use the value at index 0, then recurse on index 2, then index 4.',
        input: '5\n3 8 5 1 2',
        output: '10',
        title: 'Example 1',
      },
      {
        explanation: 'The empty input has no even-indexed values, so the sum is 0.',
        input: '0',
        output: '0',
        title: 'Example 2',
      },
    ],
    language: 'cpp',
    runner_kind: 'cpp-stdin-console',
    source_cues: ['recursion', 'base case', 'recursive case'],
    starter_code: `#include <iostream>
#include <vector>

int sumEvenIndexes(const std::vector<int>& values, int index = 0) {
  // TODO: Write the recursive base case and recursive step.
  (void)values;
  (void)index;
  return 0;
}

int main() {
  int count = 0;
  std::cin >> count;

  std::vector<int> values(count);
  for (int index = 0; index < count; ++index) {
    std::cin >> values[index];
  }

  std::cout << sumEvenIndexes(values);
  return 0;
}
`,
    test_cases: [
      {
        expected_output: '10',
        id: 'recursion-1',
        input: '5\n3 8 5 1 2\n',
        label: 'Odd count',
        notes: 'Indexes 0, 2, and 4 contribute.',
      },
      {
        expected_output: '0',
        id: 'recursion-2',
        input: '0\n',
        label: 'Empty sequence',
        notes: 'The base case should return 0 immediately.',
      },
    ],
    title: 'Recursive Sum of Even Indexes',
    topic: 'Recursion · Arrays · Base Cases',
    walkthrough: [
      'Define the smallest subproblem first: what should happen once the index goes past the end?',
      'Use the current even-index value, then recurse to the next even index.',
      'Make sure each recursive call moves closer to the base case.',
      'Trace one example by hand to verify the call stack unwinds to the expected sum.',
    ],
  },
  stacks_queues: {
    constraints: [
      'Use the stack data structure already introduced in class.',
      'Output only `balanced` or `not balanced`.',
      'Treat an empty string as balanced.',
    ],
    description: [
      'Given a string containing only parentheses, brackets, and braces, determine whether the delimiters are balanced.',
      'This problem practices stack push/pop behavior and careful case analysis for closing symbols.',
    ],
    difficulty: 'Easy',
    examples: [
      {
        explanation: 'Each closing symbol matches the most recent unmatched opener.',
        input: '{[()()]}',
        output: 'balanced',
        title: 'Example 1',
      },
      {
        explanation: 'The `)` arrives while `[` is still the most recent opener, so the string is not balanced.',
        input: '([)]',
        output: 'not balanced',
        title: 'Example 2',
      },
    ],
    language: 'cpp',
    runner_kind: 'cpp-stdin-console',
    source_cues: ['stacks', 'delimiter matching', 'push and pop'],
    starter_code: `#include <iostream>
#include <stack>
#include <string>

bool isBalanced(const std::string& text) {
  // TODO: Use the stack to match opening and closing delimiters.
  (void)text;
  std::stack<char> symbols;
  return symbols.empty();
}

int main() {
  std::string text;
  std::getline(std::cin, text);
  std::cout << (isBalanced(text) ? "balanced" : "not balanced");
  return 0;
}
`,
    test_cases: [
      {
        expected_output: 'balanced',
        id: 'stack-1',
        input: '{[()()]}\n',
        label: 'Nested balanced delimiters',
        notes: 'Checks the standard push/pop flow.',
      },
      {
        expected_output: 'not balanced',
        id: 'stack-2',
        input: '([)]\n',
        label: 'Crossed pairs',
        notes: 'Verifies mismatch detection.',
      },
    ],
    title: 'Balanced Delimiters',
    topic: 'Stacks · Delimiter Matching · String Traversal',
    walkthrough: [
      'Push each opening delimiter onto the stack.',
      'When a closing delimiter appears, the top of the stack must be its matching opener.',
      'If the stack is empty too early, the string is immediately invalid.',
      'At the end, the stack must also be empty.',
    ],
  },
  templates_stl: {
    constraints: [
      'Use a `std::vector<int>` parameter rather than a fixed-size array.',
      'Do not assume the values are already sorted.',
      'Return the number of distinct values.',
    ],
    description: [
      'Given a vector of integers, count how many distinct values it contains.',
      'This problem reinforces STL container use, iteration, and the idea of separating interface from implementation details.',
    ],
    difficulty: 'Easy',
    examples: [
      {
        explanation: 'The values `{4, 1, 4, 2, 1, 3}` contain four distinct numbers: 1, 2, 3, and 4.',
        input: '6\n4 1 4 2 1 3',
        output: '4',
        title: 'Example 1',
      },
      {
        explanation: 'Repeated copies of the same value still count as one distinct element.',
        input: '5\n7 7 7 7 7',
        output: '1',
        title: 'Example 2',
      },
    ],
    language: 'cpp',
    runner_kind: 'cpp-stdin-console',
    source_cues: ['templates', 'STL containers', 'vector'],
    starter_code: `#include <iostream>
#include <set>
#include <vector>

int countDistinct(const std::vector<int>& values) {
  // TODO: Insert the values into an STL container that removes duplicates.
  (void)values;
  return 0;
}

int main() {
  int count = 0;
  std::cin >> count;

  std::vector<int> values(count);
  for (int index = 0; index < count; ++index) {
    std::cin >> values[index];
  }

  std::cout << countDistinct(values);
  return 0;
}
`,
    test_cases: [
      {
        expected_output: '4',
        id: 'template-1',
        input: '6\n4 1 4 2 1 3\n',
        label: 'Mixed duplicates',
        notes: 'Checks standard distinct counting.',
      },
      {
        expected_output: '1',
        id: 'template-2',
        input: '5\n7 7 7 7 7\n',
        label: 'All identical',
        notes: 'Every value collapses to one unique element.',
      },
    ],
    title: 'Count Distinct Values',
    topic: 'Templates · STL · Vectors and Sets',
    walkthrough: [
      'Choose a container that naturally removes duplicates.',
      'Insert each value from the input into that container.',
      'Use the container size as the answer.',
      'Explain why this approach separates storage details from counting logic.',
    ],
  },
  mips_arithmetic: {
    constraints: [
      'Use standard MIPS arithmetic instructions (add, sub, mul, div).',
      'Follow the standard calling convention for input and output.',
      'Return the result in $v0.',
    ],
    description: [
      'Compute the sum of two integers using MIPS assembly.',
      'Read two integers from standard input, add them together, and print the result.',
      'This problem reinforces basic MIPS arithmetic instructions and syscall usage.',
    ],
    difficulty: 'Easy',
    examples: [
      {
        explanation:
          'The program reads 5 and 3, adds them to get 8, and prints the result.',
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
    runner_kind: 'mips-wasm',
    source_cues: ['MIPS', 'assembly', 'arithmetic', 'syscall'],
    starter_code: `# Sum two integers in MIPS
# Input: two integers on separate lines
# Output: sum printed to console

.text
main:
    # TODO: Read first integer into $t0
    
    # TODO: Read second integer into $t1
    
    # TODO: Add the two integers
    
    # TODO: Print the result
    
    # Exit
    li $v0, 10
    syscall
`,
    test_cases: [
      {
        expected_output: '8',
        id: 'mips-arith-1',
        input: '5\n3',
        label: 'Positive numbers',
        notes: 'Basic addition of two positive integers.',
      },
      {
        expected_output: '0',
        id: 'mips-arith-2',
        input: '-2\n2',
        label: 'Mixed signs',
        notes: 'Addition with negative number.',
      },
      {
        expected_output: '-10',
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
      'Store the first integer in a temporary register.',
      'Read the second integer into another register.',
      'Use the add instruction to compute the sum.',
      'Use syscall 1 (print_int) to output the result.',
      'Use syscall 10 (exit) to terminate the program.',
    ],
  },
  mips_array_sum: {
    constraints: [
      'Use load and store instructions (lw, sw) to access array elements.',
      'Use a loop to iterate through the array.',
      'Handle the array size as the first input value.',
    ],
    description: [
      'Calculate the sum of an array of integers in MIPS assembly.',
      'The first input value is n (the number of elements), followed by n integers.',
      'This problem reinforces array manipulation, loops, and memory access in MIPS.',
    ],
    difficulty: 'Medium',
    examples: [
      {
        explanation:
          'Read 5 elements: 1, 2, 3, 4, 5. The sum is 15.',
        input: '5\n1\n2\n3\n4\n5',
        output: '15',
        title: 'Example 1',
      },
      {
        explanation:
          'Read 3 elements: 10, 20, 30. The sum is 60.',
        input: '3\n10\n20\n30',
        output: '60',
        title: 'Example 2',
      },
    ],
    language: 'mips',
    runner_kind: 'mips-wasm',
    source_cues: ['MIPS', 'assembly', 'array', 'loop', 'memory'],
    starter_code: `# Array sum in MIPS
# Input: n followed by n integers
# Output: sum of all integers

.data
array: .space 400  # Space for up to 100 integers

.text
main:
    # TODO: Read array size n
    
    # TODO: Read n integers into the array
    
    # TODO: Calculate the sum of array elements
    
    # TODO: Print the sum
    
    # Exit
    li $v0, 10
    syscall
`,
    test_cases: [
      {
        expected_output: '15',
        id: 'mips-array-1',
        input: '5\n1\n2\n3\n4\n5',
        label: 'Small array',
        notes: 'Sum of 1 through 5.',
      },
      {
        expected_output: '60',
        id: 'mips-array-2',
        input: '3\n10\n20\n30',
        label: 'Medium array',
        notes: 'Sum of three values.',
      },
      {
        expected_output: '0',
        id: 'mips-array-3',
        input: '1\n0',
        label: 'Single zero',
        notes: 'Array with one zero element.',
      },
    ],
    title: 'Array Sum in MIPS',
    topic: 'MIPS Assembly · Arrays · Loops · Memory Access',
    walkthrough: [
      'Allocate space for the array in the .data section.',
      'Read the array size n using syscall 5.',
      'Use a loop to read n integers into the array.',
      'Initialize a sum register to 0.',
      'Iterate through the array, adding each element to the sum.',
      'Use syscall 1 to print the final sum.',
    ],
  },
  mips_factorial: {
    constraints: [
      'Use recursion to compute the factorial.',
      'Follow the MIPS calling convention (save $ra on the stack).',
      'Handle the base case of n <= 1.',
    ],
    description: [
      'Compute the factorial of a number using recursion in MIPS assembly.',
      'Implement a recursive factorial function that follows the MIPS calling convention.',
      'This problem reinforces recursion, stack manipulation, and the calling convention.',
    ],
    difficulty: 'Hard',
    examples: [
      {
        explanation:
          'The factorial of 5 is 5 * 4 * 3 * 2 * 1 = 120.',
        input: '5',
        output: '120',
        title: 'Example 1',
      },
      {
        explanation:
          'The factorial of 0 is 1 by definition.',
        input: '0',
        output: '1',
        title: 'Example 2',
      },
    ],
    language: 'mips',
    runner_kind: 'mips-wasm',
    source_cues: ['MIPS', 'assembly', 'recursion', 'stack', 'factorial'],
    starter_code: `# Recursive factorial in MIPS
# Input: single integer n
# Output: n! (factorial of n)

.text
main:
    # Read n
    li $v0, 5
    syscall
    move $a0, $v0    # Argument for factorial
    
    # Call factorial function
    jal factorial
    
    # Print result
    move $a0, $v0
    li $v0, 1
    syscall
    
    # Exit
    li $v0, 10
    syscall

# TODO: Implement factorial function
factorial:
    # Base case: if n <= 1, return 1
    
    # Recursive case: n * factorial(n-1)
    
    jr $ra
`,
    test_cases: [
      {
        expected_output: '120',
        id: 'mips-fact-1',
        input: '5',
        label: 'Factorial of 5',
        notes: '5! = 120',
      },
      {
        expected_output: '1',
        id: 'mips-fact-2',
        input: '0',
        label: 'Factorial of 0',
        notes: '0! = 1 by definition.',
      },
      {
        expected_output: '1',
        id: 'mips-fact-3',
        input: '1',
        label: 'Factorial of 1',
        notes: '1! = 1',
      },
    ],
    title: 'Recursive Factorial in MIPS',
    topic: 'MIPS Assembly · Recursion · Stack · Calling Convention',
    walkthrough: [
      'The main function reads the input and calls factorial.',
      'Implement the base case: if n <= 1, return 1.',
      'For the recursive case, save $ra on the stack.',
      'Save any saved registers you modify on the stack.',
      'Set up the argument for the recursive call (n-1).',
      'Call factorial recursively.',
      'Multiply the result by n to get n!',
      'Restore saved registers and $ra, then return.',
    ],
  },
};

function truncateText(value, maxLength = 260) {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trimEnd()}…`;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
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

function buildSourceDocuments(snapshot) {
  const documents = [];

  for (const module of snapshot.modules || []) {
    documents.push({
      source_type: 'module',
      source_id: module.id,
      title: module.name,
      summary: htmlToText(module.description || ''),
    });
  }

  for (const page of snapshot.pages || []) {
    documents.push({
      source_type: 'page',
      source_id: page.page_id ?? page.url,
      title: page.title,
      summary: htmlToText(page.body || page.text_content || ''),
    });
  }

  for (const assignment of snapshot.assignments || []) {
    documents.push({
      source_type: 'assignment',
      source_id: assignment.id,
      title: assignment.name,
      summary: htmlToText(assignment.description || ''),
    });
  }

  for (const material of snapshot.uploaded_materials || []) {
    documents.push({
      source_type: 'uploaded_material',
      source_id: material.id,
      title: material.displayName,
      summary: htmlToText(material.text_content || material.textExcerpt || ''),
    });
  }

  return uniqueBy(
    documents
      .map((document) => ({
        ...document,
        title: String(document.title || '').trim(),
        summary: String(document.summary || '').replace(/\s+/g, ' ').trim(),
      }))
      .filter((document) => document.title.length > 0),
    (document) => `${document.source_type}:${document.source_id}:${document.title.toLowerCase()}`,
  );
}

function inferTopicKey(request = {}) {
  const searchText = [request.objective, request.title, request.topicHint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // MIPS assembly topics
  if (/mips\s*assembly|mips\s*asm|assembly.*mips/.test(searchText) && /recursion|recursive/.test(searchText)) {
    return 'mips_factorial';
  }
  if (/mips\s*assembly|mips\s*asm|assembly.*mips/.test(searchText) && /array|sum|loop/.test(searchText)) {
    return 'mips_array_sum';
  }
  if (/mips\s*assembly|mips\s*asm|assembly.*mips/.test(searchText)) {
    return 'mips_arithmetic';
  }
  if (/mips|assembly|asm|risc|\.s\b|\.asm\b/.test(searchText)) {
    return 'mips_arithmetic';
  }

  // C++ topics
  if (/template|generic|class\s+template/.test(searchText) && /linked\s*list|node/.test(searchText)) {
    return 'template_linked_lists';
  }
  if (/linked\s*list|pointer|reverse/.test(searchText)) {
    return 'linked_lists';
  }
  if (/stack|queue|delimiter|parentheses|balanced/.test(searchText)) {
    return 'stacks_queues';
  }
  if (/recursion|recursive|base case/.test(searchText)) {
    return 'recursion';
  }
  if (/template|stl|vector|iterator|generic/.test(searchText)) {
    return 'templates_stl';
  }
  if (/analysis|big[ -]?o|runtime|complexity/.test(searchText)) {
    return 'algorithm_analysis';
  }

  return 'linked_lists';
}

function scoreDocument(document, blueprint, request = {}) {
  const haystack = `${document.title} ${document.summary}`.toLowerCase();
  let score = 0;

  for (const cue of blueprint.source_cues || []) {
    const cueTokens = String(cue).toLowerCase().split(/\s+/).filter(Boolean);
    if (cueTokens.some((token) => haystack.includes(token))) {
      score += 4;
    }
  }

  for (const value of [request.objective, request.title, request.topicHint]) {
    for (const token of String(value || '').toLowerCase().split(/[^a-z0-9]+/).filter((part) => part.length > 2)) {
      if (haystack.includes(token)) {
        score += 1;
      }
    }
  }

  if (/exam|test|quiz/.test(haystack)) {
    score += 1;
  }

  return score;
}

function buildSourceSummary(snapshot, blueprint, request = {}) {
  const documents = buildSourceDocuments(snapshot);
  const rankedDocuments = documents
    .map((document) => ({
      ...document,
      score: scoreDocument(document, blueprint, request),
    }))
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title));

  const selected = rankedDocuments.filter((document) => document.score > 0).slice(0, 6);
  const fallbackSelection = selected.length > 0 ? selected : rankedDocuments.slice(0, 4);

  return {
    documents_considered_count: documents.length,
    source_material: fallbackSelection.map((document) => ({
      source_type: document.source_type,
      source_id: document.source_id,
      title: document.title,
      excerpt: truncateText(document.summary),
      relevance_score: document.score,
    })),
  };
}

function buildCourseSummary(snapshot) {
  const enrollment = (snapshot.course?.enrollments || []).find((item) => item.type === 'student') ||
    snapshot.course?.enrollments?.[0] ||
    null;

  return {
    id: snapshot.course?.id,
    name: snapshot.course?.name || `Course ${snapshot.course?.id}`,
    course_code: snapshot.course?.course_code || null,
    current_grade: enrollment?.computed_current_grade || enrollment?.current_grade || null,
    current_score: enrollment?.computed_current_score || enrollment?.current_score || null,
  };
}

function createCodingProblem(snapshot, request = {}) {
  const topicKey = inferTopicKey(request);
  const blueprint = CODING_PROBLEM_BLUEPRINTS[topicKey] || CODING_PROBLEM_BLUEPRINTS.linked_lists;
  const sourceSummary = buildSourceSummary(snapshot, blueprint, request);

  return {
    generated_at: new Date().toISOString(),
    request: {
      title: request.title || blueprint.title,
      objective: request.objective || 'Create a coding problem grounded in the course materials.',
      topic_hint: request.topicHint || null,
      language: request.language || blueprint.language,
      difficulty: request.difficulty || blueprint.difficulty,
      include_walkthrough: request.includeWalkthrough !== false,
      source_scope: request.sourceScope || 'focused',
    },
    course: buildCourseSummary(snapshot),
    problem: {
      id: slugify(request.title || blueprint.title || topicKey) || `coding-problem-${topicKey}`,
      title: request.title || blueprint.title,
      topic: blueprint.topic,
      difficulty: request.difficulty || blueprint.difficulty,
      language: request.language || blueprint.language,
      description: blueprint.description,
      constraints: blueprint.constraints,
      examples: blueprint.examples,
      starter_code: blueprint.starter_code,
      test_cases: blueprint.test_cases,
      runner_kind: blueprint.runner_kind,
      walkthrough: request.includeWalkthrough === false ? [] : blueprint.walkthrough,
      source_refs: sourceSummary.source_material.map((document) => ({
        source_type: document.source_type,
        source_id: document.source_id,
        title: document.title,
      })),
    },
    source_summary: sourceSummary,
  };
}

function renderCodingProblemMarkdown(problemPayload) {
  const { course, problem, request, source_summary: sourceSummary } = problemPayload;
  const lines = [
    `# ${problem.title}`,
    '',
    `**Course:** ${course.name}`,
    `**Topic:** ${problem.topic}`,
    `**Difficulty:** ${problem.difficulty}`,
    `**Language:** ${problem.language.toUpperCase()}`,
    '',
    '## Description',
    '',
    ...problem.description.flatMap((paragraph) => [paragraph, '']),
    '## Constraints',
    '',
    ...problem.constraints.flatMap((constraint) => [`- ${constraint}`]),
    '',
    '## Examples',
    '',
  ];

  for (const example of problem.examples || []) {
    lines.push(`### ${example.title}`, '', `**Input:** ${example.input}`, '', `**Output:** ${example.output}`, '', example.explanation, '');
  }

  lines.push(
    '## Starter Code',
    '',
    'The scaffold below is intentionally incomplete. Fill in the core algorithm yourself.',
    '',
    '```cpp',
    problem.starter_code.trimEnd(),
    '```',
    '',
  );
  lines.push('## Test Cases', '');
  for (const testCase of problem.test_cases || []) {
    lines.push(
      `### ${testCase.label}`,
      '',
      `**Input:** ${testCase.input}`,
      '',
      `**Expected output:** ${testCase.expected_output}`,
      '',
      testCase.notes || '',
      '',
    );
  }

  if ((problem.walkthrough || []).length > 0) {
    lines.push('## Walkthrough', '', ...(problem.walkthrough || []).map((step) => `- ${step}`), '');
  }

  if ((sourceSummary.source_material || []).length > 0) {
    lines.push('## Source Cues', '');
    for (const source of sourceSummary.source_material) {
      lines.push(`- **${source.title}** (${source.source_type})${source.excerpt ? ` — ${source.excerpt}` : ''}`);
    }
    lines.push('');
  }

  lines.push(`_Generated for objective: ${request.objective}_`);
  return lines.join('\n');
}

export { createCodingProblem, renderCodingProblemMarkdown };
