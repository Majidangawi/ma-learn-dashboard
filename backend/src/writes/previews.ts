import type { Lesson, Coupon, EmailTemplate, LinkbioItem } from '../data/read-extra.js';
import type { Customer } from '../data/sheets-read.js';
import { substituteVariables } from '../data/segments.js';

export interface ToggleLessonPreview {
  lessonId: string; title: string; module: string; from: boolean; to: boolean;
}
export function previewToggleLesson(lessons: Lesson[], lessonId: string, to: boolean): ToggleLessonPreview {
  const l = lessons.find(x => x.lessonId === lessonId);
  if (!l) throw new Error(`lesson_not_found:${lessonId}`);
  return { lessonId: l.lessonId, title: l.title, module: l.module, from: l.active, to };
}

export interface CreateCouponInput {
  code: string; type: 'percentage' | 'flat'; value: number;
  minSAR?: number; usesLeft?: number | null;
  startDate?: string; endDate?: string; products?: string;
}
export interface CreateCouponPreview {
  code: string; type: 'percentage' | 'flat'; value: number;
  minSAR: number; usesLeft: number | null;
  startDate: string; endDate: string; products: string;
  createdAt: string; createdBy: string;
}
export function previewCreateCoupon(input: CreateCouponInput, createdBy: string = 'majid'): CreateCouponPreview {
  return {
    code: input.code.toUpperCase().trim(),
    type: input.type,
    value: Number(input.value),
    minSAR: input.minSAR ?? 0,
    usesLeft: input.usesLeft === undefined ? null : input.usesLeft,
    startDate: input.startDate ?? '',
    endDate: input.endDate ?? '',
    products: input.products ?? 'all',
    createdAt: new Date().toISOString(),
    createdBy,
  };
}

export interface UpdateCouponPreview {
  code: string;
  changes: { field: string; from: unknown; to: unknown }[];
}
export function previewUpdateCoupon(existing: Coupon, patch: Partial<Coupon>): UpdateCouponPreview {
  const changes: UpdateCouponPreview['changes'] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'code') continue;
    const cur = (existing as unknown as Record<string, unknown>)[k];
    if (cur !== v) changes.push({ field: k, from: cur, to: v });
  }
  return { code: existing.code, changes };
}

export interface SendEmailPreview {
  templateId: string;
  language: 'AR' | 'EN';
  totalRecipients: number;
  sample: { email: string; subject: string; body: string }[];
  requiresExtraApproval: boolean;
}
export function previewSendEmail(
  tpl: EmailTemplate, recipients: Customer[], language: 'AR' | 'EN',
): SendEmailPreview {
  const subjectTpl = language === 'AR' ? tpl.subjectAR : tpl.subjectEN;
  const bodyTpl = language === 'AR' ? tpl.bodyAR : tpl.bodyEN;
  const sample = recipients.slice(0, 3).map(r => ({
    email: r.email,
    subject: substituteVariables(subjectTpl, { name: r.name, token: r.token, product: r.product }),
    body: substituteVariables(bodyTpl, { name: r.name, token: r.token, product: r.product }),
  }));
  return {
    templateId: tpl.templateId, language,
    totalRecipients: recipients.length,
    sample,
    requiresExtraApproval: recipients.length > 500,
  };
}

export interface LinkbioAddPreview {
  titleAR: string; titleEN: string; url: string; icon: string; description: string;
}
export function previewLinkbioAdd(input: { titleAR: string; titleEN: string; url: string; icon?: string; description?: string }): LinkbioAddPreview {
  return { titleAR: input.titleAR, titleEN: input.titleEN, url: input.url, icon: input.icon ?? '', description: input.description ?? '' };
}

export interface LinkbioUpdatePreview {
  linkId: string;
  changes: { field: string; from: unknown; to: unknown }[];
}
export function previewLinkbioUpdate(existing: LinkbioItem, patch: Partial<LinkbioItem>): LinkbioUpdatePreview {
  const changes: LinkbioUpdatePreview['changes'] = [];
  for (const [k, v] of Object.entries(patch)) {
    if (k === 'linkId') continue;
    const cur = (existing as unknown as Record<string, unknown>)[k];
    if (cur !== v) changes.push({ field: k, from: cur, to: v });
  }
  return { linkId: existing.linkId, changes };
}
