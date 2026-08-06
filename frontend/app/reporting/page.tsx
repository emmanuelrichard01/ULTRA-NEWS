import { permanentRedirect } from 'next/navigation';

/**
 * Retired destination.
 *
 * "Reporting" meant "corroborated by 3+ independent outlets" — a meaning almost
 * nobody would guess from the word, and one that read as a synonym of the
 * "Developing" tier beside it. That edition is now The Record.
 *
 * Kept as a permanent redirect so existing links keep working.
 */
export default function ReportingPage(): never {
  permanentRedirect('/record');
}
