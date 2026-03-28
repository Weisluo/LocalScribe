import React, { useMemo } from 'react';

export function useSearchHighlight(text: string, keyword: string): React.ReactNode {
  return useMemo(() => {
    if (!keyword.trim() || !text) return text;

    const searchKey = keyword.toLowerCase();
    const searchText = text.toLowerCase();
    
    if (!searchText.includes(searchKey)) return text;

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let index = searchText.indexOf(searchKey);
    let keyIndex = 0;

    while (index !== -1) {
      if (index > lastIndex) {
        parts.push(text.slice(lastIndex, index));
      }
      parts.push(
        React.createElement('mark', {
          key: keyIndex++,
          className: 'bg-yellow-300/50 text-inherit rounded px-0.5'
        }, text.slice(index, index + searchKey.length))
      );
      lastIndex = index + searchKey.length;
      index = searchText.indexOf(searchKey, lastIndex);
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  }, [text, keyword]);
}

export function highlightTextInHtml(html: string, keyword: string): string {
  if (!keyword.trim() || !html) return html;

  const searchKey = keyword.toLowerCase();
  
  const textNodes: { text: string; isHtml: boolean }[] = [];
  let lastIndex = 0;
  const tagRegex = /<[^>]*>/g;
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    if (match.index > lastIndex) {
      textNodes.push({ text: html.slice(lastIndex, match.index), isHtml: false });
    }
    textNodes.push({ text: match[0], isHtml: true });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < html.length) {
    textNodes.push({ text: html.slice(lastIndex), isHtml: false });
  }

  const result = textNodes.map(node => {
    if (node.isHtml) return node.text;
    
    const text = node.text;
    const searchText = text.toLowerCase();
    if (!searchText.includes(searchKey)) return text;

    let result = '';
    let idx = 0;
    let pos = searchText.indexOf(searchKey);

    while (pos !== -1) {
      result += text.slice(idx, pos);
      result += `<mark class="bg-yellow-300/50 rounded px-0.5">${text.slice(pos, pos + searchKey.length)}</mark>`;
      idx = pos + searchKey.length;
      pos = searchText.indexOf(searchKey, idx);
    }

    result += text.slice(idx);
    return result;
  }).join('');

  return result;
}
