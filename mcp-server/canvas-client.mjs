const DEFAULT_PAGE_SIZE = 100;

class CanvasClientError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'CanvasClientError';
    this.status = options.status;
    this.details = options.details;
  }
}

function normalizeCanvasEndpoint(endpoint) {
  return String(endpoint || '').trim().replace(/\/+$/, '');
}

function resolveCanvasUrl(session, pathOrUrl) {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  const endpoint = normalizeCanvasEndpoint(session.endpoint);
  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${endpoint}${path}`;
}

function getOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function parseLinkHeader(linkHeader) {
  if (!linkHeader) {
    return {};
  }

  return linkHeader.split(',').reduce((links, rawPart) => {
    const match = rawPart.match(/<([^>]+)>;\s*rel="([^"]+)"/i);

    if (!match) {
      return links;
    }

    const [, url, rel] = match;
    links[rel] = url;
    return links;
  }, {});
}

async function requestCanvas(session, pathOrUrl, options = {}) {
  const url = resolveCanvasUrl(session, pathOrUrl);
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${session.token}`,
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new CanvasClientError(
      errorText || `Canvas request failed with status ${response.status}`,
      {
        status: response.status,
        details: {
          url,
        },
      },
    );
  }

  return response;
}

async function requestCanvasJson(session, pathOrUrl, options = {}) {
  const response = await requestCanvas(session, pathOrUrl, options);
  return response.json();
}

async function paginateCanvasJson(session, pathOrUrl) {
  const results = [];
  let nextUrl = resolveCanvasUrl(session, pathOrUrl);

  while (nextUrl) {
    const response = await requestCanvas(session, nextUrl);
    const pageData = await response.json();

    if (Array.isArray(pageData)) {
      results.push(...pageData);
    } else {
      results.push(pageData);
    }

    nextUrl = parseLinkHeader(response.headers.get('link')).next;
  }

  return results;
}

function buildCourseDetailsPath(courseId) {
  return `/api/v1/courses/${courseId}?include[]=term&include[]=course_progress&include[]=total_scores&include[]=current_grading_period_scores&include[]=syllabus_body`;
}

function buildCourseAssignmentsPath(courseId) {
  return `/api/v1/courses/${courseId}/assignments?per_page=${DEFAULT_PAGE_SIZE}&order_by=due_at&include[]=submission`;
}

function buildCourseModulesPath(courseId) {
  return `/api/v1/courses/${courseId}/modules?per_page=${DEFAULT_PAGE_SIZE}&include[]=items&include[]=content_details`;
}

function buildCoursePagesPath(courseId) {
  return `/api/v1/courses/${courseId}/pages?per_page=${DEFAULT_PAGE_SIZE}`;
}

function buildCourseFilesPath(courseId) {
  return `/api/v1/courses/${courseId}/files?per_page=${DEFAULT_PAGE_SIZE}`;
}

function buildCourseFoldersPath(courseId) {
  return `/api/v1/courses/${courseId}/folders?per_page=${DEFAULT_PAGE_SIZE}`;
}

function buildCourseDiscussionTopicsPath(courseId) {
  return `/api/v1/courses/${courseId}/discussion_topics?per_page=${DEFAULT_PAGE_SIZE}`;
}

function buildAnnouncementsPath(courseId) {
  return `/api/v1/announcements?context_codes[]=course_${courseId}&per_page=${DEFAULT_PAGE_SIZE}`;
}

const canvasCoursesPath =
  `/api/v1/courses?per_page=${DEFAULT_PAGE_SIZE}&enrollment_state=active&state[]=available&state[]=completed&include[]=term&include[]=course_progress&include[]=total_scores&include[]=current_grading_period_scores`;

async function listCourses(session) {
  return paginateCanvasJson(session, canvasCoursesPath);
}

async function getCourseDetails(session, courseId) {
  return requestCanvasJson(session, buildCourseDetailsPath(courseId));
}

