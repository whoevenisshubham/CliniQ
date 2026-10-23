export class ProviderFailure extends Error {
    constructor(public category: 'RATE_LIMITED' | 'PROVIDER_AUTHENTICATION' | 'PROVIDER_UNAVAILABLE' | 'OUTCOME_UNKNOWN', public definite: boolean) { super(category); }
}
