import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'richText' })
export class RichTextPipe implements PipeTransform {
  transform(text: string | null | undefined): string {
    if (!text) return '';
    const lines = escape(text).split('\n');
    const out: string[] = [];
    let list: 'ul' | 'ol' | null = null;
    const close = () => {
      if (list) out.push(`</${list}>`);
      list = null;
    };
    for (const raw of lines) {
      const line = raw.trimEnd();
      const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
      const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
      if (bullet || numbered) {
        const kind = bullet ? 'ul' : 'ol';
        if (list !== kind) {
          close();
          out.push(`<${kind}>`);
          list = kind;
        }
        out.push(`<li>${inline((bullet ?? numbered)![1])}</li>`);
        continue;
      }
      close();
      const heading = /^#{1,4}\s+(.*)$/.exec(line);
      if (heading) out.push(`<p class="h">${inline(heading[1])}</p>`);
      else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
    }
    close();
    return out.join('');
  }
}

function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])\*(?!\s)([^*]+?)\*(?=[\s).,!?]|$)/g, '$1<i>$2</i>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/(^|[\s(])(https:\/\/[^\s<)]+[^\s<).,!?])/g, '$1<a href="$2">$2</a>');
}
