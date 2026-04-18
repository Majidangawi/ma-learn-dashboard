export interface ToolSchema {
  name: string;
  description: string;
  mode: 'read' | 'write' | 'reason';
  input_schema: Record<string, unknown>;
}

export const toolRegistry: ToolSchema[] = [
  // Read (auto-execute)
  { name: 'read_customers', mode: 'read', description: 'List all customers across products.',
    input_schema: { type: 'object', properties: { product: { type: 'string' } }, required: [] } },
  { name: 'read_lessons', mode: 'read', description: 'List all lessons with active state.',
    input_schema: { type: 'object', properties: {}, required: [] } },
  { name: 'read_tokens', mode: 'read', description: 'List all access tokens.',
    input_schema: { type: 'object', properties: {}, required: [] } },
  { name: 'read_coupons', mode: 'read', description: 'List all coupons.',
    input_schema: { type: 'object', properties: {}, required: [] } },
  { name: 'read_linkbio', mode: 'read', description: 'List link-in-bio entries.',
    input_schema: { type: 'object', properties: {}, required: [] } },
  { name: 'read_insights', mode: 'read', description: 'Return KPIs for the insights home page.',
    input_schema: { type: 'object', properties: {}, required: [] } },

  // Write (approval required)
  { name: 'toggle_lesson', mode: 'write', description: 'Set a lesson active=TRUE or FALSE.',
    input_schema: { type: 'object', properties: { lessonId: { type: 'string' }, active: { type: 'boolean' } }, required: ['lessonId', 'active'] } },
  { name: 'draft_email', mode: 'write', description: 'Draft an email without sending.',
    input_schema: { type: 'object', properties: { templateId: { type: 'string' }, segment: { type: 'string' } }, required: [] } },
  { name: 'send_email', mode: 'write', description: 'Send a drafted email to a segment.',
    input_schema: { type: 'object', properties: { draftId: { type: 'string' } }, required: ['draftId'] } },
  { name: 'create_coupon', mode: 'write', description: 'Create a new discount coupon.',
    input_schema: { type: 'object', properties: { code: { type: 'string' }, type: { type: 'string', enum: ['percent', 'flat'] }, value: { type: 'number' }, products: { type: 'array', items: { type: 'string' } }, expires: { type: 'string' }, usageCap: { type: 'number' } }, required: ['code', 'type', 'value'] } },
  { name: 'update_coupon', mode: 'write', description: 'Update an existing coupon.',
    input_schema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } },
  { name: 'revoke_token', mode: 'write', description: 'Invalidate an access token.',
    input_schema: { type: 'object', properties: { token: { type: 'string' } }, required: ['token'] } },
  { name: 'reissue_token', mode: 'write', description: 'Issue a fresh token for a customer.',
    input_schema: { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] } },
  { name: 'add_linkbio_link', mode: 'write', description: 'Add a link to link-in-bio.',
    input_schema: { type: 'object', properties: { titleAR: { type: 'string' }, titleEN: { type: 'string' }, url: { type: 'string' } }, required: ['titleAR', 'url'] } },
  { name: 'update_linkbio_link', mode: 'write', description: 'Edit an existing link-in-bio entry.',
    input_schema: { type: 'object', properties: { linkId: { type: 'string' } }, required: ['linkId'] } },
  { name: 'delete_linkbio_link', mode: 'write', description: 'Remove a link-in-bio entry.',
    input_schema: { type: 'object', properties: { linkId: { type: 'string' } }, required: ['linkId'] } },

  // Reason (auto-execute, no side effects)
  { name: 'get_current_time', mode: 'reason', description: 'Return the current time in KSA.',
    input_schema: { type: 'object', properties: {}, required: [] } },
  { name: 'log_action', mode: 'reason', description: 'Record a note in the audit log.',
    input_schema: { type: 'object', properties: { note: { type: 'string' } }, required: ['note'] } },
];

export function isWriteTool(name: string): boolean {
  const t = toolRegistry.find((x) => x.name === name);
  return t?.mode === 'write';
}
