import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Calendar } from 'lucide-react';
import AiResponseTable from './AiResponseTable';

/**
 * Robust Markdown Renderer for AI Responses
 * Uses react-markdown + remark-gfm for full markdown support,
 * with custom table rendering via AiResponseTable.
 *
 * Supports: Headers, Bold, Italic, Tables, Lists (ordered + nested),
 * Horizontal rules, Code blocks, Blockquotes, Links, Emoji headers, Date headers.
 *
 * @param {object} props
 * @param {string} props.content - Raw markdown string from AI
 * @param {string} props.className - Additional CSS classes
 */
const AiMarkdownRenderer = ({ content, className = '' }) => {
    /**
     * Parse table data from pipe-separated markdown lines.
     * Returns array of objects for AiResponseTable.
     */
    const parseTableData = (lines) => {
        if (lines.length < 2) return null;

        const headerLine = lines[0];
        const headers = headerLine
            .split('|')
            .map((h) => h.trim().replace(/\*/g, ''))
            .filter((h) => h && !h.match(/^:?-+:?$/));

        const separatorIndex = lines.findIndex((line) => /^\|?\s*:?-+:?\s*\|/.test(line));
        const dataLines = lines.slice(separatorIndex + 1);

        const rows = dataLines
            .filter((line) => line.includes('|'))
            .map((line) =>
                line
                    .split('|')
                    .map((cell) => cell.trim().replace(/\*/g, ''))
                    .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1 || arr.length <= 2)
            );

        const tableData = rows.map((row) => {
            const obj = {};
            headers.forEach((header, idx) => {
                const rawKey = header.replace(/\s+/g, '_').toLowerCase() || `kolom_${idx}`;
                obj[rawKey] = row[idx] || '';
            });
            return obj;
        });

        return tableData.length > 0 ? tableData : null;
    };

    /**
     * Split content into segments: markdown, table, dateHeader, emojiHeader.
     * Tables are extracted and rendered via AiResponseTable to preserve existing UI.
     */
    const segments = useMemo(() => {
        if (!content) return [];

        const lines = content.split('\n');
        const result = [];
        let markdownLines = [];

        const flushMarkdown = () => {
            if (markdownLines.length > 0) {
                result.push({ type: 'markdown', content: markdownLines.join('\n') });
                markdownLines = [];
            }
        };

        let i = 0;
        while (i < lines.length) {
            const trimmed = lines[i].trim();

            // Date header pattern: **[YYYY-MM-DD]**
            const dateMatch = trimmed.match(/^\*\*\[(\d{4}-\d{2}-\d{2})\]\*\*$/);
            if (dateMatch) {
                flushMarkdown();
                result.push({ type: 'dateHeader', date: dateMatch[1] });
                i++;
                continue;
            }

            // Emoji header: **📊 Title**
            const emojiMatch = trimmed.match(/^\*\*(\p{Emoji_Presentation}|\p{Emoji}\uFE0F?)\s*(.+?)\*\*$/u);
            if (emojiMatch) {
                flushMarkdown();
                result.push({ type: 'emojiHeader', emoji: emojiMatch[1], title: emojiMatch[2] });
                i++;
                continue;
            }

            // Table detection (pipe-separated lines)
            if (trimmed.startsWith('|') || (trimmed.includes('|') && lines[i + 1]?.includes('---'))) {
                flushMarkdown();
                const tableLines = [];
                while (i < lines.length && (lines[i].includes('|') || lines[i].trim().match(/^:?-+:?$/))) {
                    if (lines[i].trim()) tableLines.push(lines[i]);
                    i++;
                }
                const data = parseTableData(tableLines);
                if (data) {
                    result.push({ type: 'table', data });
                }
                continue;
            }

            // Regular markdown line (preserve as-is, including leading whitespace)
            markdownLines.push(lines[i]);
            i++;
        }

        flushMarkdown();
        return result;
    }, [content]);

    /**
     * Custom component overrides for react-markdown.
     * Styled with Tailwind to match the existing AI response design.
     */
    const markdownComponents = useMemo(() => ({
        h1: ({ children }) => (
            <h2 className="text-lg font-bold text-gray-900 mt-4 mb-2">{children}</h2>
        ),
        h2: ({ children }) => (
            <h3 className="text-base font-semibold text-gray-800 mt-3 mb-2">{children}</h3>
        ),
        h3: ({ children }) => (
            <h4 className="text-sm font-semibold text-gray-700 mt-2 mb-1">{children}</h4>
        ),
        p: ({ children }) => (
            <p className="text-sm text-gray-700 leading-relaxed mb-2 last:mb-0">{children}</p>
        ),
        strong: ({ children }) => (
            <strong className="font-semibold text-gray-900">{children}</strong>
        ),
        em: ({ children }) => (
            <em className="italic text-gray-600">{children}</em>
        ),
        ul: ({ children }) => (
            <ul className="pl-5 list-disc list-outside marker:text-blue-400 mb-2 last:mb-0">{children}</ul>
        ),
        ol: ({ children }) => (
            <ol className="pl-5 list-decimal list-outside marker:text-blue-600 marker:font-semibold mb-2 last:mb-0">{children}</ol>
        ),
        li: ({ children }) => (
            <li className="text-sm text-gray-700 leading-relaxed mb-2 last:mb-0 [&>p]:mb-0">{children}</li>
        ),
        hr: () => <hr className="my-4 border-t border-gray-200" />,
        blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-200 pl-3 my-2 text-gray-600 italic">{children}</blockquote>
        ),
        a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{children}</a>
        ),
        code: ({ inline, className: codeClassName, children }) => {
            if (inline) {
                return <code className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-gray-800">{children}</code>;
            }
            return (
                <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 my-2 overflow-x-auto text-xs">
                    <code className={codeClassName}>{children}</code>
                </pre>
            );
        },
        // Fallback table rendering (if any table slips through segment extraction)
        table: ({ children }) => (
            <div className="overflow-x-auto my-3">
                <table className="min-w-full text-sm border border-gray-200 rounded-lg overflow-hidden">{children}</table>
            </div>
        ),
        thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
        th: ({ children }) => <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b">{children}</th>,
        td: ({ children }) => <td className="px-3 py-2 text-sm text-gray-700 border-b border-gray-100">{children}</td>,
    }), []);

    return (
        <div className={`ai-markdown-content max-w-none ${className}`}>
            {segments.map((segment, idx) => {
                switch (segment.type) {
                    case 'markdown':
                        return (
                            <ReactMarkdown
                                key={`md-${idx}`}
                                remarkPlugins={[remarkGfm]}
                                components={markdownComponents}
                            >
                                {segment.content}
                            </ReactMarkdown>
                        );
                    case 'table':
                        return (
                            <div key={`table-${idx}`} className="my-4">
                                <AiResponseTable data={segment.data} />
                            </div>
                        );
                    case 'dateHeader':
                        return (
                            <div
                                key={`date-${idx}`}
                                className="flex items-center gap-2 mt-4 mb-2 bg-gradient-to-r from-blue-50 to-transparent px-3 py-2 rounded-lg border-l-4 border-blue-500"
                            >
                                <Calendar className="w-4 h-4 text-blue-600" />
                                <span className="text-sm font-semibold text-blue-700">{segment.date}</span>
                            </div>
                        );
                    case 'emojiHeader':
                        return (
                            <div key={`emoji-${idx}`} className="flex items-center gap-2 mt-4 mb-3">
                                <span className="text-xl">{segment.emoji}</span>
                                <h3 className="text-base font-bold text-gray-900">{segment.title}</h3>
                            </div>
                        );
                    default:
                        return null;
                }
            })}
        </div>
    );
};

export default React.memo(AiMarkdownRenderer);
