const CHINESE_NUMBERS: Record<string, number> = {
  '零': 0, '〇': 0, '一': 1, '二': 2, '三': 3, '四': 4,
  '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
  '十': 10, '百': 100, '千': 1000, '万': 10000,
};

const CHINESE_NUMBER_CHARS = ['零', '〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '百', '千', '万'];

function chineseNumberToArabic(chineseNum: string): number | null {
  if (!chineseNum) return null;
  
  if (/^\d+$/.test(chineseNum)) {
    return parseInt(chineseNum, 10);
  }
  
  if (chineseNum === '元') return 1;
  
  let result = 0;
  let temp = 0;
  let lastUnit = 1;
  
  for (let i = 0; i < chineseNum.length; i++) {
    const char = chineseNum[i];
    const value = CHINESE_NUMBERS[char];
    
    if (value === undefined) return null;
    
    if (value >= 10) {
      if (temp === 0) temp = 1;
      if (value > lastUnit) {
        result = (result + temp) * value;
      } else {
        result += temp * value;
      }
      lastUnit = value;
      temp = 0;
    } else {
      temp = temp * 10 + value;
    }
  }
  
  result += temp;
  
  return result || null;
}

function extractYearFromText(text: string): { year: number; isFound: boolean } {
  const arabicMatch = text.match(/(\d+)/);
  if (arabicMatch) {
    return { year: parseInt(arabicMatch[1], 10), isFound: true };
  }
  
  const chineseYearMatch = text.match(new RegExp(`([${CHINESE_NUMBER_CHARS.join('')}]+)`));
  if (chineseYearMatch) {
    const year = chineseNumberToArabic(chineseYearMatch[1]);
    if (year !== null) {
      return { year, isFound: true };
    }
  }
  
  return { year: 0, isFound: false };
}

export interface ParsedTime {
  eraName: string;
  year: number;
  isYuanNian: boolean;
  originalText: string;
  sortValue: number;
}

export function parseChineseTime(timeText: string): ParsedTime {
  if (!timeText || !timeText.trim()) {
    return {
      eraName: '',
      year: 0,
      isYuanNian: false,
      originalText: timeText,
      sortValue: 0,
    };
  }
  
  const text = timeText.trim();
  
  const yuanNianMatch = text.match(/^(.+?)(元年|元年)$/) || text.match(/^(.+?)元[年]?$/);
  if (yuanNianMatch) {
    const eraName = yuanNianMatch[1].trim();
    return {
      eraName,
      year: 1,
      isYuanNian: true,
      originalText: text,
      sortValue: generateSortValue(eraName, 1, true),
    };
  }
  
  const yearMatch = text.match(new RegExp(`^(.+?)(\\d+|[${CHINESE_NUMBER_CHARS.join('')}]+)年?$`));
  if (yearMatch) {
    const eraName = yearMatch[1].trim();
    const yearText = yearMatch[2];
    const year = chineseNumberToArabic(yearText) || parseInt(yearText, 10) || 0;
    
    return {
      eraName,
      year,
      isYuanNian: false,
      originalText: text,
      sortValue: generateSortValue(eraName, year, false),
    };
  }
  
  const { year, isFound } = extractYearFromText(text);
  if (isFound) {
    const eraName = text.replace(/[\d零〇一二三四五六七八九十百千万年]/g, '').trim();
    return {
      eraName,
      year,
      isYuanNian: false,
      originalText: text,
      sortValue: generateSortValue(eraName, year, false),
    };
  }
  
  return {
    eraName: text,
    year: 0,
    isYuanNian: false,
    originalText: text,
    sortValue: generateSortValue(text, 0, false),
  };
}

function generateSortValue(eraName: string, year: number, _isYuanNian: boolean): number {
  const eraHash = eraName.split('').reduce((acc, char, index) => {
    return acc + char.charCodeAt(0) * Math.pow(10, index % 5);
  }, 0);
  
  return eraHash * 100000 + year;
}

export function compareTimes(a: string, b: string): number {
  const parsedA = parseChineseTime(a);
  const parsedB = parseChineseTime(b);
  
  if (parsedA.eraName === parsedB.eraName) {
    return parsedA.year - parsedB.year;
  }
  
  return parsedA.sortValue - parsedB.sortValue;
}

export function sortTimes<T extends { time?: string }>(items: T[], getTime: (item: T) => string | undefined): T[] {
  return [...items].sort((a, b) => {
    const timeA = getTime(a) || '';
    const timeB = getTime(b) || '';
    return compareTimes(timeA, timeB);
  });
}

export function formatTimeDisplay(parsed: ParsedTime): string {
  if (parsed.isYuanNian) {
    return `${parsed.eraName}元年`;
  }
  
  if (parsed.year > 0) {
    return `${parsed.eraName}${parsed.year}年`;
  }
  
  return parsed.originalText;
}

export interface TimeRange {
  minSortValue: number;
  maxSortValue: number;
  minYear: number;
  maxYear: number;
}

export function calculateTimeRange(times: string[]): TimeRange | null {
  if (times.length === 0) return null;
  
  const parsedTimes = times
    .filter(t => t && t.trim())
    .map(t => parseChineseTime(t));
  
  if (parsedTimes.length === 0) return null;
  
  const sortValues = parsedTimes.map(p => p.sortValue);
  const years = parsedTimes.map(p => p.year);
  
  return {
    minSortValue: Math.min(...sortValues),
    maxSortValue: Math.max(...sortValues),
    minYear: Math.min(...years),
    maxYear: Math.max(...years),
  };
}

export function calculateTimePosition(
  timeText: string,
  timeRange: TimeRange,
  padding: number = 5
): number {
  if (!timeText || !timeText.trim()) {
    return -1;
  }
  
  const parsed = parseChineseTime(timeText);
  
  const { minSortValue, maxSortValue } = timeRange;
  
  if (minSortValue === maxSortValue) {
    return 50;
  }
  
  const range = maxSortValue - minSortValue;
  const position = ((parsed.sortValue - minSortValue) / range) * (100 - 2 * padding) + padding;
  
  return Math.max(padding, Math.min(100 - padding, position));
}

export interface EraTimeInfo {
  id: string;
  startDate?: string;
  endDate?: string;
}

export interface EraTimeRange {
  eraId: string;
  startSortValue: number;
  endSortValue: number;
  startPosition: number;
  endPosition: number;
}

export function calculateEraBasedPositions<T extends { id: string; eventDate?: string; eraId?: string }>(
  events: T[],
  eras: EraTimeInfo[],
  options: {
    padding?: number;
    minSpacing?: number;
  } = {}
): Array<T & { position: number }> {
  const { padding = 5, minSpacing = 2 } = options;
  
  if (events.length === 0) return [];
  
  const eventsWithDates = events.filter(e => e.eventDate && e.eventDate.trim());
  
  if (eventsWithDates.length === 0) {
    return events.map((event, index) => ({
      ...event,
      position: padding + (index / Math.max(1, events.length - 1)) * (100 - 2 * padding),
    }));
  }
  
  const sortedEras = [...eras].sort((a, b) => compareTimes(a.startDate || '', b.startDate || ''));
  
  const eraEventsMap = new Map<string, T[]>();
  const orphanEvents: T[] = [];
  
  events.forEach(event => {
    if (event.eraId) {
      if (!eraEventsMap.has(event.eraId)) {
        eraEventsMap.set(event.eraId, []);
      }
      eraEventsMap.get(event.eraId)!.push(event);
    } else {
      orphanEvents.push(event);
    }
  });
  
  const eraRanges = new Map<string, { start: number; end: number }>();
  
  sortedEras.forEach(era => {
    const eraEvents = eraEventsMap.get(era.id) || [];
    const sortedEraEvents = [...eraEvents]
      .filter(e => e.eventDate)
      .sort((a, b) => compareTimes(a.eventDate || '', b.eventDate || ''));
    
    const startParsed = parseChineseTime(era.startDate || '');
    let startSortValue = startParsed.sortValue;
    
    let endSortValue: number;
    if (era.endDate && era.endDate.trim()) {
      const endParsed = parseChineseTime(era.endDate);
      endSortValue = endParsed.sortValue;
    } else if (sortedEraEvents.length > 0) {
      const lastEvent = sortedEraEvents[sortedEraEvents.length - 1];
      const lastParsed = parseChineseTime(lastEvent.eventDate!);
      endSortValue = lastParsed.sortValue;
    } else {
      endSortValue = startSortValue;
    }
    
    if (sortedEraEvents.length > 0) {
      const firstEventParsed = parseChineseTime(sortedEraEvents[0].eventDate!);
      startSortValue = Math.min(startSortValue, firstEventParsed.sortValue);
      
      const lastEventParsed = parseChineseTime(sortedEraEvents[sortedEraEvents.length - 1].eventDate!);
      endSortValue = Math.max(endSortValue, lastEventParsed.sortValue);
    }
    
    eraRanges.set(era.id, { start: startSortValue, end: endSortValue });
  });
  
  const allTimePoints: number[] = [];
  
  sortedEras.forEach(era => {
    const range = eraRanges.get(era.id);
    if (range) {
      allTimePoints.push(range.start, range.end);
    }
  });
  
  orphanEvents.forEach(event => {
    if (event.eventDate) {
      const parsed = parseChineseTime(event.eventDate);
      allTimePoints.push(parsed.sortValue);
    }
  });
  
  if (allTimePoints.length === 0) {
    return events.map((event, index) => ({
      ...event,
      position: padding + (index / Math.max(1, events.length - 1)) * (100 - 2 * padding),
    }));
  }
  
  const globalMin = Math.min(...allTimePoints);
  const globalMax = Math.max(...allTimePoints);
  const globalRange = globalMax - globalMin || 1;
  
  const eraPositionRanges = new Map<string, { startPos: number; endPos: number }>();
  
  sortedEras.forEach(era => {
    const range = eraRanges.get(era.id);
    if (range) {
      const startPos = padding + ((range.start - globalMin) / globalRange) * (100 - 2 * padding);
      const endPos = padding + ((range.end - globalMin) / globalRange) * (100 - 2 * padding);
      eraPositionRanges.set(era.id, { 
        startPos: Math.max(padding, startPos), 
        endPos: Math.min(100 - padding, endPos) 
      });
    }
  });
  
  const eventPositions = new Map<string, number>();
  const usedPositions: number[] = [];
  
  const allEventsSorted = [...events]
    .filter(e => e.eventDate)
    .sort((a, b) => compareTimes(a.eventDate || '', b.eventDate || ''));
  
  allEventsSorted.forEach(event => {
    const parsed = parseChineseTime(event.eventDate!);
    let position: number;
    
    if (event.eraId && eraPositionRanges.has(event.eraId)) {
      const eraRange = eraRanges.get(event.eraId)!;
      const eraPosRange = eraPositionRanges.get(event.eraId)!;
      const eraTimeRange = eraRange.end - eraRange.start || 1;
      
      position = eraPosRange.startPos + 
        ((parsed.sortValue - eraRange.start) / eraTimeRange) * (eraPosRange.endPos - eraPosRange.startPos);
    } else {
      position = padding + ((parsed.sortValue - globalMin) / globalRange) * (100 - 2 * padding);
    }
    
    for (const usedPos of usedPositions) {
      if (Math.abs(position - usedPos) < minSpacing) {
        position = Math.max(position, usedPos + minSpacing);
      }
    }
    
    position = Math.max(padding, Math.min(100 - padding, position));
    eventPositions.set(event.id, position);
    usedPositions.push(position);
  });
  
  const result: Array<T & { position: number }> = [];
  
  events.forEach(event => {
    if (eventPositions.has(event.id)) {
      result.push({
        ...event,
        position: eventPositions.get(event.id)!,
      });
    } else {
      const lastPosition = usedPositions.length > 0 ? Math.max(...usedPositions) : padding;
      const newPosition = Math.min(lastPosition + minSpacing * 2, 100 - padding);
      result.push({
        ...event,
        position: newPosition,
      });
      usedPositions.push(newPosition);
    }
  });
  
  return result.sort((a, b) => a.position - b.position);
}

export function calculateEventsPositions<T extends { eventDate?: string }>(
  events: T[],
  options: {
    padding?: number;
    minSpacing?: number;
  } = {}
): Array<T & { position: number }> {
  const { padding = 5, minSpacing = 2 } = options;
  
  if (events.length === 0) return [];
  
  const eventsWithDates = events.filter(e => e.eventDate && e.eventDate.trim());
  
  if (eventsWithDates.length === 0) {
    return events.map((event, index) => ({
      ...event,
      position: padding + (index / Math.max(1, events.length - 1)) * (100 - 2 * padding),
    }));
  }
  
  const times = eventsWithDates.map(e => e.eventDate!);
  const timeRange = calculateTimeRange(times);
  
  if (!timeRange) {
    return events.map((event, index) => ({
      ...event,
      position: padding + (index / Math.max(1, events.length - 1)) * (100 - 2 * padding),
    }));
  }
  
  const sortedEventsWithDates = [...eventsWithDates].sort((a, b) => 
    compareTimes(a.eventDate || '', b.eventDate || '')
  );
  
  const positionsMap = new Map<string, number>();
  
  sortedEventsWithDates.forEach(event => {
    const rawPosition = calculateTimePosition(event.eventDate!, timeRange, padding);
    positionsMap.set(event.eventDate!, rawPosition);
  });
  
  const adjustedPositions = new Map<string, number>();
  const usedPositions: number[] = [];
  
  sortedEventsWithDates.forEach(event => {
    let position = positionsMap.get(event.eventDate!)!;
    
    for (const usedPos of usedPositions) {
      if (Math.abs(position - usedPos) < minSpacing) {
        position = Math.max(position, usedPos + minSpacing);
      }
    }
    
    position = Math.min(position, 100 - padding);
    adjustedPositions.set(event.eventDate!, position);
    usedPositions.push(position);
  });
  
  const result: Array<T & { position: number }> = [];
  
  events.forEach(event => {
    if (event.eventDate && adjustedPositions.has(event.eventDate)) {
      result.push({
        ...event,
        position: adjustedPositions.get(event.eventDate)!,
      });
    } else {
      const lastPosition = usedPositions.length > 0 ? Math.max(...usedPositions) : padding;
      const newPosition = Math.min(lastPosition + minSpacing * 2, 100 - padding);
      result.push({
        ...event,
        position: newPosition,
      });
      usedPositions.push(newPosition);
    }
  });
  
  return result.sort((a, b) => a.position - b.position);
}
