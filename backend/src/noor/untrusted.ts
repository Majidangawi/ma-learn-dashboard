/**
 * Wraps raw string data (customer emails, form fields, etc.) in
 * <untrusted_data> tags so Claude knows to treat it as DATA, not
 * instructions. Prompt-injection defense.
 *
 * If the payload contains a literal </untrusted_data> (attempted
 * tag-escape), wrap the whole thing in CDATA so it can't break out.
 */
export function wrapUntrusted(raw: string): string {
  if (raw.includes('</untrusted_data>')) {
    return `<untrusted_data><![CDATA[${raw}]]></untrusted_data>`;
  }
  return `<untrusted_data>${raw}</untrusted_data>`;
}