async function listCourseAssignments(session, courseId) {
  return paginateCanvasJson(session, buildCourseAssignmentsPath(courseId));
}

async function listCourseModules(session, courseId) {
  return paginateCanvasJson(session, buildCourseModulesPath(courseId));
}

async function listCoursePages(session, courseId) {
  return paginateCanvasJson(session, buildCoursePagesPath(courseId));
}

async function getCoursePage(session, courseId, pageUrl) {
  const encodedPageUrl = encodeURIComponent(pageUrl);
  return requestCanvasJson(session, `/api/v1/courses/${courseId}/pages/${encodedPageUrl}`);
}

async function getCourseFrontPage(session, courseId) {
  try {
    return await requestCanvasJson(session, `/api/v1/courses/${courseId}/front_page`);
  } catch (error) {
    if (error instanceof CanvasClientError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

async function listCourseFiles(session, courseId) {
  return paginateCanvasJson(session, buildCourseFilesPath(courseId));
}

async function listCourseFolders(session, courseId) {
  return paginateCanvasJson(session, buildCourseFoldersPath(courseId));
}

async function listCourseDiscussionTopics(session, courseId) {
  return paginateCanvasJson(session, buildCourseDiscussionTopicsPath(courseId));
}

async function listCourseAnnouncements(session, courseId) {
  return paginateCanvasJson(session, buildAnnouncementsPath(courseId));
}

async function getFileMetadata(session, fileId) {
  return requestCanvasJson(session, `/api/v1/files/${fileId}`);
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function htmlToText(value) {
  if (!value) {
    return '';
  }

  return decodeHtmlEntities(
    String(value)
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|section|article|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\r/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim(),
  );
}

function summarizeText(value, maxLength = 1200) {
  const text = htmlToText(value);

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength).trimEnd()}…`;
}

function normalizeCoursePage(page, pageDetail) {
  const body = pageDetail?.body ?? null;

  return {
    ...page,
    body,
    text_content: summarizeText(body, 4000),
  };
}

async function mapWithConcurrencyLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < items.length) {
      const index = currentIndex;
      currentIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function getCourseSnapshot(session, courseId, options = {}) {
  const includePageBodies = options.includePageBodies !== false;

  const [course, assignments, modules, pages, frontPage, announcements, discussions, files, folders] =
    await Promise.all([
      getCourseDetails(session, courseId),
      listCourseAssignments(session, courseId),
      listCourseModules(session, courseId),
      listCoursePages(session, courseId),
      getCourseFrontPage(session, courseId),
      listCourseAnnouncements(session, courseId),
      listCourseDiscussionTopics(session, courseId),
      listCourseFiles(session, courseId),
      listCourseFolders(session, courseId),
    ]);

  const pagesWithContent = includePageBodies
    ? await mapWithConcurrencyLimit(pages, 4, async (page) => {
        try {
          const pageDetail = await getCoursePage(session, courseId, page.url);
          return normalizeCoursePage(page, pageDetail);
        } catch (error) {
          return {
            ...page,
            body: null,
            text_content: '',
            page_error: error instanceof Error ? error.message : 'Unable to fetch page body.',
          };
        }
      })
    : pages.map((page) => ({
        ...page,
        body: null,
        text_content: '',
      }));

  return {
    generated_at: new Date().toISOString(),
    course,
    front_page: frontPage
      ? {
          ...frontPage,
          text_content: summarizeText(frontPage.body, 6000),
        }
      : null,
    assignments,
    modules,
    pages: pagesWithContent,
    announcements: announcements.map((announcement) => ({
      ...announcement,
      text_content: summarizeText(announcement.message, 3000),
    })),
    discussions: discussions.map((discussion) => ({
      ...discussion,
      text_content: summarizeText(discussion.message, 3000),
    })),
    files,
    folders,
    warnings: buildSnapshotWarnings({ files }),
  };
}

function buildSnapshotWarnings({ files }) {
  const unsupportedFiles = files.filter((file) => !isTextLikeFile(file.display_name, file.content_type));

  if (unsupportedFiles.length === 0) {
    return [];
  }

  return [
    {
      code: 'binary-files-not-extracted',
      message:
        'Some course files are binary and are not text-extracted yet. Their metadata is present, but PDF/Office parsing still needs to be added.',
      file_count: unsupportedFiles.length,
    },
  ];
}

function isTextLikeContentType(contentType) {
  if (!contentType) {
    return false;
  }

  return (
    contentType.startsWith('text/') ||
    [
      'application/json',
      'application/xml',
      'application/javascript',
      'application/x-javascript',
      'application/xhtml+xml',
    ].includes(contentType)
  );
}

function isTextLikeExtension(fileName) {
  return /\.(txt|md|markdown|csv|tsv|json|xml|html|htm|js|ts|jsx|tsx|css|rtf)$/i.test(fileName || '');
}

function isTextLikeFile(fileName, contentType) {
  return isTextLikeContentType(contentType || '') || isTextLikeExtension(fileName || '');
}

async function getFileText(session, fileId, options = {}) {
  const maxBytes = Number(options.maxBytes) > 0 ? Number(options.maxBytes) : 200000;
  const metadata = await getFileMetadata(session, fileId);

  if (!isTextLikeFile(metadata.display_name, metadata.content_type)) {
    throw new CanvasClientError(
      `File ${metadata.display_name || fileId} is not a text-like file. Binary extraction is not implemented yet.`,
      { status: 415 },
    );
  }

  const downloadUrl = metadata.url || metadata.preview_url;

  if (!downloadUrl) {
    throw new CanvasClientError(`File ${metadata.display_name || fileId} does not expose a download URL.`);
  }

  const canvasOrigin = getOrigin(normalizeCanvasEndpoint(session.endpoint));
  const downloadOrigin = getOrigin(downloadUrl);
  const response =
    canvasOrigin && downloadOrigin && canvasOrigin === downloadOrigin
      ? await requestCanvas(session, downloadUrl, {
          headers: {
            Accept: metadata.content_type || 'text/plain',
          },
        })
      : await fetch(downloadUrl, {
          headers: {
            Accept: metadata.content_type || 'text/plain',
          },
        });

  if (!response.ok) {
    throw new CanvasClientError(
      `Unable to download file ${metadata.display_name || fileId}.`,
      { status: response.status },
    );
  }

  const text = await response.text();

  return {
    metadata,
    text: text.slice(0, maxBytes),
    truncated: text.length > maxBytes,
  };
}

function collectUpcomingAssignments(assignments, options = {}) {
  const limit = Number(options.limit) > 0 ? Number(options.limit) : 10;
  const now = Date.now();

  return [...assignments]
    .filter((assignment) => assignment.due_at)
    .map((assignment) => ({
      ...assignment,
      due_at_ms: new Date(assignment.due_at).getTime(),
    }))
    .filter((assignment) => assignment.due_at_ms >= now)
    .sort((left, right) => left.due_at_ms - right.due_at_ms)
    .slice(0, limit)
    .map(({ due_at_ms, ...assignment }) => assignment);
}

export {
  CanvasClientError,
  buildCourseAssignmentsPath,
  canvasCoursesPath,
  collectUpcomingAssignments,
  getCourseDetails,
  getCourseFrontPage,
  getCoursePage,
  getCourseSnapshot,
  getFileMetadata,
  getFileText,
  htmlToText,
  listCourseAnnouncements,
  listCourseAssignments,
  listCourseDiscussionTopics,
  listCourseFiles,
  listCourseFolders,
  listCourseModules,
  listCoursePages,
  listCourses,
  normalizeCanvasEndpoint,
  parseLinkHeader,
  requestCanvas,
  requestCanvasJson,
  summarizeText,
};
