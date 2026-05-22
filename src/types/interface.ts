export interface parsedLine {
    line: number;
    key: string;
    value: string;
}

export interface syntaxIssue {
    line: number;
    type: 'syntax';
    severity: 'error' | 'warning';
    message: string;
    key?: string;
}