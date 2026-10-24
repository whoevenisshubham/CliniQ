export type Evidence = {
    evidenceId: string;
    sourceType: 'document' | 'manual_transcript' | 'approved_emr' | 'transcript';
    versionId: string;
    text: string;
    documentId?: string;
    revision?: number;
    chunkId?: string;
    page?: number;
    title?: string;
    date?: string;
    segmentId?: string;
    sequence?: number;
    speaker?: string;
    contentSha256?: string;
};
export type GroundedAnswer = {
    schemaVersion: '1';
    answerKind: 'grounded' | 'insufficient_evidence';
    answer: string;
    facts: {
        text: string;
        evidenceIds: string[];
        quotedSupport: {
            evidenceId: string;
            quote: string;
        }[];
    }[];
    definitions: {
        text: string;
        referenceId: string;
    }[];
    uncertainties: string[];
    citedSourceIds: string[];
};
export type ProviderReply = {
    text: string;
    finishReason: string;
    usage?: {
        input: number;
        output: number;
    };
};
export type OfflineProvider = {
    mode: 'offline_fixture';
    authorizationRef: string;
    model: string;
    execute: (input: {
        kind: string;
        messages: {
            role: 'system' | 'user';
            content: string;
        }[];
        maxOutput: number;
        signal: AbortSignal;
    }) => Promise<ProviderReply>;
};
