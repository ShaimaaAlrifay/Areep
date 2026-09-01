/* ============================================================
   Single source of truth for every PRD-feedback enum's value and Arabic
   label. Imported by both the feedback form (src/features/projects/
   PrdFeedback.jsx) and the admin Quality page (src/admin/pages/
   Quality.jsx) — so a label is never kept in sync in two places, and the
   values here match the `check` constraints on the `prd_feedback` table
   in supabase/schema.sql exactly.
   ============================================================ */

export const POSITIVE_REASONS = [
  { value: 'understood_idea', label: 'فهم الفكرة بشكل صحيح' },
  { value: 'accurate_requirements', label: 'المتطلبات كانت دقيقة' },
  { value: 'complete_requirements', label: 'المتطلبات كانت كاملة' },
  { value: 'organized_prd', label: 'الـPRD منظم' },
  { value: 'saved_time', label: 'وفّر علي وقت' },
  { value: 'ready_to_use', label: 'النتيجة كانت جاهزة للاستخدام' },
]

export const NEGATIVE_REASONS = [
  { value: 'misunderstood_idea', label: 'فهم الفكرة بشكل غير صحيح' },
  { value: 'missing_requirements', label: 'متطلبات ناقصة' },
  { value: 'incorrect_requirements', label: 'متطلبات غير صحيحة' },
  { value: 'invented_requirements', label: 'أضاف متطلبات غير موجودة' },
  { value: 'doesnt_reflect_need', label: 'الـPRD لا يعكس احتياجي' },
  { value: 'inappropriate_technical_detail', label: 'تفاصيل تقنية غير مناسبة' },
  { value: 'poor_organization', label: 'التنظيم أو الصياغة غير مناسبة' },
  { value: 'too_generic', label: 'النتيجة كانت عامة جدًا' },
  { value: 'needed_many_edits', label: 'احتجت تعديلات كثيرة' },
  { value: 'other', label: 'شيء آخر' },
]

export const REQUIREMENT_ACCURACY = [
  { value: 'all_correct', label: 'كلها تقريبًا صحيحة' },
  { value: 'mostly_correct', label: 'معظمها صحيح' },
  { value: 'some_correct', label: 'بعضها صحيح' },
  { value: 'many_incorrect', label: 'كثير منها غير صحيح' },
  { value: 'unsure', label: 'غير متأكد' },
]

export const REQUIREMENT_COMPLETENESS = [
  { value: 'complete', label: 'نعم، كانت كاملة' },
  { value: 'slightly_incomplete', label: 'كانت ناقصة قليلًا' },
  { value: 'clearly_incomplete', label: 'كانت ناقصة بشكل واضح' },
  { value: 'unsure', label: 'غير متأكد' },
]

export const EDIT_LEVEL = [
  { value: 'none', label: 'لا' },
  { value: 'light', label: 'تعديلات بسيطة' },
  { value: 'moderate', label: 'تعديلات متوسطة' },
  { value: 'heavy', label: 'تعديلات كثيرة' },
]

export const VALUE_RATING = [
  { value: 'significant', label: 'نعم، بشكل كبير' },
  { value: 'some', label: 'نعم، إلى حد ما' },
  { value: 'limited', label: 'بشكل محدود' },
  { value: 'none', label: 'لا' },
]

export function labelFor(list, value) {
  return list.find((option) => option.value === value)?.label ?? value
}
