
const DEFAULT_CODES = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_ERROR',
};

// An error with an HTTP status and a message written for people.
//   throw new ApiError(404, 'Doctor not found')
//   throw ApiError.validation({ phone: 'Phone number should look like 01711-234567.' })
export class ApiError extends Error {
  constructor(status, message, { code, fields } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code ?? DEFAULT_CODES[status] ?? 'ERROR';
    this.fields = fields;
  }

  static validation(fields) {
    return new ApiError(400, 'Please check the highlighted fields.', { code: 'VALIDATION_ERROR', fields });
  }
}

// validate({ params, query, body }) checks each part of the request with a zod schema.
// The clean, parsed values go on req.valid, so routes never read raw input.
export const validate = (schemas) => (req, res, next) => {
  const fields = {};
  req.valid = {};

  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (result.success) {
      req.valid[part] = result.data;
      continue;
    }
    for (const issue of result.error.issues) {
      fields[issue.path.join('.') || part] ??= issue.message;
    }
  }

  if (Object.keys(fields).length > 0) throw ApiError.validation(fields);
  next();
};

// No route matched.
export function notFound(req, res, next) {
  next(new ApiError(404, `There is no ${req.method} ${req.originalUrl} endpoint.`));
}

// The ONLY place that turns errors into JSON:
//   { "error": { "code": "VALIDATION_ERROR", "message": "…", "fields": { … } } }
// Express 5 sends errors thrown in async routes here automatically.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const error = toApiError(err);
  if (error.status >= 500 && error.status !== 503) console.error(err); // 503: the database is down, explained once at startup

  res.status(error.status).json({
    error: { code: error.code, message: error.message, ...(error.fields && { fields: error.fields }) },
  });
}

function toApiError(err) {
  if (err instanceof ApiError) return err;
  if (err.type === 'entity.parse.failed') {
    return new ApiError(400, "The request body isn't valid JSON.", { code: 'INVALID_JSON' });
  }
  if (err.type === 'entity.too.large') return new ApiError(413, 'That request is too large.');
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'value';
    return new ApiError(409, 'This already exists.', { code: 'DUPLICATE', fields: { [field]: 'This is already in use.' } });
  }
  return new ApiError(500, 'Something went wrong on our side. Please try again.');
}
